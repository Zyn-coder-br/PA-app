# Vencimento PA V57

## Correções e melhorias

### 1. Lista plana de produtos
- Removido o agrupamento visual por data de registro (modo "extrato").
- Produtos agora aparecem em uma única lista contínua.
- Ordenação por dias restantes até o vencimento, do menor para o maior.
- Exemplo: 19 dias → 20 dias → 39 dias.
- Aplicado também às listas de vencimentos, produtos da batida e pendências.
- Mantida a paginação de 20 itens por página.

### 2. Importação Excel inteligente
- O leitor não depende mais de uma planilha com cabeçalhos exatamente iguais aos modelos anteriores.
- Detecta automaticamente a linha de cabeçalho entre as primeiras linhas da planilha.
- Aceita variações de cabeçalho com acentos, espaços e textos adicionais.
- Identifica as informações principais:
  - PLU
  - EAN / código de barras
  - Descrição do produto
  - Data inicial / data de entrada
  - Data de vencimento / validade
- Campos extras como Ativa, Usuário, PLU Digital, PLU Rebaixa, Valor etc. não são importados para o cadastro principal.
- Quando uma informação principal não existir, a prévia mostra N/A.
- A importação FEFO passa a armazenar a data inicial do produto.
- A Lista Crítica usa o mesmo reconhecimento inteligente.

### 3. Cadastro manual
- Adicionado o campo Data inicial do produto.
- O campo é preservado no cadastro local e na sincronização com Supabase.
- A lista mostra o código disponível (EAN ou PLU) e a data inicial quando cadastrada.

### 4. Cache
- Service Worker atualizado para V57 para evitar que o celular continue usando a versão anterior.

## Validação técnica
- `node --check app.js` OK
- `node --check supabase-client.js` OK
