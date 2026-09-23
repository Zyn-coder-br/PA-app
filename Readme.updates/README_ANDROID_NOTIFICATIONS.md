# Teste de notificações Android

A versão inclui o botão **Testar barra Android** em Ajustes.

## Como testar corretamente

1. Publique os arquivos em HTTPS, por exemplo no GitHub Pages.
2. Abra o endereço publicado no Android Chrome.
3. Autorize as notificações.
4. Instale o PWA na tela inicial, se possível.
5. Entre em Ajustes e toque em **Testar barra Android**.
6. Confira a barra de notificações do Android.

## Limitação importante

Esse botão testa uma notificação local exibida pelo Service Worker. O envio remoto quando o aplicativo está fechado ainda depende de Web Push, inscrição do dispositivo, VAPID e uma Edge Function/backend seguro.

Os arquivos em `sounds/` são toques originais de referência para futuras integrações. A API de notificações Web não permite escolher livremente um arquivo de áudio como som do aviso do Android; o som do sistema/navegador pode prevalecer. Para som personalizado garantido será necessário um aplicativo nativo ou uma camada Android específica.


## V7 — Teste Android

O botão de teste usa Service Worker `showNotification`, inclui vibração quando o Android/navegador permitir e utiliza uma tag única para evitar que um teste substitua o anterior. O som personalizado ainda não pode ser forçado por Web Push no navegador; ele depende das configurações do Android/canal de notificação.


## V8 — Logo nas notificações

As notificações locais e a base de Web Push usam `icons/notification-logo.png` como `icon` e `badge`. O cache do Service Worker foi atualizado para forçar a carga do novo recurso.


## V9 — Ícone do sistema e histórico de corredores

A V9 usa um ícone monocromático transparente próprio para a área de status do Android. A tela Batidas → Histórico agora mostra a supervisão dos corredores com contagem crescente de dias, faixas verde/amarela/vermelha e histórico de batidas finalizadas.
