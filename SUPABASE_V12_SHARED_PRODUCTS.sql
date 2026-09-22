-- V12: dados extras para compartilhar FEFO, promotor e vínculo operacional.
-- Execute uma vez no Supabase SQL Editor antes de testar a sincronização automática.
alter table public.products
  add column if not exists app_metadata jsonb not null default '{}'::jsonb;

create index if not exists products_registered_by_idx on public.products (registered_by);
create index if not exists products_expiration_date_idx on public.products (expiration_date);

-- Recarrega o cache de metadados da API/PostgREST.
notify pgrst, 'reload schema';
