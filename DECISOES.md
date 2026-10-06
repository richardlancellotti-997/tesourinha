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
- Feriados nacionais são descontados (fixos + móveis: Carnaval, Sexta-feira Santa,
  Corpus Christi). Feriados estaduais/municipais ficam fora por enquanto.
- O saldo que sobra acumula para o próximo ciclo (configurável).

## Onde paramos (05/10/2026)

- Etapa 0 concluída e publicada em https://richardlancellotti-997.github.io/tesourinha/
  (deploy automático a cada push na `main`).
- Plano de design e layouts APROVADOS. Etapa 1 APROVADA para começar.

### Próximo: Etapa 1 (núcleo)

1. Aplicar o visual aprovado na base: tokens de cor claro/escuro, tema automático/manual,
   Archivo empacotada localmente (ex.: `@fontsource-variable/archivo`), barra de navegação.
2. Categorias padrão (despesa e receita) criadas na primeira abertura; editar, renomear,
   arquivar e criar.
3. Tela de lançamento com teclado em centavos: gasto e receita, data editável, descrição,
   forma de pagamento (lembra a última), categoria. Débito/Pix nesta etapa.
4. Editar e excluir lançamentos.
5. Início: resumo do mês (entrou, saiu, sobrou, por forma de pagamento), barras por
   categoria, lista no formato livro-caixa, navegação entre meses.
6. Testes das funções puras de resumo e agrupamento.

### Pendências para confirmar com o Richard

- Carnaval e Corpus Christi (ponto facultativo) estão FORA da conta de dias úteis do
  voucher por padrão. Confirmar se a empresa dele funciona nesses dias.
- Questões ainda abertas do briefing (seção 10): dados reais do cartão e do voucher
  (preenchidos pelo próprio usuário em Ajustes); receitas recorrentes (salário) na V1;
  preferências visuais da namorada.

### Ambiente

- Node 24 e Git portáteis em `%USERPROFILE%\Ferramentas` (no PATH do usuário).
  Se o VS Code não encontrar `git`/`npm`, fechar o VS Code por completo e reabrir.
- Comandos: `npm run dev` (local), `npm test`, `npm run build`.
