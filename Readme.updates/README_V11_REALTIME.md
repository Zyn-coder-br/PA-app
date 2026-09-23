# V11 — Notificações em tempo real

Esta versão amplia o Realtime do Supabase para as tabelas `batidas` e `products`.

## O que foi implementado

- Eventos de batidas recebidos pelo Supabase Realtime.
- Eventos de produtos recebidos pelo Supabase Realtime.
- Notificação usando `ServiceWorkerRegistration.showNotification`, para que o ícone do sistema seja aplicado pelo Service Worker.
- Ignora eventos produzidos pelo próprio usuário conectado, evitando avisos duplicados para a própria ação.
- Mantém o teste Android existente.

## Configuração necessária no Supabase

No painel do Supabase, confirme que `batidas` **e** `products` estão habilitadas em `Database → Publications → supabase_realtime`.

## Limite desta etapa

Esta etapa funciona enquanto o aplicativo/PWA está conectado ao Realtime. Para receber notificações com o aplicativo completamente fechado, ainda será necessário concluir Web Push com assinaturas, chaves VAPID e uma Edge Function segura.
