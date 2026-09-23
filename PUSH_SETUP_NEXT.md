# Push Foundation V1 — Vencimento PA

Esta versão prepara o Service Worker para receber notificações Web Push.

## O que foi incluído

- Tratamento do evento `push`.
- Exibição de título, mensagem, ícone, badge e tag.
- Tratamento do clique na notificação.
- Tentativa de focar uma janela já aberta ou abrir o aplicativo.
- Atualização do nome do cache para forçar a atualização do Service Worker.

## O que ainda falta para o Push Android completo

1. Criar a tabela `push_subscriptions` no Supabase.
2. Registrar a assinatura do dispositivo no Supabase.
3. Criar chaves VAPID.
4. Guardar a chave privada VAPID apenas nos secrets de uma Edge Function/backend.
5. Criar a Edge Function responsável por enviar notificações para todos os usuários necessários.
6. Conectar os eventos do aplicativo às notificações: FEFO, vencimentos, PIQUE e atualizações de promotor.

**Importante:** esta etapa não afirma que o envio automático já está ativo. Ela prepara a parte do Service Worker sem expor chaves privadas.
