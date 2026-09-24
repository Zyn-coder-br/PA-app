# Vencimento PA — pacote de publicação V40

Este pacote contém apenas os arquivos necessários para o funcionamento no GitHub Pages.

## Rebaixa Automática
- Nova aba independente dentro de Produtos.
- Importação de planilha Excel com Loja, PLU, Descrição, Estoque, Data de Vencimento e Valor.
- Pré-visualização e seleção antes de salvar.
- Ordenação por data de vencimento.
- Exportação da lista em Excel.
- Botão verde “Preço alterado” remove o item da lista.
- Mensagem “Tudo em dia — Aguardando nova lista de Rebaixas” quando não existem itens.

Históricos, backups, rascunhos e scripts SQL antigos foram retirados do pacote de publicação. Mantenha os scripts SQL em um local separado para consulta e manutenção do Supabase.

## V38 — Correção de navegação da Rebaixa Automática

- A aba Rebaixa Automática agora exibe as quatro abas de Produtos.
- É possível voltar para Todos, Produtos FEFO ou Produtos Promotores sem usar o menu flutuante.
- A seleção da aba usa o mesmo estado `productFilter` do restante do catálogo.


## V39 — Ajuste da janela de importação
- A janela de Rebaixa Automática possui altura responsiva.
- A lista tem rolagem própria.
- Os botões Cancelar e Confirmar permanecem acessíveis no rodapé.
- Nenhuma integração com Supabase foi alterada nesta etapa.


## V40 — Rebaixa Automática compartilhada
- A importação da lista tenta salvar os itens na tabela compartilhada `public.rebaixa_items`.
- A lista é carregada do Supabase e ordenada pela data de vencimento.
- O botão “Preço alterado” marca o item como `completed`, preservando o histórico no banco.
- Foi adicionado Realtime para atualizar a lista entre usuários autenticados.
- Execute `SUPABASE_V40_REBAIXA_AUTOMATICA.sql` no SQL Editor antes de publicar esta versão.
- As notificações push externas ainda não estão concluídas nesta etapa.
