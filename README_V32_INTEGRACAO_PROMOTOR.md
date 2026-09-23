# V32 — Integração Promotor PA → Vencimento PA

## Objetivo

Exibir no Vencimento PA, na aba **Produtos Promotores**, os produtos cadastrados no aplicativo **Promotor PA**, com identificação da empresa e filtro por empresa.

## Alterações

- Consulta a tabela `public.promotor_products` do Supabase.
- Exibição dos produtos externos na aba `Produtos Promotores`.
- Identificação visual `PROMOTOR`.
- Exibição de empresa, local, EAN, validade e quantidade.
- Filtro por empresa: Todas as empresas, Coca Cola, Qualitá etc.
- Produtos vindos do Promotor PA são somente para consulta no Vencimento PA; não entram nas ações de edição/exclusão em massa do catálogo local.
- A integração preserva os produtos locais do Vencimento PA.

## Instalação

1. Publique os arquivos do projeto no GitHub Pages.
2. Execute `SUPABASE_V32_PROMOTOR_SHARED.sql` no SQL Editor do mesmo projeto Supabase.
3. Confirme que os dois aplicativos usam o mesmo projeto Supabase.
4. Faça login no Vencimento PA e abra **Produtos → Produtos Promotores**.
5. Use o filtro **Empresa** para selecionar uma empresa.

## Segurança

A migração permite leitura dos produtos do Promotor PA para usuários autenticados. Ela não libera `insert`, `update` ou `delete` para o Vencimento PA.
