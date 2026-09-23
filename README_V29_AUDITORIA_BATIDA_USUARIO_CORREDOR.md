# V29 — Auditoria de batida, usuário e corredor sugerido

## Correções

- Produtos cadastrados em uma batida aberta permanecem fora da lista geral até a finalização.
- Preserva `origemCadastro`, `categoriaCadastro` e `batchId` locais quando o Supabase não devolve `app_metadata` em uma resposta.
- Adiciona fallback para identificar produtos de batida sem `batchId`, usando origem, corredor e horário.
- Saudação do painel inicial usa o usuário autenticado em vez de nome fixo.
- Corredor sugerido é ordenado pelo maior tempo sem batida; corredores nunca conferidos têm prioridade máxima.

## Observação sobre Supabase

A auditoria desta versão foi feita no código local e no mapeamento do cliente Supabase. A validação das políticas/RLS e dos dados efetivos do projeto remoto exige acesso ao painel do projeto Supabase ou execução dos SQLs de diagnóstico.
