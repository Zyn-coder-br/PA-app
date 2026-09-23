# V29 — Correção do fluxo de produtos da batida

## Objetivo
Garantir que produtos cadastrados enquanto existe uma batida aberta permaneçam na lista **Produtos desta batida** e não sejam enviados ao catálogo geral antes da finalização.

## Regras implementadas
- Produto novo cadastrado com batida aberta é salvo localmente no IndexedDB com `batchId`.
- O produto da batida aberta **não chama `syncProducts()`**.
- O produto aparece na tela da batida atual, enquanto a batida estiver aberta.
- A função de sincronização manual ignora produtos vinculados a batidas abertas.
- Ao finalizar a batida:
  1. A aplicação pede confirmação.
  2. A batida muda para `finalizada`.
  3. Os produtos vinculados à batida são enviados ao catálogo geral do Supabase.
  4. Se houver falha, os produtos permanecem locais com `syncPending`, para não serem perdidos.
- A sincronização de produtos preserva registros locais pendentes que ainda não foram retornados pelo Supabase.

## Preservado da base V28
- Tema escuro e correções de hover.
- Botão flutuante e menu de ações.
- Cadastro manual, FEFO, promotores, relatórios, histórico e demais funções existentes.
- Notificações de produtos silenciosas e notificação consolidada de batida finalizada.

## Testes técnicos realizados
- Verificação de sintaxe do `app.js` com `node --check`: aprovada.
- A validação real precisa ser feita no GitHub Pages e no Supabase:
  1. Abrir batida.
  2. Cadastrar produto.
  3. Confirmar que aparece apenas na batida.
  4. Abrir Produtos antes de finalizar e confirmar que não aparece.
  5. Finalizar.
  6. Confirmar que aparece em Produtos após a finalização.
