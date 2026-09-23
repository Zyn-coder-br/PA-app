# V17 — Sincronização automática após login

- Ao detectar uma sessão autenticada, o aplicativo tenta enviar automaticamente os produtos e as batidas locais para o Supabase.
- Depois do envio, carrega novamente os produtos e as batidas compartilhados do Supabase.
- A sincronização é protegida contra execuções simultâneas.
- Falhas são registradas no console sem apagar os dados locais.

## Limitação importante

O navegador não permite que o aplicativo conceda a permissão de notificações silenciosamente. Para receber notificações com o aplicativo fechado antes de fazer login, é necessário cadastrar previamente o aparelho no Web Push e ter uma Edge Function/servidor enviando os eventos. A V17 automatiza a sincronização no login, mas não implementa sozinha o envio Push global em segundo plano.
