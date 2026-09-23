# V25 — Otimização adicional e notificações consolidadas

## Alterações
- Evita renderizações duplicadas durante a inicialização do Realtime: a sincronização inicial de batidas e produtos renderiza a interface uma única vez.
- Agrupa a persistência de eventos de produtos recebidos pelo Realtime em uma janela curta, reduzindo gravações repetidas no IndexedDB.
- Mantém a atualização visual com debounce.
- Adiciona deduplicação de notificações de batidas finalizadas durante a sessão, evitando repetição do mesmo evento UPDATE/INSERT.
- Desativa `renotify` nas notificações de batida consolidada.

## Teste recomendado
1. Manter a V24 preservada e fazer backup do aplicativo.
2. Publicar esta versão em uma cópia de teste.
3. Entrar com dois usuários.
4. Finalizar uma batida com vários produtos.
5. Confirmar que o outro usuário recebe apenas um aviso consolidado.
6. Verificar se a tela continua responsiva ao receber vários produtos.

Esta versão é uma etapa de otimização. Ainda é necessário medir o desempenho em aparelhos reais e com o volume real de dados.
