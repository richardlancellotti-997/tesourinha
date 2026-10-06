// Operações de leitura e escrita usadas pelas telas.

import { CATEGORIAS_PADRAO, type CorCategoria, type IconeCategoria } from '../domain/categories'
import type { Cents } from '../domain/money'
import type { LocalDate } from '../domain/dates'
import { db, newId, nowISO } from './db'
import type { Category, Kind, PaymentMethod, Profile, Transaction } from './types'

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

export interface DadosLancamento {
  tipo: Kind
  valor: Cents
  data: LocalDate
  categoriaId: string
  descricao?: string
  formaPagamento: PaymentMethod
}

/** Cria (sem id) ou altera (com id) um lançamento. Devolve o id. */
export async function salvarLancamento(dados: DadosLancamento, id?: string): Promise<string> {
  if (!Number.isInteger(dados.valor) || dados.valor <= 0) throw new RangeError('Valor precisa ser maior que zero')
  const agora = nowISO()
  const descricao = dados.descricao?.trim() || undefined

  return db.transaction('rw', db.transactions, db.profile, async () => {
    let txId = id
    if (txId) {
      const atual = await db.transactions.get(txId)
      if (!atual) throw new Error('Lançamento não encontrado')
      const novo: Transaction = { ...atual, ...dados, descricao, updatedAt: agora }
      await db.transactions.put(novo)
    } else {
      txId = newId()
      await db.transactions.add({ ...dados, descricao, id: txId, createdAt: agora, updatedAt: agora })
    }
    if (dados.tipo === 'despesa') {
      await db.profile.update(PERFIL_ID, { ultimaForma: dados.formaPagamento })
    }
    return txId
  })
}

export async function excluirLancamento(id: string): Promise<void> {
  await db.transactions.delete(id)
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
