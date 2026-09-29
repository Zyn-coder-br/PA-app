# Vencimento PA — Web Push fora do aplicativo

A V53 já tinha Service Worker e notificações locais. A V54 adiciona a inscrição Web Push e a função Supabase que envia notificações mesmo com o PWA fechado.

## 1. Banco
No Supabase SQL Editor, execute `supabase/vpa_push_schema.sql`.

## 2. Gerar chaves VAPID
Abra `tools/gerar-vapid-keys.html` localmente. Copie a chave pública para a tabela `vpa_push_settings` e guarde a chave privada somente como secret no Supabase.

## 3. Secrets da Edge Function
Configure: `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente da Edge Function.

## 4. Deploy
Faça deploy da função `supabase/functions/vpa-push`.

## 5. Agendamento de validade
Agende a operação `expiry_digest` uma vez por dia no Supabase. A função monta **uma única notificação-resumo** com os grupos de validade.

## 6. Importante
Sem os passos 1–5, o aplicativo continua funcionando com as notificações locais/Realtime já existentes, mas não há garantia de entrega com o PWA totalmente fechado.
