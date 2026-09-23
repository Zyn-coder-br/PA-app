# V14 — Produtos compartilhados

Esta versão corrige a configuração necessária para que os produtos FEFO cadastrados por um usuário sejam visíveis e transmitidos aos demais usuários autenticados.

1. Execute `SUPABASE_V14_PRODUCTS_SHARED.sql` no SQL Editor do Supabase.
2. Publique os arquivos no GitHub Pages.
3. Recarregue os dois dispositivos.
4. Confira no console se aparecem `Realtime produtos conectado` e `Produto enviado ao banco compartilhado`.

O Realtime não substitui a gravação no banco: primeiro o produto precisa ser confirmado no Supabase. Se houver falha, o aplicativo informa que o item permaneceu apenas local.
