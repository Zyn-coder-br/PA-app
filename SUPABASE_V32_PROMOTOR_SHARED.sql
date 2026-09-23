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


-- V32.1: exclusão controlada pelo fluxo de retirada/PIQUE do Vencimento PA.
-- A função exige usuário autenticado e remove somente o registro indicado.
create or replace function public.delete_promotor_product_from_vpa(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  delete from public.promotor_products where id = p_product_id;
  return jsonb_build_object('deleted', true, 'id', p_product_id);
end;
$$;
revoke all on function public.delete_promotor_product_from_vpa(uuid) from public;
grant execute on function public.delete_promotor_product_from_vpa(uuid) to authenticated;


alter table if exists public.promotor_products add column if not exists tag text;

create or replace function public.tag_promotor_product_from_vpa(p_product_id uuid, p_tag text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  update public.promotor_products set tag = nullif(trim(p_tag), '') where id = p_product_id;
  return jsonb_build_object('updated', true, 'id', p_product_id, 'tag', p_tag);
end;
$$;
revoke all on function public.tag_promotor_product_from_vpa(uuid,text) from public;
grant execute on function public.tag_promotor_product_from_vpa(uuid,text) to authenticated;

-- V34: garante eventos Realtime para a tabela compartilhada dos promotores.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'promotor_products'
  ) then
    alter publication supabase_realtime add table public.promotor_products;
  end if;
end $$;
