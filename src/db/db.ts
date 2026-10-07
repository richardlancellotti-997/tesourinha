import Dexie, { type EntityTable } from 'dexie'
import { mesNoBalanco } from '../domain/invoice'
import type {
  Card,
  Category,
  IncomeExpected,
  InvoicePayment,
  Profile,
  Recurrence,
  Transaction,
  VoucherConfig,
  VoucherCredit,
} from './types'

/**
 * Versão do esquema. Sempre que o esquema mudar:
 *   1. incremente SCHEMA_VERSION;
 *   2. adicione um novo `db.version(N).stores(...)` (com `.upgrade()` se precisar migrar dados);
 *   3. nunca altere uma versão já publicada.
 * O número também vai no arquivo de backup.
 */
export const SCHEMA_VERSION = 2

/** Preenche `mesBalanco` (esquema 2) em lançamentos antigos. Usado na migração e no backup. */
export function preencherMesBalanco(transacoes: Transaction[], cartoes: Card[]): void {
  for (const t of transacoes) {
    if (t.mesBalanco) continue
    t.mesBalanco = mesNoBalanco(t, cartoes.find((c) => c.id === t.cardId))
  }
}

export class TesourinhaDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>
  categories!: EntityTable<Category, 'id'>
  cards!: EntityTable<Card, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  incomeExpected!: EntityTable<IncomeExpected, 'id'>
  recurrences!: EntityTable<Recurrence, 'id'>
  voucherConfig!: EntityTable<VoucherConfig, 'id'>
  voucherCredits!: EntityTable<VoucherCredit, 'id'>
  invoicePayments!: EntityTable<InvoicePayment, 'id'>

  constructor(name = 'tesourinha') {
    super(name)
    // Apenas os campos indexados são listados; os demais são guardados normalmente.
    this.version(1).stores({
      profile: 'id',
      categories: 'id, tipo, ordem',
      cards: 'id',
      transactions:
        'id, data, tipo, categoriaId, formaPagamento, [cardId+faturaRef], parcelaGrupoId, recorrenciaId',
      incomeExpected: 'id, status, dataPrevista',
      recurrences: 'id, ativa',
      voucherConfig: 'id',
      voucherCredits: 'id, data',
      invoicePayments: 'id, [cardId+faturaRef]',
    })

    // Versão 2: mês em que cada lançamento conta no balanço (crédito pelo vencimento).
    this.version(2)
      .stores({
        transactions:
          'id, data, mesBalanco, tipo, categoriaId, formaPagamento, [cardId+faturaRef], parcelaGrupoId, recorrenciaId',
      })
      .upgrade(async (tx) => {
        const cartoes = (await tx.table('cards').toArray()) as Card[]
        await tx
          .table('transactions')
          .toCollection()
          .modify((t: Transaction) => preencherMesBalanco([t], cartoes))
      })
  }
}

export const db = new TesourinhaDB()

/** Pede ao navegador para não apagar os dados automaticamente (importante no iOS). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export function newId(): string {
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}
