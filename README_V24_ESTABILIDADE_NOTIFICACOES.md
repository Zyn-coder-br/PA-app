# V24 — Estabilidade e notificações consolidadas

## Alterações

- Removidas as notificações individuais de produtos recebidos pelo Realtime.
- A conclusão de uma batida gera uma única notificação resumida:
  `Batida realizada · Corredor X · N novos produtos.`
- Eventos intermediários de batidas não geram notificações.
- Atualizações recebidas de produtos usam renderização agrupada com pequeno debounce para evitar redesenhar a aplicação a cada evento.
- Mantida a sincronização dos produtos; a mudança afeta apenas o excesso de notificações e renderizações.

## Backup e implantação

1. Manter a versão anterior publicada como cópia de segurança.
2. Exportar o backup pelo menu Ajustes antes de substituir os arquivos.
3. Publicar a V24 em uma versão separada do GitHub Pages e testar com dois usuários.
