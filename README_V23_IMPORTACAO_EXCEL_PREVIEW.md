# V23 — Importação Excel com pré-visualização

- Adicionado botão **Importar planilha Excel (.xlsx)** no cadastro FEFO.
- A planilha é lida no navegador e não é salva antes da confirmação.
- Colunas reconhecidas: `PLU`, `DESCRICAO`/`DESCRIÇÃO`, `ESTOQUE`/`QUANTIDADE`, `DATA VENCIMENTO`/`VENCIMENTO`/`VALIDADE`.
- A prévia permite desmarcar produtos individualmente.
- Após confirmação, os itens são salvos localmente e enviados ao Supabase usando o fluxo de sincronização existente.
- Biblioteca SheetJS carregada por CDN.
