# Decisões aprovadas

Complementa o [BRIEFING.md](BRIEFING.md). Quando os dois divergirem, vale este arquivo.

## Design (aprovado em 05/10/2026)

Plano completo e telas: https://claude.ai/artifact/YN9n7UbNbjMFK9WJnjk7nV

- Conceito: tesouraria de bolso. Valores em Archivo larga (125%) e pesada, como o valor
  impresso numa cédula; listas no formato de livro-caixa (dia em destaque à esquerda).
- Tipografia: só Archivo (variável, com eixo de largura), sempre com números tabulares.
  Precisa ser empacotada no app (funcionar offline), não carregada do Google Fonts.
- Cores de base (claro / escuro): Papel #F6F7F4 / #14171B, Folha #FFFFFF / #1D2126,
  Tinta #1B1F24 / #E9EBE7, Grafite #5B626A / #9BA2A9, Entrada #1D7A4E / #5FC48F,
  Negativo #B3261E / #FF8A80.
- Gastos usam a cor da tinta com sinal "−"; só receitas ficam verdes; vermelho só para
  atraso e saldo negativo.
- Cor de destaque escolhida por pessoa: Caneta #2442C9 (padrão), Lilás #7445B0,
  Petróleo #0E6E78, Ameixa #A1336F, Grafite #3A4250. No escuro, o destaque é clareado.
- Categorias (ordem fixa; claro / escuro), validadas com o validador de paletas:
  Transporte #2F6FA8 / #5B95E0, Restaurantes #C2552D / #D96C47, Mercado #1F8A5A / #33A56F,
  Assinaturas #7445B0 / #9C7BDB, Lazer #B87A00 / #B8841A, Saúde #B23A5E / #D96C90,
  Compras #008CB0 / #22A6B8, Moradia #9A6420 / #BC8547, Outros #7A8088 / #8E959C.
  Sempre com ícone + nome (separação para daltonismo entre verde e laranja fica na faixa mínima).
- Tema: automático (segue o iPhone), claro ou escuro, escolhido em Ajustes.
- Navegação: barra inferior Início, Cartão, [+ Lançar], Voucher, Mais.
  "Mais" reúne Assinaturas, Receitas, Categorias e Ajustes.
- Gráficos: barras horizontais ordenadas (sem rosca).

## Lançamento

- Teclado próprio estilo caixa registradora: dígitos entram pelos centavos
  (2590 = 25,90). Substitui o `inputmode="decimal"` do briefing no campo de valor.
- A forma de pagamento já vem com a última usada.
- Crédito: escolha de parcelas na mesma tela, mostrando o valor de cada parcela
  (sobra de centavos na primeira).

## Cartão de crédito

- O resumo do mês conta o crédito pela DATA DA COMPRA; a tela do cartão mostra o
  impacto em cada fatura.
- Compra no crédito feita no DIA DO FECHAMENTO: o app pergunta "Esta fatura" ou
  "Próxima fatura", sem opção pré-selecionada; não salva sem a escolha.
  Nos demais dias a fatura é atribuída automaticamente.

## Voucher

- Destaque da tela: "Dá para gastar por dia útil" = saldo ÷ dias na empresa restantes
  no ciclo (contando hoje, se for dia na empresa).
- Dias na empresa configuráveis por dia da semana em Ajustes; padrão segunda a sexta.
- Feriados nacionais são descontados (fixos + móveis: Sexta-feira Santa). Carnaval
  (segunda e terça) e Corpus Christi também são descontados: a empresa do Richard não
  funciona nesses dias (confirmado em 06/10/2026). Estaduais/municipais ficam fora por enquanto.
- O saldo que sobra acumula para o próximo ciclo (configurável).

## Onde paramos (05/10/2026)

- Etapa 0 concluída e publicada em https://richardlancellotti-997.github.io/tesourinha/
  (deploy automático a cada push na `main`).
- Plano de design e layouts APROVADOS. Etapa 1 APROVADA para começar.

### Etapa 1 concluída (06/10/2026)

- Visual aprovado aplicado (tokens claro/escuro, tema automático/claro/escuro, Archivo
  empacotada via `@fontsource-variable/archivo/wdth.css`, ícone definitivo).
- Boas-vindas na primeira abertura (nome + cor de destaque).
- Lançar com teclado em centavos; gasto e receita; data editável; descrição; forma de
  pagamento lembrando a última; Crédito e Voucher aparecem desabilitados até as Etapas 2 e 3.
  Receita nesta etapa é sempre "recebida" (a receber chega na Etapa 4).
- Editar/excluir: tocar no lançamento da lista abre a mesma tela em modo edição.
- Início com resumo, barras (5 maiores + "Demais"), livro-caixa e navegação entre meses
  (não avança além do mês atual por enquanto).
- Categorias: criar, renomear, cor, ícone, "pode ser paga com voucher". Apagar uma
  categoria com lançamentos ARQUIVA (some do lançamento, histórico mantém o nome).
- Backup ADIANTADO da Etapa 5: exportar JSON (folha de compartilhamento do iPhone →
  "Salvar em Arquivos") e importar (substitui tudo, com confirmação). Lembrete no Início
  após 30 dias sem backup (ou nenhum backup com 10+ lançamentos).
- Testado em navegador simulando iPhone (Edge headless + playwright-core no scratchpad).

### Próximo: Etapa 2 (cartão de crédito)

1. Ajustes do cartão (nome, dia de fechamento, dia de vencimento, limite opcional).
2. Atribuição à fatura (funções puras + testes: dia 31, fevereiro, virada de ano, compra
   no dia do fechamento) e a escolha "Esta fatura / Próxima" no dia do fechamento.
3. Parcelamento no lançamento; editar/excluir parcela pergunta "só esta ou todas".
4. Tela Cartão: fatura atual, próximas faturas, compras, registrar pagamento.

### Pendências para confirmar com o Richard

- Questões ainda abertas do briefing (seção 10): dados reais do cartão e do voucher
  (preenchidos pelo próprio usuário em Ajustes); receitas recorrentes (salário) na V1;
  preferências visuais da namorada.

### Ambiente

- Node 24 e Git portáteis em `%USERPROFILE%\Ferramentas` (no PATH do usuário).
  Se o VS Code não encontrar `git`/`npm`, fechar o VS Code por completo e reabrir.
- Comandos: `npm run dev` (local), `npm test`, `npm run build`.
