# Zyn Assistente — V2.0.7

Base: V2.0.3 (última versão aprovada pelo usuário).

## Dieta 1.1
- Refeições de hoje agora são registros reais e editáveis, não apenas conteúdo visual de fallback.
- Primeira abertura sem refeições cria apenas as 4 refeições padrão do dia atual; depois disso elas podem ser editadas ou excluídas sem reaparecer automaticamente.
- Cada refeição possui editar e excluir.
- Modal de edição de refeição também permite excluir.
- Planejamento semanal permite editar/excluir cada refeição.
- Biblioteca de alimentos permite editar/excluir.
- Lista de compras permite marcar, excluir item individual e limpar a lista inteira.
- Geração semanal evita duplicar refeições já existentes.
- Não altera a versão do IndexedDB (mantém DB_VERSION 12).

## Validação
- app.js: node --check OK
- sw.js: node --check OK
- index.html e assets permanecem na raiz do ZIP.


## Ajuste de ganhos 2.0.7
- Histórico semanal de ganhos dentro de Planejar > Metas.
- Editar ganho existente, inclusive corrigindo a data.
- Excluir ganho existente.
- Toque em qualquer dia do progresso diário para abrir os ganhos daquele dia.
- Registro pode ser criado já com a data do dia selecionado.
- Não altera DB_VERSION (permanece 12).
