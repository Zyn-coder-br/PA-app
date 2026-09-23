-- V32 - Integração dos produtos do Promotor PA com a aba Produtos Promotores do Vencimento PA
-- Execute no SQL Editor do mesmo projeto Supabase usado pelos dois aplicativos.
-- Esta política permite que usuários autenticados consultem os produtos cadastrados pelos promotores.
-- Não concede permissão de alteração ou exclusão.

alter table if exists public.promotor_products enable row level security;

drop policy if exists "promotor products authenticated read" on public.promotor_products;
create policy "promotor products authenticated read"
on public.promotor_products
for select
to authenticated
using (auth.role() = 'authenticated');

-- Confirma que os campos usados pela integração existem.
alter table if exists public.promotor_products add column if not exists company text;
alter table if exists public.promotor_products add column if not exists photo_url text;
alter table if exists public.promotor_products add column if not exists location text;
alter table if exists public.promotor_products add column if not exists expiration_date date;
alter table if exists public.promotor_products add column if not exists quantity numeric;
