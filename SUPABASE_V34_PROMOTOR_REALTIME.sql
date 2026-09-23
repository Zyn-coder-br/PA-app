-- V34 / Promotor V05 - correção de integração Promotor PA <-> Vencimento PA
-- Script idempotente: pode ser executado mais de uma vez.

alter table if exists public.promotor_products add column if not exists company text;
alter table if exists public.promotor_products add column if not exists tag text;
alter table if exists public.promotor_products add column if not exists expiration_date date;
alter table if exists public.promotor_products add column if not exists location text;
alter table if exists public.promotor_products add column if not exists quantity numeric;

-- Preenche empresa em produtos antigos usando o perfil do promotor, quando disponível.
do $$
begin
  if to_regclass('public.promotor_profiles') is not null and to_regclass('public.promotor_products') is not null then
    update public.promotor_products p
       set company = pr.company
      from public.promotor_profiles pr
     where p.user_id = pr.user_id
       and (p.company is null or btrim(p.company) = '')
       and pr.company is not null
       and btrim(pr.company) <> '';
  end if;
end $$;

-- Garante leitura compartilhada autenticada para o Vencimento PA.
alter table if exists public.promotor_products enable row level security;
drop policy if exists "promotor products authenticated read" on public.promotor_products;
create policy "promotor products authenticated read"
on public.promotor_products for select to authenticated
using (auth.role() = 'authenticated');

-- Habilita Realtime apenas se a tabela ainda não estiver na publicação.
do $$
begin
  if to_regclass('public.promotor_products') is not null and not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='promotor_products'
  ) then
    alter publication supabase_realtime add table public.promotor_products;
  end if;
end $$;
