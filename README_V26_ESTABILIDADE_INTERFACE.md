# V26 — Estabilidade, notificações silenciosas e interface dark

## Alterações
- Eventos de produtos via Realtime (`INSERT`, `UPDATE` e `DELETE`) não geram notificações individuais.
- Mantida a notificação consolidada somente para batida finalizada.
- Adicionado botão flutuante no canto inferior direito da tela de Produtos com:
  - Marcar/desmarcar tudo
  - Alterar status
  - Adicionar tag
  - Excluir selecionados
- Mantido o painel original de ações para desktop, com o painel flutuante como alternativa para rolar a lista inteira.
- Adicionados ajustes de tema escuro para remover áreas brancas da tela de produtos, filtros, cards, pesquisa e menu flutuante.
- Cache do Service Worker atualizado para forçar a atualização dos arquivos publicados.

## Testes recomendados
1. Publicar em uma cópia de teste do GitHub Pages.
2. Confirmar atualização do Service Worker/recarregar sem cache.
3. Cadastrar vários produtos em uma batida e finalizar.
4. Excluir vários produtos em massa.
5. Confirmar que não há notificações individuais de produtos.
6. Ativar o modo escuro e percorrer toda a tela de Produtos.
7. Abrir o botão flutuante no canto inferior direito e testar as quatro ações.
