-- V30: itens temporários de batida + finalização transacional
-- Execute no SQL Editor do Supabase antes de publicar a V30.
-- Esta migração não apaga os produtos existentes.

ALTER TABLE public.batidas
  ADD COLUMN IF NOT EXISTS product_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.batida_itens_temporarios (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.batidas(id) ON DELETE CASCADE,
  name text NOT NULL,
  ean text,
  corridor_id uuid NOT NULL REFERENCES public.corridors(id),
  quantity_found numeric NOT NULL DEFAULT 0,
  quantity_separated numeric NOT NULL DEFAULT 0,
  expiration_date date,
  status text NOT NULL DEFAULT 'found',
  registered_by uuid NOT NULL REFERENCES auth.users(id),
  app_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batida_itens_temporarios_batch_id
  ON public.batida_itens_temporarios(batch_id);

CREATE INDEX IF NOT EXISTS idx_batida_itens_temporarios_created_at
  ON public.batida_itens_temporarios(created_at);

ALTER TABLE public.batida_itens_temporarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "temporary_batch_items_authenticated_select"
  ON public.batida_itens_temporarios;
CREATE POLICY "temporary_batch_items_authenticated_select"
  ON public.batida_itens_temporarios
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "temporary_batch_items_authenticated_insert"
  ON public.batida_itens_temporarios;
CREATE POLICY "temporary_batch_items_authenticated_insert"
  ON public.batida_itens_temporarios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = registered_by);

DROP POLICY IF EXISTS "temporary_batch_items_authenticated_update"
  ON public.batida_itens_temporarios;
CREATE POLICY "temporary_batch_items_authenticated_update"
  ON public.batida_itens_temporarios
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "temporary_batch_items_authenticated_delete"
  ON public.batida_itens_temporarios;
CREATE POLICY "temporary_batch_items_authenticated_delete"
  ON public.batida_itens_temporarios
  FOR DELETE TO authenticated
  USING (true);

-- O Realtime é opcional para os itens temporários. A lista é carregada
-- explicitamente para não gerar notificações por item durante a batida.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'batida_itens_temporarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.batida_itens_temporarios;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finalizar_batida(p_batida_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.batidas%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada necessária.';
  END IF;

  SELECT *
    INTO v_batch
  FROM public.batidas
  WHERE id = p_batida_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batida não encontrada.';
  END IF;

  IF v_batch.status = 'completed' THEN
    RETURN jsonb_build_object(
      'batch_id', p_batida_id,
      'product_count', COALESCE(v_batch.product_count, 0),
      'already_finalized', true
    );
  END IF;

  IF v_batch.status <> 'in_progress' THEN
    RAISE EXCEPTION 'A batida não está aberta.';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM public.batida_itens_temporarios
  WHERE batch_id = p_batida_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'A batida não possui produtos temporários.';
  END IF;

  INSERT INTO public.products (
    id,
    name,
    ean,
    corridor_id,
    quantity_found,
    quantity_separated,
    expiration_date,
    status,
    registered_by,
    app_metadata,
    created_at,
    updated_at
  )
  SELECT
    t.id,
    t.name,
    t.ean,
    t.corridor_id,
    t.quantity_found,
    t.quantity_separated,
    t.expiration_date,
    t.status,
    t.registered_by,
    jsonb_set(
      COALESCE(t.app_metadata, '{}'::jsonb),
      '{batchId}',
      to_jsonb(t.batch_id::text),
      true
    ),
    t.created_at,
    now()
  FROM public.batida_itens_temporarios t
  WHERE t.batch_id = p_batida_id
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    ean = EXCLUDED.ean,
    corridor_id = EXCLUDED.corridor_id,
    quantity_found = EXCLUDED.quantity_found,
    quantity_separated = EXCLUDED.quantity_separated,
    expiration_date = EXCLUDED.expiration_date,
    status = EXCLUDED.status,
    registered_by = EXCLUDED.registered_by,
    app_metadata = EXCLUDED.app_metadata,
    updated_at = now();

  UPDATE public.batidas
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    product_count = v_count
  WHERE id = p_batida_id;

  DELETE FROM public.batida_itens_temporarios
  WHERE batch_id = p_batida_id;

  RETURN jsonb_build_object(
    'batch_id', p_batida_id,
    'product_count', v_count,
    'already_finalized', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_batida(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
