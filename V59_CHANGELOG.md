# V59 — Notificação resumida na importação FEFO

- Importações FEFO em massa (PDF, Excel e leitura de lista) não geram mais uma notificação por produto.
- Eventos realtime de produtos marcados como `pdf-fefo`, `planilha-fefo` ou `lista-fefo` são ignorados pela notificação individual.
- Após a importação, o aplicativo mostra uma única notificação: `Vencimento PA · Lista FEFO` com a quantidade total adicionada.
- Mantidas as demais notificações de produtos cadastrados individualmente.
- Service Worker atualizado para V59.
