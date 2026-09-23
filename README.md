# Vencimento PA Local — V8

PWA local para controle de vencimentos, batidas e pendências.

## Atualizações desta versão
- Subcategorias de Vencimentos: hoje, amanhã, 2–10 dias, 11–30 dias e 31 dias+.
- Contagem regressiva de dias em cada produto.
- Pendências separadas em PIQUE e PIQUE FEFO.
- Seleção em massa: marcar/desmarcar, alterar status, adicionar tag PLU/ETIQUETA e excluir.
- Campo de tag PLU/ETIQUETA e identificação de produto FEFO no cadastro.
- Cancelamento de batida em andamento sem marcar o corredor como conferido.
- Finalização de batida continua bloqueada sem produto.
- Navegação flutuante no canto inferior direito.
- Banco local via IndexedDB, backup/restauração e tema claro/escuro.
- Leitor EAN e consulta à Open Food Facts mantidos.

## Publicação pelo celular
Suba os arquivos desta pasta na raiz do repositório do GitHub Pages ou substitua os arquivos da versão anterior. Aguarde o GitHub Pages atualizar e faça uma atualização forçada no navegador.


V3 visual: painel com hero verde e identidade visual profissional, preservando a navegação e os módulos existentes.


## V6.1 - Ajuste reforçado de espaçamento
- Aumentado o espaço entre cards e blocos do painel.
- Aplicados espaçamentos verticais e horizontais com seletores específicos.
- Mantida a lógica JavaScript original da V8.2.6.

## V15 — Correção de inicialização e canais Realtime

- Evita a criação concorrente de múltiplos clientes Supabase.
- Evita assinar o mesmo canal Realtime mais de uma vez.
- Remove a validação incorreta que tratava o objeto de canal retornado por `subscribe()` como se fosse um status textual.
- Mantém os canais de `batidas` e `products` compartilhados.

## V16 — Cadastro dos corredores no Supabase

Antes de sincronizar produtos ou batidas, execute `SUPABASE_V16_SEED_CORRIDORS.sql` no SQL Editor do Supabase. O aplicativo usa o número do corredor local para localizar o registro correspondente na tabela `corridors`. Sem esses registros, a sincronização falha com a mensagem "Corredor X não encontrado no Supabase".

## V18 — Exclusão compartilhada de produtos

A exclusão de produtos agora tenta remover o registro no Supabase antes de remover o item do armazenamento local. O evento `DELETE` do Realtime usa o registro antigo (`old`) para retirar o mesmo produto dos demais dispositivos conectados.

Execute `SUPABASE_V18_DELETE_SHARED_PRODUCTS.sql` no SQL Editor do Supabase para habilitar a política de exclusão autenticada e o `REPLICA IDENTITY FULL`.
