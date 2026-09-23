# Vencimento PA V33 — Integração Promotor / PIQUE

Implementado:
- Atualização em tempo real da tabela `promotor_products`.
- Recebimento automático de novos produtos sem recarregar a página.
- Produtos de promotores com validade de 0 a 10 dias entram em Pendências > PIQUE.
- Retirada PIQUE de produto externo chama a função segura do Supabase para excluir o produto do Promotor PA.
- Tags dos produtos do Promotor PA podem ser persistidas por RPC.
- Exclusão em massa trata registros locais e registros externos.

Executar `SUPABASE_V32_PROMOTOR_SHARED.sql` no SQL Editor antes do teste.
