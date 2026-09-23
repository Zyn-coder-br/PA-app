# V12 — Produtos compartilhados e FEFO em tempo real

## O que mudou
- Produtos novos são enviados automaticamente ao Supabase depois do cadastro.
- Importações da lista FEFO são enviadas automaticamente ao Supabase.
- O app carrega produtos compartilhados do Supabase ao iniciar a conexão da equipe.
- Eventos Realtime de `products` são incorporados à lista local e exibem notificação.
- Metadados como `fefo`, `promotor`, `batchId` e informações de PIQUE são armazenados em `app_metadata`.

## Passo obrigatório no Supabase
Execute o arquivo `SUPABASE_V12_SHARED_PRODUCTS.sql` no SQL Editor do projeto antes de testar.

## Limite desta versão
O cache local continua existindo para permitir uso offline, mas o Supabase passa a ser a fonte compartilhada quando há conexão. A sincronização de imagens grandes de produtos ainda não foi incluída em `app_metadata`.
