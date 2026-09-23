# V30 — Arquitetura de batida temporária

## Objetivo
Separar os produtos cadastrados durante uma batida aberta do catálogo geral de produtos.

## Fluxo
1. Iniciar batida: registro em `batidas` com status `in_progress`.
2. Cadastrar produto: gravação em `batida_itens_temporarios`.
3. Durante a batida: itens temporários aparecem somente em `Batida atual`.
4. Finalizar batida: chamada transacional `finalizar_batida(p_batida_id)`.
5. A função publica os itens em `products`, atualiza a batida para `completed`, registra `product_count` e remove os itens temporários.
6. O aplicativo gera a notificação consolidada da batida, sem notificar cada produto individualmente.

## Aplicação no Supabase
Antes de publicar a versão, execute o arquivo:

`SUPABASE_V30_BATIDA_TEMPORARIA.sql`

O SQL cria:
- coluna `batidas.product_count`;
- tabela `batida_itens_temporarios`;
- políticas RLS;
- função transacional `public.finalizar_batida(uuid)`.

## Cuidados
- Faça backup antes de executar a migração.
- Teste primeiro em uma cópia/projeto de desenvolvimento.
- Não apague as tabelas existentes.
- Se a função transacional não estiver instalada, a versão não finaliza a batida online para evitar publicar produtos parcialmente.

## Teste mínimo
- Iniciar uma batida.
- Cadastrar 2 produtos.
- Confirmar que eles não aparecem em Produtos gerais.
- Recarregar a página e confirmar que continuam na batida aberta.
- Finalizar a batida.
- Confirmar que os 2 produtos aparecem no catálogo geral e que a batida recebe `product_count = 2`.
