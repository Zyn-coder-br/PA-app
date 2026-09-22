-- V18: permite que a exclusão de produtos seja compartilhada entre os dispositivos.
-- Execute no Supabase SQL Editor usando a sessão autenticada do projeto.

alter table public.products replica identity full;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'products_delete_authenticated'
  ) THEN
    CREATE POLICY products_delete_authenticated
      ON public.products
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END
$$;

-- Confirma a política criada.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'products'
ORDER BY policyname;
