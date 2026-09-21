# Integração Supabase — etapa inicial VPA V8.2.6

Esta etapa adiciona apenas um bootstrap não invasivo para preparar a integração.

- O IndexedDB continua sendo o armazenamento principal.
- Nenhum produto, batida ou corredor é enviado ao Supabase.
- Nenhuma tabela existente é alterada.
- Não coloque uma `service_role key` no aplicativo.
- A chave pública só deve ser configurada quando a próxima etapa de autenticação/sincronização for validada.

## Diagnóstico

Abra o console do navegador (F12) e procure:

`[VPA] Supabase bootstrap carregado:`

A mensagem deverá indicar que a configuração ainda não está ativa, porque os valores estão vazios.
