# V21 — Correção de sincronização e exclusão compartilhada

Base: V18 — Exclusão compartilhada de produtos.

Correções:
- O carregamento do Supabase passa a ser autoritativo: itens ausentes na nuvem não são reintroduzidos apenas por estarem no armazenamento local.
- Produtos locais pendentes usam `syncPending: true`; somente esses itens podem ser enviados automaticamente no login.
- Produtos já confirmados na nuvem não são reenviados a cada login ou recarregamento.
- Eventos Realtime DELETE usam `payload.old` para remover corretamente o produto nos outros dispositivos.
- Eventos de produtos repetidos são deduplicados por uma janela curta.
- Cadastro/edição e importação FEFO marcam o item como pendente até a confirmação do Supabase.
- A exclusão compartilhada da V18 foi preservada.

Importante: publicar os arquivos e testar com um produto de teste novo. Não apagar dados diretamente no IndexedDB para validar a sincronização; a nuvem deve ser a fonte compartilhada.
