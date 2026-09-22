# V13 — Correção do Realtime de produtos

A V12 já tentava assinar a tabela `products`, mas a tabela também precisa estar incluída na publicação `supabase_realtime`. A V13 inclui o SQL `SUPABASE_V13_REALTIME_PRODUCTS.sql` para habilitar isso sem duplicar a entrada.

Também foram adicionados:

- feedback visível quando o envio automático do produto/FEFO falha;
- confirmação no console quando os canais de Realtime de batidas e produtos ficam `SUBSCRIBED`;
- aviso quando o produto é salvo localmente, mas não chega ao Supabase.

Depois de executar o SQL, publique os arquivos e teste com dois usuários autenticados.
