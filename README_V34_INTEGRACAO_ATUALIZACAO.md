# Vencimento PA V34

- Corrige desaparecimento da lista de Produtos Promotores quando a tabela geral de produtos é recarregada.
- Corrige exibição `NaN dias` para validade ausente/inválida.
- Reforça Realtime de `promotor_products`.
- Adiciona Ajustes > Verificar atualização.
- Service Worker passa a usar rede primeiro para HTML/JS/CSS e arquivo version.json sem cache.
- Inclui SUPABASE_V34_PROMOTOR_REALTIME.sql para habilitar Realtime e completar empresas antigas quando houver perfil.
