// Operações de leitura e escrita usadas pelas telas.

import { CATEGORIAS_PADRAO, type CorCategoria, type IconeCategoria } from '../domain/categories'
import type { Cents } from '../domain/money'
import type { LocalDate, YearMonth } from '../domain/dates'
import { mesNoBalanco, parcelar } from '../domain/invoice'
import { db, newId, nowISO } from './db'
import type { Card, Category, Kind, PaymentMethod, Profile, Transaction } from './types'

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
      await db.profile.update(PERFIL_ID, { ultimaForma: dados.formaPagamento })
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

/** Na V1 há um cartão só (o modelo já aceita vários). */
export async function cartaoPrincipal(): Promise<Card | undefined> {
  return (await db.cards.toArray()).find((c) => !c.arquivado)
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
