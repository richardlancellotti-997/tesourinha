=====================================================================
TESOURINHA - BRIEFING DO PROJETO
Documento de passagem de contexto para o desenvolvimento no VS Code
Data de redação: 05/10/2026
=====================================================================

COMO USAR ESTE DOCUMENTO
Este arquivo reúne tudo o que foi discutido e decidido na fase de
planejamento. Ao iniciar o projeto no VS Code, cole ou referencie este
texto no primeiro prompt (ou salve como CLAUDE.md / BRIEFING.md na raiz
do repositório) para que o assistente tenha todo o contexto.

Regra de trabalho combinada: o Claude toma as decisões técnicas, mas
AVISA o Richard de cada uma delas (stack, bibliotecas, estrutura), para
que ele tenha ciência de tudo que for criado. Antes de implementar a
interface, o Claude apresenta propostas de layout de cada tela para
aprovação e ajuste; só depois publica.


---------------------------------------------------------------------
1. VISÃO GERAL
---------------------------------------------------------------------
Nome do app: Tesourinha (alusão a "tesouraria").

Objetivo: aplicativo de finanças pessoais para o Richard registrar,
todo dia, o que gasta, assina e recebe, ter controle de onde o dinheiro
está indo e conseguir destiná-lo melhor.

Formato: PWA (Progressive Web App) instalado na tela inicial do iPhone.
Comporta-se como um app (ícone, tela cheia, funciona offline), sem
publicação em loja de aplicativos.

Usuários: uso pessoal do Richard e, separadamente, da namorada.
- Não há login, conta ou compartilhamento de dados.
- Cada pessoa instala no próprio iPhone e os dados ficam apenas no
  aparelho de cada um (separação natural).
- Um único repositório e um único endereço servem os dois. Na primeira
  abertura, cada pessoa define o próprio nome e a cor de destaque
  (personalização leve, "de acordo com o gosto de cada um").

Plataforma-alvo principal: iPhone (Safari / PWA instalado).
Idioma: português do Brasil. Moeda: Real (BRL).
Tema: claro e escuro automáticos, conforme a configuração do aparelho.

Privacidade: dados 100% locais. Sem nuvem, sem backend, sem conexão
bancária e sem Open Finance nesta fase. O servidor (hospedagem) só
entrega o código do app; nenhum lançamento passa por ele.


---------------------------------------------------------------------
2. HÁBITO DE USO (guia central de design)
---------------------------------------------------------------------
- Lançamento diário e manual: o Richard registra praticamente tudo o
  que compra, assina e o que é cobrado.
- Por isso, a VELOCIDADE DE LANÇAR é o critério número 1 do produto.
  Se registrar um gasto for lento, o app será abandonado.
  Meta: lançar um gasto comum em poucos toques, com valor, forma de
  pagamento e categoria na mesma tela.
- É comum esquecer de lançar algo na hora, então lançamentos
  retroativos (data editável), edição e exclusão são obrigatórios.


---------------------------------------------------------------------
3. ESCOPO DA VERSÃO 1 (V1)
---------------------------------------------------------------------

3.1 Formas de pagamento (distinção obrigatória)
  a) Débito / Pix  - sai na hora.
  b) Crédito       - vai para a fatura do cartão (ver seção 5).
  c) Voucher       - gasto abatido da carteira de vale-alimentação
                     (ver seção 6).

3.2 Gastos (despesas)
  - Valor, data (padrão: hoje, editável), forma de pagamento,
    categoria, descrição/observação opcional.
  - Editar e excluir qualquer lançamento.

3.3 Receitas (importante para o Richard)
  - Lançar entradas: salário, extras, pagamento por serviços externos,
    dinheiro emprestado que voltou, valores a receber de outras
    pessoas, etc.
  - Suporte a "A RECEBER": a receita pode ficar PREVISTA (com data
    esperada e, opcionalmente, quem vai pagar) e depois ser marcada
    como RECEBIDA. Receitas previstas aparecem separadas das efetivadas
    e não entram no saldo realizado até serem confirmadas.
  - O crédito mensal do vale-alimentação entra automaticamente na
    carteira de voucher (não é lançado manualmente).

3.4 Parcelamento (no crédito)
  - O usuário lança a compra UMA vez (valor total + nº de parcelas).
  - O app distribui as parcelas automaticamente nas faturas seguintes.
  - Ex.: R$ 600 em 3x = 3 parcelas de R$ 200 em 3 faturas consecutivas.
  - Deve tratar centavos de forma correta (a diferença de arredondamento
    vai para a primeira ou a última parcela).
  - Editar/excluir uma compra parcelada deve perguntar se afeta só
    aquela parcela ou todas.

3.5 Recorrências e assinaturas
  - Cadastro único de uma despesa recorrente (assinatura, mensalidade,
    aluguel etc.): nome, valor, dia do mês, forma de pagamento,
    categoria.
  - O app lança sozinho a cada mês na data correta.
  - O valor pode ser ajustado quando mudar (a alteração vale dali em
    diante, sem reescrever o histórico).
  - Possibilidade de pausar/encerrar a recorrência.
  - Tela de listagem das assinaturas ativas com o total mensal.

3.5.1 Receitas recorrentes (opcional na V1, desejável)
  - Mesmo mecanismo para salário fixo.

3.6 Categorias
  - Lista padrão editável: mercado, restaurantes, transporte, moradia,
    assinaturas, saúde, lazer, compras, outros.
  - O usuário pode renomear, apagar e criar novas.
  - Categorias de receita separadas (ex.: salário, serviços,
    reembolso/empréstimo, outros).
  - O voucher usa um subconjunto de categorias (ex.: mercado e
    restaurantes).

3.7 Resumo do mês
  - Quanto entrou, quanto saiu, quanto sobrou.
  - Para onde o dinheiro foi (por categoria), com gráficos.
  - Visão separada por forma de pagamento (débito/pix, crédito,
    voucher).
  - Navegação entre meses.

3.8 Backup (obrigatório)
  - Botão EXPORTAR: gera arquivo (JSON completo para restauração; CSV
    opcional para uso em planilha). O Richard já tem uma pasta
    destinada a receber os backups.
  - Botão IMPORTAR: restaura a partir do JSON exportado.
  - Pedir ao navegador armazenamento persistente
    (navigator.storage.persist()) para reduzir o risco de limpeza
    automática pelo iOS.
  - Sugestão: lembrete discreto de backup (ex.: se passaram mais de 30
    dias desde o último export).

3.9 Configurações
  - Cartão de crédito (ver seção 5): nome, dia de fechamento, dia de
    vencimento, limite (opcional).
  - Voucher (ver seção 6): valor mensal, dia do crédito.
  - Categorias.
  - Perfil: nome e cor de destaque.
  - Backup (exportar/importar).

FORA DO ESCOPO DA V1 (ficam para depois)
  - Múltiplos cartões na interface (a estrutura de dados já os prevê).
  - Metas e "caixinhas" (reserva de emergência, viagem, etc.).
  - Método de divisão da renda (ex.: 50/30/20) com planejado x
    realizado.
  - Orçamento por categoria com alertas.
  - Insights automáticos ("gastou 30% a mais com delivery").
  - Importação de extratos (CSV/OFX).
  - Sincronização em nuvem e Open Finance.
  - Saldo de contas bancárias.


---------------------------------------------------------------------
4. FASEAMENTO SUGERIDO (roadmap)
---------------------------------------------------------------------
Etapa 0 - Fundação: repositório, Vite + TS, PWA instalável no iPhone,
          deploy no GitHub Pages, banco local, telas vazias.
Etapa 1 - Núcleo: categorias, lançar/editar/excluir gasto e receita,
          débito/pix, lista de lançamentos, resumo do mês simples.
Etapa 2 - Crédito: cadastro do cartão, faturas, parcelamento.
Etapa 3 - Voucher: carteira, crédito mensal automático, saldo e
          disponível por dia.
Etapa 4 - Recorrências/assinaturas e receitas a receber.
Etapa 5 - Backup (exportar/importar), personalização do perfil,
          acabamento visual, testes no iPhone real.
Pós-V1  - Orçamento, metas/caixinhas, divisão da renda, insights,
          importação de extratos, múltiplos cartões na interface.

Ordem pode ser ajustada, mas o backup (Etapa 5) não deve ser deixado
para muito tarde: assim que houver dados reais sendo lançados, o
export precisa existir.


---------------------------------------------------------------------
5. REGRAS DO CARTÃO DE CRÉDITO
---------------------------------------------------------------------
Hoje há um único cartão, mas o modelo de dados trata o cartão como
entidade própria (ver seção 8), para permitir mais cartões no futuro
sem migração. Na V1 a interface esconde o seletor de cartão.

Configuração (editável): nome, dia de fechamento, dia de vencimento,
limite (opcional). O Richard tem esses dados e vai preencher na
configuração; NÃO fixar valores no código.

Regra de atribuição à fatura:
  - Compra feita ATÉ o dia de fechamento (inclusive, a confirmar com o
    comportamento real do banco) entra na fatura que fecha naquele mês.
  - Compra feita DEPOIS do fechamento entra na fatura do mês seguinte.
  - O vencimento da fatura costuma cair no mês seguinte ao do
    fechamento (ou no mesmo mês, dependendo do cartão); calcular a
    partir dos dois dias configurados.
  - Meses com menos dias que o dia configurado (ex.: dia 31 em
    fevereiro): usar o último dia do mês.
  - Parcelas: cada parcela cai em uma fatura consecutiva, a partir da
    fatura da compra.

Telas/visões esperadas:
  - Fatura atual: total já comprometido, data de fechamento e de
    vencimento, lista de compras.
  - Próximas faturas (já comprometidas por parcelas e recorrências).
  - Fatura marcada como paga (registra o pagamento).


---------------------------------------------------------------------
6. REGRAS DO VOUCHER (VALE-ALIMENTAÇÃO)
---------------------------------------------------------------------
Funciona como uma CARTEIRA COM SALDO:
  - Todo mês, em DATA FIXA (configurável), entra um valor (configurável)
    que o Richard recebe de vale-alimentação.
  - Cada gasto no voucher abate desse saldo.
  - O app mostra: saldo atual, quanto já foi gasto no ciclo e quanto
    dá para gastar POR DIA até o próximo crédito
    (saldo / dias restantes).
  - O ciclo vai de um dia de crédito até o dia anterior ao próximo.
  - Gastos no voucher são categorizados (mercado, restaurantes etc.),
    o que ajuda a organizar melhor.
  - Hipótese a confirmar com o Richard: o saldo que sobra no ciclo
    ACUMULA para o próximo (comportamento usual do vale-alimentação).
    Deixar como configuração, com acumular como padrão.


---------------------------------------------------------------------
7. DIREÇÃO VISUAL
---------------------------------------------------------------------
Identidade: uso pessoal, SEM relação com a Emcash. Não usar a skill
nem os tokens de marca da Emcash.

Referência de processo: skill "frontend-design" instalada (diretrizes
de design distinto e intencional, fugindo do "padrão de IA").

Instruções para o assistente ao desenhar a interface:
  1. Antes de escrever código de UI, produzir um PLANO DE DESIGN curto
     com: paleta (4-6 cores nomeadas com hex), tipografia (famílias e
     papéis), conceito de layout (descrição + wireframes ASCII) e
     princípios.
  2. Revisar o plano contra o briefing: se qualquer parte parecer o
     padrão genérico que serviria para qualquer app, revisar e dizer o
     que mudou e por quê.
  3. Apresentar ao Richard as PROPOSTAS DE LAYOUT de cada tela
     (lançamento rápido, início/resumo, fatura, voucher, assinaturas,
     receitas, configurações) para aprovação e ajustes ANTES de
     publicar.
  4. A identidade deve nascer do assunto: dinheiro no dia a dia,
     tesouraria. Evitar escolhas arbitrárias.

Evitar (tells de design genérico):
  - Fundo creme com serifa de alto contraste e acento terracota.
  - Fundo quase preto com um único acento verde-ácido/vermelhão.
  - Tudo em cartões arredondados idênticos, mesma sombra cinza,
    gradientes decorativos.
  - Rótulos em CAIXA-ALTA espaçada acima de cada título; textos
    "A · B · C" com pontos médios; "→" em todo botão; fonte
    monoespaçada para qualquer rótulo pequeno.
  - Destacar uma única palavra de um título em itálico/cor.
  - Numeração decorativa (01/02/03) quando o conteúdo não é sequência.
  - Animações de entrada em todas as seções e hover em todo cartão.

Princípios a seguir:
  - Gastar a "ousadia" em UM elemento memorável; o resto discreto e
    disciplinado. Para um app de uso diário, a tela de lançamento
    rápido deve ser a protagonista: clara, rápida, sem enfeite.
  - Movimento apenas como resposta a ações (abrir, confirmar,
    expandir); respeitar prefers-reduced-motion.
  - Tipografia escolhida de forma deliberada, com escala definida,
    linhas de texto curtas, hierarquia por peso/tamanho.
  - Acessibilidade: contraste adequado, foco visível, alvos de toque
    confortáveis, funcionamento em modo claro e escuro.
  - Textos de interface: português claro, voz ativa, frases em caixa
    normal. Botões dizem exatamente o que fazem ("Salvar gasto").
    Mesma palavra para a mesma ação em todo o fluxo. Estados vazios
    convidam à ação; erros explicam o que houve e como resolver, sem
    pedir desculpas.
  - Gráficos: consultar também a skill "dataviz" ao desenhar os
    gráficos (paleta consistente, claro/escuro, acessibilidade).

Adequação ao iPhone:
  - Respeitar áreas seguras (notch e barra inferior):
    viewport-fit=cover e env(safe-area-inset-*).
  - Controles principais ao alcance do polegar (ações na parte de
    baixo da tela, não em menus no topo).
  - Campo de valor com teclado numérico (inputmode="decimal") e
    fonte mínima de 16px em campos para evitar zoom automático do
    Safari.
  - Ícone de tela inicial (apple-touch-icon), meta tags de web app,
    manifest, tela cheia (display: standalone).
  - Testar sempre no iPhone real, instalado na tela inicial.


---------------------------------------------------------------------
8. DECISÕES TÉCNICAS (propostas; o Claude pode ajustar e deve avisar)
---------------------------------------------------------------------
  - Build: Vite + TypeScript.
  - Interface: Preact (leve, componentes, mesma ideia do React) ou
    equivalente leve; a confirmar e informar ao Richard na Etapa 0.
  - PWA: vite-plugin-pwa (manifest, service worker, cache offline).
  - Armazenamento local: IndexedDB, via biblioteca Dexie.
  - Hospedagem: GitHub Pages (estático, HTTPS), com deploy automático
    por GitHub Actions. Atenção ao caminho base (base path) do Vite,
    pois o app ficará em um subcaminho do domínio.
  - Valores monetários: SEMPRE em inteiros (centavos) para evitar erro
    de ponto flutuante. Formatar apenas na exibição (Intl.NumberFormat
    pt-BR / BRL).
  - Datas: guardar como data local (AAAA-MM-DD) para evitar problemas
    de fuso horário. Fuso de referência: America/Sao_Paulo.
  - Cálculos de fatura, parcelas, recorrências e ciclo do voucher
    ficam em funções puras e isoladas, com TESTES AUTOMATIZADOS
    (ex.: Vitest), incluindo casos de borda (dia 31, fevereiro, virada
    de ano, compra exatamente no dia do fechamento).
  - Migrações: versionar o esquema do banco desde o início (Dexie
    versions) e incluir "versão do esquema" no arquivo de backup.
  - Sem backend, sem analytics, sem rastreamento, sem chamadas de rede
    com dados do usuário.
  - Repositório privado ou público: avaliar; o código não contém dados
    pessoais (os dados ficam no aparelho). Se público, nunca commitar
    backups.


---------------------------------------------------------------------
9. MODELO DE DADOS (rascunho)
---------------------------------------------------------------------
Todos os valores em centavos (inteiros). Todos os registros com id,
createdAt, updatedAt.

Profile        : nome, corDestaque, tema(auto/claro/escuro),
                 versaoEsquema, ultimoBackupEm
Category       : nome, tipo(despesa|receita), icone/cor(opcional),
                 ordem, arquivada, permitidaNoVoucher(bool)
Card           : nome, diaFechamento, diaVencimento, limite(opcional),
                 arquivado
Transaction    : tipo(despesa|receita), valor, data, categoriaId,
                 descricao, formaPagamento(debito_pix|credito|voucher),
                 cardId(se crédito), faturaRef(se crédito: mês/ano de
                 competência da fatura), parcelaGrupoId,
                 parcelaNumero, parcelaTotal, recorrenciaId(se gerado
                 por recorrência)
IncomeExpected : (receita prevista/a receber) valor, dataPrevista,
                 categoriaId, descricao, devedor/origem(opcional),
                 status(prevista|recebida), dataRecebimento
                 -> ao receber, gera Transaction do tipo receita.
                 (Alternativa: campo "status" direto em Transaction.)
Recurrence     : nome, tipo, valor, diaDoMes, formaPagamento,
                 categoriaId, cardId, inicio, fim(opcional),
                 ativa, historicoDeValores
VoucherConfig  : valorMensal, diaCredito, acumulaSaldo(bool)
VoucherLedger  : (opcional) créditos mensais efetivados
InvoicePayment : cardId, faturaRef, valorPago, dataPagamento

Observação: o saldo do voucher e o total da fatura são DERIVADOS dos
lançamentos, não armazenados, para evitar inconsistência.


---------------------------------------------------------------------
10. QUESTÕES EM ABERTO (confirmar durante o desenvolvimento)
---------------------------------------------------------------------
  1. Dados do cartão: dia de fechamento, dia de vencimento e limite
     (Richard tem esses dados e vai preencher na configuração).
  2. Dados do voucher: valor mensal e dia do crédito (idem).
  3. O saldo do voucher acumula de um mês para o outro? (hipótese:
     sim, configurável).
  4. No resumo do mês, compras no crédito devem ser contadas pela
     DATA DA COMPRA (mostra onde o dinheiro foi gasto) ou pela FATURA
     (mostra o que sai de caixa)? Proposta: o resumo principal usa a
     data da compra; a visão de fatura mostra o impacto no caixa.
  5. Compra no dia exato do fechamento entra na fatura que fecha ou
     na seguinte? Confirmar com o comportamento do banco do Richard.
  6. Receitas recorrentes (salário) entram na V1 ou logo depois?
  7. Existe alguma cor, referência visual ou app que o Richard e a
     namorada gostem (ou detestem) para orientar a estética?
  8. Repositório público ou privado no GitHub.


---------------------------------------------------------------------
11. PRIMEIRO PROMPT SUGERIDO PARA O VS CODE
---------------------------------------------------------------------
"Leia o BRIEFING.md na raiz do projeto. Vamos construir o Tesourinha,
um PWA de finanças pessoais para iPhone, seguindo o briefing. Comece
pela Etapa 0 (fundação): proponha a estrutura do projeto e a stack
detalhada, me avise de cada decisão técnica, e só depois crie os
arquivos. Antes de qualquer tela, siga a seção 7 e me apresente o
plano de design e as propostas de layout para eu aprovar."

=====================================================================
FIM DO DOCUMENTO
=====================================================================
