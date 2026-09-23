# V27 — Correções de batida, menu flutuante e tema escuro

## Alterações

- Produtos vinculados a uma batida aberta permanecem fora da aba geral de Produtos.
- O vínculo `batchId` local é preservado quando o Supabase/Reatime não devolve `app_metadata`.
- O botão flutuante de ações em massa continua fixo e recebe animação suave.
- O menu de ações em massa abre acima do botão.
- Reforço dos estados `:hover` e `:focus` no tema escuro para evitar fundos brancos nas abas, listas, botões, campos e menus.

## Testes recomendados

1. Iniciar uma batida e cadastrar um produto.
2. Confirmar que ele aparece apenas em Batidas enquanto a batida estiver aberta.
3. Finalizar a batida e confirmar que o produto passa a aparecer em Produtos.
4. Abrir o botão flutuante no final da página e verificar que o menu fica acima dele.
5. Ativar o tema escuro e passar o mouse por todas as abas, botões, linhas e campos.
