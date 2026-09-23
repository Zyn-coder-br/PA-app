# V31 — Correção definitiva do fluxo de produtos da batida

## Correções
- O formulário de produto agora mantém o `productBatchId` da batida aberta.
- Produtos cadastrados em uma batida aberta são marcados como `isTemporaryBatchItem`.
- O salvamento temporário é obrigatório para itens de batida; o código não usa `syncProducts` nesses casos.
- O cadastro manual continua usando a tabela geral `products`.
- A migração SQL foi ajustada para `corridor_id bigint`, compatível com a estrutura atual da tabela `corridors`.

## Fluxo esperado
1. Iniciar batida.
2. Cadastrar produto.
3. Produto vai para `batida_itens_temporarios`.
4. Produto aparece apenas em Produtos desta batida.
5. Finalizar batida chama `finalizar_batida(uuid)`.
6. A função publica os temporários em `products` e encerra a batida.

## Testes técnicos
- Validar sintaxe com `node --check app.js`.
- Executar a migração SQL somente se a tabela/função ainda não estiverem atualizadas.
- Testar cadastro em batida, cadastro manual, cancelamento e finalização.
