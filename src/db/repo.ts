// Operações de leitura e escrita usadas pelas telas.

import { CATEGORIAS_PADRAO, type CorCategoria, type IconeCategoria } from '../domain/categories'
import type { Cents } from '../domain/money'
import { addDays, yearMonthOf, type LocalDate, type YearMonth } from '../domain/dates'
import { faturaDaCompra, faturaPelaData, mesNoBalanco, parcelar } from '../domain/invoice'
import { comNovoValor, datasEntre, valorNaData } from '../domain/recurrence'
import { cicloDe, creditosEntre, ritmoDoCiclo, saldoVoucher, valorDoCredito, type Ciclo, type Ritmo } from '../domain/voucher'
import { db, newId, nowISO } from './db'
import type { Card, Category, Kind, PaymentMethod, Profile, Recurrence, Transaction, VoucherConfig } from './types'

export const PERFIL_ID = 'perfil'

/** Cria as categorias padrão na primeira abertura. Pode rodar quantas vezes for preciso. */
export async function garantirDadosIniciais(): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    if ((await db.categories.count()) > 0) return
    const agora = nowISO()
    await db.categories.bulkAdd(
      CATEGORIAS_PADRAO.map((c, i) => ({
        ...c,
        ordem: i,
        arquivada: false,
        createdAt: agora,
        updatedAt: agora,
      })),
    )
  })
}

export async function salvarPerfil(dados: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const agora = nowISO()
  await db.transaction('rw', db.profile, async () => {
    const atual = await db.profile.get(PERFIL_ID)
    await db.profile.put({
      nome: '',
      corDestaque: '#2442C9',
      tema: 'auto',
      createdAt: agora,
      ...atual,
      ...dados,
      id: PERFIL_ID,
      updatedAt: agora,
    })
  })
}

// ---------- Lançamentos ----------

export interface DadosCompra {
  tipo: Kind
  /** Valor total (no crédito parcelado, a soma das parcelas) */
  valor: Cents
  data: LocalDate
  categoriaId: string
  descricao?: string
  formaPagamento: PaymentMethod
  /** Só no crédito */
  cardId?: string
  faturaInicial?: YearMonth
  parcelas?: number
}

/**
 * Grava um gasto ou receita. No crédito, gera uma parcela por fatura (cada parcela é um
 * lançamento com a data da compra). `substituir` são os lançamentos que esta gravação
 * substitui (edição): saem e entram os novos, numa única transação. Devolve os ids novos.
 */
export async function salvarCompra(dados: DadosCompra, substituir: string[] = []): Promise<string[]> {
  if (!Number.isInteger(dados.valor) || dados.valor <= 0) throw new RangeError('Valor precisa ser maior que zero')
  const agora = nowISO()
  const descricao = dados.descricao?.trim() || undefined
  const base = {
    tipo: dados.tipo,
    data: dados.data,
    categoriaId: dados.categoriaId,
    descricao,
    formaPagamento: dados.formaPagamento,
  }

  return db.transaction('rw', db.transactions, db.profile, db.cards, async () => {
    const antigos = (await db.transactions.bulkGet(substituir)).filter((t): t is Transaction => !!t)
    const createdAt = antigos.map((t) => t.createdAt).sort()[0] ?? agora

    let novos: Transaction[]
    if (dados.tipo === 'despesa' && dados.formaPagamento === 'credito') {
      if (!dados.cardId || !dados.faturaInicial) throw new Error('Compra no crédito sem cartão ou fatura')
      const cartao = await db.cards.get(dados.cardId)
      const qtd = dados.parcelas ?? 1
      const grupo = qtd > 1 ? newId() : undefined
      novos = parcelar(dados.valor, qtd, dados.faturaInicial).map((p) => ({
        ...base,
        id: newId(),
        valor: p.valor,
        mesBalanco: mesNoBalanco({ ...base, faturaRef: p.faturaRef }, cartao),
        cardId: dados.cardId,
        faturaRef: p.faturaRef,
        parcelaGrupoId: grupo,
        parcelaNumero: grupo ? p.numero : undefined,
        parcelaTotal: grupo ? qtd : undefined,
        createdAt,
        updatedAt: agora,
      }))
    } else {
      novos = [{ ...base, id: newId(), valor: dados.valor, mesBalanco: mesNoBalanco(base), createdAt, updatedAt: agora }]
    }

    await db.transactions.bulkDelete(substituir)
    await db.transactions.bulkAdd(novos)
    if (dados.tipo === 'despesa') {
      await db.profile.update(PERFIL_ID, {
        ultimaForma: dados.formaPagamento,
        ...(dados.formaPagamento === 'credito' ? { ultimoCartaoId: dados.cardId } : {}),
      })
    }
    return novos.map((t) => t.id)
  })
}

/** Edita só uma parcela (valor, categoria e descrição); as outras ficam como estão. */
export async function salvarParcela(
  id: string,
  dados: { valor: Cents; categoriaId: string; descricao?: string },
): Promise<void> {
  if (!Number.isInteger(dados.valor) || dados.valor <= 0) throw new RangeError('Valor precisa ser maior que zero')
  await db.transactions.update(id, {
    valor: dados.valor,
    categoriaId: dados.categoriaId,
    descricao: dados.descricao?.trim() || undefined,
    updatedAt: nowISO(),
  })
}

export async function excluirLancamentos(ids: string[]): Promise<void> {
  await db.transactions.bulkDelete(ids)
}

/** Todas as parcelas da compra a que o lançamento pertence (ou só ele, se não for parcelado). */
export async function lancamentosDaCompra(tx: Transaction): Promise<Transaction[]> {
  if (!tx.parcelaGrupoId) return [tx]
  const todas = await db.transactions.where('parcelaGrupoId').equals(tx.parcelaGrupoId).toArray()
  return todas.sort((a, b) => (a.parcelaNumero ?? 0) - (b.parcelaNumero ?? 0))
}

// ---------- Cartão de crédito ----------

export interface DadosCartao {
  nome: string
  diaFechamento: number
  diaVencimento: number
  limite?: Cents
}

/** Cartões em uso, na ordem em que foram cadastrados. */
export async function cartoesAtivos(): Promise<Card[]> {
  return (await db.cards.toArray())
    .filter((c) => !c.arquivado)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.nome.localeCompare(b.nome))
}

/** Primeiro cartão em uso (padrão quando só há um). */
export async function cartaoPrincipal(): Promise<Card | undefined> {
  return (await cartoesAtivos())[0]
}

/** Remove o cartão das opções; compras e faturas já lançadas continuam no histórico. */
export async function arquivarCartao(id: string): Promise<void> {
  await db.cards.update(id, { arquivado: true, updatedAt: nowISO() })
}

export async function salvarCartao(dados: DadosCartao, id?: string): Promise<string> {
  const nome = dados.nome.trim() || 'Meu cartão'
  for (const dia of [dados.diaFechamento, dados.diaVencimento]) {
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new RangeError('Dia precisa estar entre 1 e 31')
  }
  const agora = nowISO()
  if (id) {
    await db.cards.update(id, { ...dados, nome, limite: dados.limite || undefined, updatedAt: agora })
    return id
  }
  const novoId = newId()
  await db.cards.add({ ...dados, nome, limite: dados.limite || undefined, id: novoId, arquivado: false, createdAt: agora, updatedAt: agora })
  return novoId
}

// ---------- Voucher ----------

export const VOUCHER_ID = 'voucher'

export interface DadosVoucher {
  valorPorDia: Cents
  mesDoCredito?: 'seguinte' | 'mesmo'
  diaCredito: number
  acumulaSaldo: boolean
  diasEmpresa: boolean[]
}

/**
 * Cria ou altera o voucher. Na primeira vez, `saldoHoje` é o saldo inicial. Depois, se
 * vier diferente do saldo calculado, grava uma correção pela diferença.
 */
export async function salvarVoucher(dados: DadosVoucher, hoje: LocalDate, saldoHoje?: Cents): Promise<void> {
  if (!Number.isInteger(dados.diaCredito) || dados.diaCredito < 1 || dados.diaCredito > 31) {
    throw new RangeError('Dia precisa estar entre 1 e 31')
  }
  if (!Number.isInteger(dados.valorPorDia) || dados.valorPorDia < 0) throw new RangeError('Valor inválido')
  const agora = nowISO()
  const campos = { ...dados, mesDoCredito: dados.mesDoCredito ?? ('seguinte' as const) }
  await db.transaction('rw', db.voucherConfig, db.voucherCredits, db.transactions, async () => {
    const atual = await db.voucherConfig.get(VOUCHER_ID)
    if (!atual) {
      await db.voucherConfig.add({ ...campos, valorMensal: 0, id: VOUCHER_ID, inicio: hoje, createdAt: agora, updatedAt: agora })
      await db.voucherCredits.add({
        id: newId(),
        data: hoje,
        valor: saldoHoje ?? 0,
        origem: 'inicial',
        createdAt: agora,
        updatedAt: agora,
      })
      return
    }
    await db.voucherConfig.update(VOUCHER_ID, { ...campos, updatedAt: agora })
    if (saldoHoje !== undefined) {
      await garantirCreditosVoucher(hoje)
      const saldo = (await estadoDoVoucher(hoje))!.saldo
      if (saldoHoje !== saldo) {
        await db.voucherCredits.add({
          id: newId(),
          data: hoje,
          valor: saldoHoje - saldo,
          origem: 'ajuste',
          createdAt: agora,
          updatedAt: agora,
        })
      }
    }
  })
}

/** Crédito que cai numa data: valor por dia útil × dias úteis do mês que ele paga. */
export function valorDoCreditoVoucher(cfg: VoucherConfig, data: LocalDate): Cents {
  if (cfg.valorPorDia === undefined) return cfg.valorMensal // configuração antiga, ainda sem valor por dia
  return valorDoCredito(data, cfg.valorPorDia, cfg.mesDoCredito ?? 'seguinte').valor
}

/** Grava os créditos mensais que já deviam ter caído (pode rodar quantas vezes for preciso). */
export async function garantirCreditosVoucher(hoje: LocalDate): Promise<void> {
  await db.transaction('rw', db.voucherConfig, db.voucherCredits, async () => {
    const cfg = await db.voucherConfig.get(VOUCHER_ID)
    if (!cfg) return
    const ultimoMensal = await db.voucherCredits.filter((c) => c.origem === 'mensal').reverse().sortBy('data')
    const desde = ultimoMensal[0]?.data && ultimoMensal[0].data > cfg.inicio ? ultimoMensal[0].data : cfg.inicio
    const agora = nowISO()
    const novas = creditosEntre(desde, hoje, cfg.diaCredito)
    if (novas.length) {
      await db.voucherCredits.bulkAdd(
        novas.map((data) => ({ id: newId(), data, valor: valorDoCreditoVoucher(cfg, data), origem: 'mensal' as const, createdAt: agora, updatedAt: agora })),
      )
    }
  })
}

export interface EstadoVoucher {
  cfg: VoucherConfig
  ciclo: Ciclo
  saldo: Cents
  /** Gasto no ciclo até hoje */
  gastoNoCiclo: Cents
  ritmo: Ritmo
}

export async function estadoDoVoucher(hoje: LocalDate): Promise<EstadoVoucher | null> {
  const cfg = await db.voucherConfig.get(VOUCHER_ID)
  if (!cfg) return null
  const ciclo = cicloDe(hoje, cfg.diaCredito)
  const creditos = await db.voucherCredits.toArray()
  const gastos = await db.transactions.where('formaPagamento').equals('voucher').filter((t) => t.tipo === 'despesa').toArray()
  const saldo = saldoVoucher(creditos, gastos, hoje, ciclo, cfg.acumulaSaldo)
  const gastoNoCiclo = gastos.filter((g) => g.data >= ciclo.inicio && g.data <= hoje).reduce((s, g) => s + g.valor, 0)
  return { cfg, ciclo, saldo, gastoNoCiclo, ritmo: ritmoDoCiclo(saldo, hoje, ciclo, cfg.diasEmpresa) }
}

// ---------- Recorrências (assinaturas, contas fixas, salário) ----------

export interface DadosRecorrencia {
  nome: string
  tipo: Kind
  valor: Cents
  diaDoMes: number
  formaPagamento: PaymentMethod
  categoriaId: string
  cardId?: string
  escolhaFechamento?: 'esta' | 'proxima'
}

/** O lançamento que a recorrência gera numa data (sem id). Também usado nas projeções. */
export function lancamentoDaRecorrencia(rec: Recurrence, data: LocalDate, cartao?: Card) {
  const credito = rec.tipo === 'despesa' && rec.formaPagamento === 'credito'
  let faturaRef: YearMonth | undefined
  if (credito) {
    if (cartao) {
      const p = faturaPelaData(data, cartao)
      faturaRef = p.diaDeFechamento ? faturaDaCompra(data, cartao, rec.escolhaFechamento ?? 'proxima') : p.ref
    } else {
      faturaRef = yearMonthOf(data)
    }
  }
  const forma: PaymentMethod = rec.tipo === 'receita' ? 'debito_pix' : rec.formaPagamento
  return {
    tipo: rec.tipo,
    valor: valorNaData(rec, data),
    data,
    mesBalanco: mesNoBalanco({ formaPagamento: forma, data, faturaRef }, cartao),
    categoriaId: rec.categoriaId,
    descricao: rec.nome,
    formaPagamento: forma,
    cardId: credito ? rec.cardId : undefined,
    faturaRef,
    recorrenciaId: rec.id,
  }
}

export async function salvarRecorrencia(dados: DadosRecorrencia, hoje: LocalDate, id?: string): Promise<string> {
  const nome = dados.nome.trim()
  if (!nome) throw new Error('Dê um nome para a recorrência')
  if (!Number.isInteger(dados.valor) || dados.valor <= 0) throw new RangeError('Valor precisa ser maior que zero')
  if (dados.diaDoMes < 1 || dados.diaDoMes > 31) throw new RangeError('Dia precisa estar entre 1 e 31')
  if (dados.tipo === 'despesa' && dados.formaPagamento === 'credito' && !dados.cardId) {
    throw new Error('Recorrência no crédito sem cartão')
  }
  const agora = nowISO()
  const campos = {
    nome,
    tipo: dados.tipo,
    diaDoMes: dados.diaDoMes,
    formaPagamento: dados.tipo === 'receita' ? ('debito_pix' as const) : dados.formaPagamento,
    categoriaId: dados.categoriaId,
    cardId: dados.tipo === 'despesa' && dados.formaPagamento === 'credito' ? dados.cardId : undefined,
    escolhaFechamento: dados.escolhaFechamento,
  }
  let recId = id
  await db.transaction('rw', db.recurrences, async () => {
    if (recId) {
      const atual = await db.recurrences.get(recId)
      if (!atual) throw new Error('Recorrência não encontrada')
      // Novo valor vale de hoje em diante; lançamentos já feitos não mudam
      const historico =
        valorNaData(atual, hoje) === dados.valor ? atual.historicoDeValores : comNovoValor(atual.historicoDeValores, hoje, dados.valor)
      await db.recurrences.update(recId, { ...campos, historicoDeValores: historico, updatedAt: agora })
    } else {
      recId = newId()
      await db.recurrences.add({
        ...campos,
        id: recId,
        inicio: hoje,
        ativa: true,
        historicoDeValores: [{ aPartirDe: hoje, valor: dados.valor }],
        geradoAte: addDays(hoje, -1), // se o dia for hoje, já lança hoje
        createdAt: agora,
        updatedAt: agora,
      })
    }
  })
  await garantirRecorrencias(hoje)
  return recId!
}

/** Lança as ocorrências que já chegaram (pode rodar quantas vezes for preciso). */
export async function garantirRecorrencias(hoje: LocalDate): Promise<void> {
  await db.transaction('rw', db.recurrences, db.transactions, db.cards, async () => {
    const recs = (await db.recurrences.toArray()).filter((r) => r.ativa && r.geradoAte < hoje)
    if (!recs.length) return
    const cartoes = await db.cards.toArray()
    const agora = nowISO()
    for (const rec of recs) {
      const cartao = cartoes.find((c) => c.id === rec.cardId)
      const datas = datasEntre(rec, rec.geradoAte, hoje)
      if (datas.length) {
        await db.transactions.bulkAdd(
          datas.map((data) => ({ ...lancamentoDaRecorrencia(rec, data, cartao), id: newId(), createdAt: agora, updatedAt: agora })),
        )
      }
      await db.recurrences.update(rec.id, { geradoAte: hoje })
    }
  })
}

/** Pausar não lança nada no período; ao retomar, segue das próximas datas (sem lançar as que passaram). */
export async function pausarRecorrencia(id: string, pausar: boolean, hoje: LocalDate) {
  await db.recurrences.update(id, pausar ? { ativa: false, updatedAt: nowISO() } : { ativa: true, geradoAte: hoje, updatedAt: nowISO() })
}

export async function encerrarRecorrencia(id: string, hoje: LocalDate) {
  await garantirRecorrencias(hoje)
  await db.recurrences.update(id, { ativa: false, fim: hoje, updatedAt: nowISO() })
}

/** Ocorrências futuras (depois de hoje até `ate`), sem gravar: "previstas". */
export async function projetarRecorrencias(hoje: LocalDate, ate: LocalDate): Promise<Transaction[]> {
  const recs = (await db.recurrences.toArray()).filter((r) => r.ativa)
  const cartoes = await db.cards.toArray()
  return recs.flatMap((rec) =>
    datasEntre(rec, hoje > rec.geradoAte ? hoje : rec.geradoAte, ate).map((data) => ({
      ...lancamentoDaRecorrencia(rec, data, cartoes.find((c) => c.id === rec.cardId)),
      id: `prev-${rec.id}-${data}`,
      createdAt: data,
      updatedAt: data,
    })),
  )
}

// ---------- Receitas a receber ----------

export interface DadosReceitaPrevista {
  valor: Cents
  dataPrevista: LocalDate
  categoriaId: string
  descricao?: string
  devedor?: string
}

export async function salvarReceitaPrevista(dados: DadosReceitaPrevista, id?: string): Promise<string> {
  if (!Number.isInteger(dados.valor) || dados.valor <= 0) throw new RangeError('Valor precisa ser maior que zero')
  const agora = nowISO()
  const campos = { ...dados, descricao: dados.descricao?.trim() || undefined, devedor: dados.devedor?.trim() || undefined }
  if (id) {
    await db.incomeExpected.update(id, { ...campos, updatedAt: agora })
    return id
  }
  const novoId = newId()
  await db.incomeExpected.add({ ...campos, id: novoId, status: 'prevista', createdAt: agora, updatedAt: agora })
  return novoId
}

/** Marca como recebida: vira uma receita no balanço, com a data de hoje. */
export async function receberPrevista(id: string, hoje: LocalDate): Promise<void> {
  await db.transaction('rw', db.incomeExpected, db.transactions, async () => {
    const p = await db.incomeExpected.get(id)
    if (!p || p.status === 'recebida') return
    const agora = nowISO()
    const txId = newId()
    const descricao = [p.descricao, p.devedor].filter(Boolean).join(', ') || undefined
    await db.transactions.add({
      id: txId,
      tipo: 'receita',
      valor: p.valor,
      data: hoje,
      mesBalanco: yearMonthOf(hoje),
      categoriaId: p.categoriaId,
      descricao,
      formaPagamento: 'debito_pix',
      createdAt: agora,
      updatedAt: agora,
    })
    await db.incomeExpected.update(id, { status: 'recebida', dataRecebimento: hoje, transacaoId: txId, updatedAt: agora })
  })
}

export async function excluirReceitaPrevista(id: string): Promise<void> {
  await db.incomeExpected.delete(id)
}

export async function registrarPagamento(cardId: string, faturaRef: YearMonth, valorPago: Cents, dataPagamento: LocalDate) {
  const agora = nowISO()
  const id = newId()
  await db.invoicePayments.add({ id, cardId, faturaRef, valorPago, dataPagamento, createdAt: agora, updatedAt: agora })
  return id
}

export async function desfazerPagamentos(cardId: string, faturaRef: YearMonth) {
  await db.invoicePayments.where('[cardId+faturaRef]').equals([cardId, faturaRef]).delete()
}

// ---------- Categorias ----------

export interface DadosCategoria {
  nome: string
  tipo: Kind
  cor: CorCategoria
  icone: IconeCategoria
  permitidaNoVoucher: boolean
}

export async function salvarCategoria(dados: DadosCategoria, id?: string): Promise<string> {
  const nome = dados.nome.trim()
  if (!nome) throw new Error('Dê um nome para a categoria')
  const agora = nowISO()
  return db.transaction('rw', db.categories, async () => {
    if (id) {
      await db.categories.update(id, { ...dados, nome, updatedAt: agora })
      return id
    }
    const ultima = await db.categories.orderBy('ordem').last()
    const novoId = newId()
    const nova: Category = {
      ...dados,
      nome,
      id: novoId,
      ordem: (ultima?.ordem ?? -1) + 1,
      arquivada: false,
      createdAt: agora,
      updatedAt: agora,
    }
    await db.categories.add(nova)
    return novoId
  })
}

/**
 * Apaga a categoria se nenhum lançamento a usa. Se já foi usada, arquiva:
 * some das opções de lançamento, mas o histórico continua com o nome certo.
 */
export async function apagarCategoria(id: string): Promise<'apagada' | 'arquivada'> {
  return db.transaction('rw', db.categories, db.transactions, db.recurrences, db.incomeExpected, async () => {
    const emUso =
      (await db.transactions.where('categoriaId').equals(id).count()) +
      (await db.recurrences.filter((r) => r.categoriaId === id).count()) +
      (await db.incomeExpected.filter((r) => r.categoriaId === id).count())
    if (emUso > 0) {
      await db.categories.update(id, { arquivada: true, updatedAt: nowISO() })
      return 'arquivada'
    }
    await db.categories.delete(id)
    return 'apagada'
  })
}

export async function restaurarCategoria(id: string): Promise<void> {
  await db.categories.update(id, { arquivada: false, updatedAt: nowISO() })
}
