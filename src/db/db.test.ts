import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { TesourinhaDB, newId, nowISO } from './db'

let db: TesourinhaDB

afterEach(async () => {
  await db?.delete()
})

describe('TesourinhaDB', () => {
  it('abre o esquema e grava/lê um lançamento', async () => {
    db = new TesourinhaDB('teste')
    const id = newId()
    const now = nowISO()
    await db.transactions.add({
      id,
      createdAt: now,
      updatedAt: now,
      tipo: 'despesa',
      valor: 2590,
      data: '2026-10-05',
      mesBalanco: '2026-10',
      categoriaId: 'mercado',
      formaPagamento: 'debito_pix',
    })
    const tx = await db.transactions.get(id)
    expect(tx?.valor).toBe(2590)
    expect(await db.transactions.where('mesBalanco').equals('2026-10').count()).toBe(1)
  })

  it('migra a versão 1 para a 2 preenchendo o mês no balanço', async () => {
    // Banco como ficou na versão publicada da Etapa 2 (esquema 1)
    const antigo = new Dexie('migracao')
    antigo.version(1).stores({
      profile: 'id',
      categories: 'id, tipo, ordem',
      cards: 'id',
      transactions: 'id, data, tipo, categoriaId, formaPagamento, [cardId+faturaRef], parcelaGrupoId, recorrenciaId',
      incomeExpected: 'id, status, dataPrevista',
      recurrences: 'id, ativa',
      voucherConfig: 'id',
      voucherCredits: 'id, data',
      invoicePayments: 'id, [cardId+faturaRef]',
    })
    const base = { tipo: 'despesa', categoriaId: 'c', createdAt: 'x', updatedAt: 'x' }
    await antigo.table('cards').add({ id: 'k', nome: 'Cartão', diaFechamento: 28, diaVencimento: 5, arquivado: false })
    await antigo.table('transactions').bulkAdd([
      { ...base, id: 'debito', valor: 100, data: '2026-10-06', formaPagamento: 'debito_pix' },
      { ...base, id: 'p1', valor: 100, data: '2026-10-06', formaPagamento: 'credito', cardId: 'k', faturaRef: '2026-10' },
      { ...base, id: 'p2', valor: 100, data: '2026-10-06', formaPagamento: 'credito', cardId: 'k', faturaRef: '2026-11' },
    ])
    antigo.close()

    db = new TesourinhaDB('migracao')
    const meses = Object.fromEntries((await db.transactions.toArray()).map((t) => [t.id, t.mesBalanco]))
    // fecha 28, vence 5: a fatura de outubro vence em novembro
    expect(meses).toEqual({ debito: '2026-10', p1: '2026-11', p2: '2026-12' })
  })
})
