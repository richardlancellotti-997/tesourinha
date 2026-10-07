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
- Correção após teste no iPhone real (06/10): a barra de navegação saía da tela ao trocar
  o tema várias vezes (bug do iOS com `position: fixed` em app instalado). Regra daqui em
  diante: NÃO usar `position: fixed` para elementos presos à tela; a página não rola, só a
  `.rolagem` dentro de `.app`, e a barra é a última linha do layout. A cor da barra de
  status fica em metas fixas por modo do sistema (não é trocada em tempo de execução).

### Etapa 2 concluída (06/10/2026)

- A fatura é identificada pelo mês em que FECHA (`faturaRef` "2026-10"). Vencimento no
  mesmo mês se o dia de vencimento é maior que o de fechamento; senão no mês seguinte.
  Dia 31 em mês curto vira o último dia.
- Compra antes do fechamento: fatura do mês; depois: a seguinte; NO dia: escolha
  obrigatória "Esta / Próxima" (sem pré-seleção). No dia do fechamento a fatura ainda
  está aberta.
- `faturaRef` é gravado em cada lançamento: mudar os dias do cartão NÃO move compras já
  lançadas. Editar uma compra sem mudar data/forma mantém a fatura original.
- Parcelas: um lançamento por parcela, todos com a DATA DA COMPRA (o resumo do mês soma
  a compra inteira no mês em que foi feita); cada parcela numa fatura consecutiva;
  sobra de centavos na 1ª. Até 24x. À vista no crédito não cria grupo.
- No Início a compra parcelada aparece numa linha só ("crédito em 3x"); tocar edita a
  compra toda. Na tela do cartão, tocar numa parcela pergunta (folha de escolha):
  "Editar só esta parcela" (valor, categoria, descrição) ou "Editar a compra toda"
  (regera todas as parcelas). Excluir segue o mesmo modo.
- Tela Cartão: navegação entre faturas, situação (Aberta/Fechada/Vencida/Paga; quitada
  antes de fechar já aparece como Paga), datas, barra de limite (esta fatura / outras
  em aberto / livre), próximas 3 faturas, compras, registrar pagamento (valor total em
  aberto, data de hoje) e desfazer. Pagamento parcial fica para depois.
  Pagamento só aparece da fatura atual para trás.
- Pagar a fatura não entra no resumo do mês (o gasto já contou na data da compra).
- Um cartão só na interface (o modelo aceita vários). Ajustes em Mais e no nome do cartão.

### Próximo: Etapa 3 (voucher)

1. Ajustes do voucher: valor mensal, dia do crédito, saldo acumula (padrão sim), dias
   da semana na empresa (padrão seg–sex).
2. Funções puras + testes: ciclo (do dia do crédito até a véspera do próximo, com dia 31),
   créditos mensais automáticos, saldo derivado, dias úteis restantes descontando
   feriados nacionais + Carnaval (seg e ter) + Sexta-feira Santa + Corpus Christi
   (cálculo da Páscoa), "dá para gastar por dia útil".
3. Liberar "Voucher" no lançamento, só com categorias permitidas no voucher.
4. Tela Voucher conforme o layout aprovado.

### Pendências para confirmar com o Richard

- Questões ainda abertas do briefing (seção 10): dados reais do cartão e do voucher
  (preenchidos pelo próprio usuário em Ajustes); receitas recorrentes (salário) na V1;
  preferências visuais da namorada.

### Ambiente

- Node 24 e Git portáteis em `%USERPROFILE%\Ferramentas` (no PATH do usuário).
  Se o VS Code não encontrar `git`/`npm`, fechar o VS Code por completo e reabrir.
- Comandos: `npm run dev` (local), `npm test`, `npm run build`.
