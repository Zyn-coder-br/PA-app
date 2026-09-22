-- V16: Cadastra os 22 corredores do Vencimento PA no Supabase.
-- Execute no Supabase SQL Editor uma única vez.

insert into public.corridors (corridor_number, name, active)
select n, 'Corredor ' || n, true
from generate_series(1, 22) as s(n)
on conflict (corridor_number) do update
set name = excluded.name,
    active = true;

-- Conferência: deve retornar 22 linhas, caso todos os corredores estejam ativos.
select id, corridor_number, name, active
from public.corridors
where corridor_number between 1 and 22
order by corridor_number;
