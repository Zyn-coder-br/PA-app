-- V14: garante leitura e eventos compartilhados dos produtos pela equipe.
-- Execute no Supabase SQL Editor com o usuário administrador do projeto.

ALTER TABLE public.products REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_authenticated_select" ON public.products;
CREATE POLICY "products_authenticated_select"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "products_authenticated_insert" ON public.products;
CREATE POLICY "products_authenticated_insert"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = registered_by);

DROP POLICY IF EXISTS "products_authenticated_update" ON public.products;
CREATE POLICY "products_authenticated_update"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "products_authenticated_delete" ON public.products;
CREATE POLICY "products_authenticated_delete"
  ON public.products FOR DELETE
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('products', 'batidas');
