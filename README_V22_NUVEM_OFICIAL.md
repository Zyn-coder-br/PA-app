# V22 — Supabase como fonte oficial

Base: V21.

Alterações:
- O carregamento de produtos substitui a lista local pela lista retornada pelo Supabase.
- Produtos locais ausentes na nuvem não são reintroduzidos após login ou recarregamento.
- O login não executa mais o reenvio automático de produtos locais antigos marcados como `syncPending`.
- O cadastro/edição continua enviando o registro imediatamente ao Supabase e só marca `syncPending` como falso após confirmação.
- A exclusão compartilhada e os eventos Realtime permanecem ativos.

Teste recomendado:
1. Publicar `app.js`, `supabase-client.js` e este README.
2. Criar um produto de teste.
3. Confirmar que ele aparece em outro aparelho.
4. Excluir o produto.
5. Atualizar a página e entrar novamente.
6. Confirmar que o produto não reaparece.
