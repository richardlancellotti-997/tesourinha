import 'fake-indexeddb/auto'
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
      categoriaId: 'mercado',
      formaPagamento: 'debito_pix',
    })
    const tx = await db.transactions.get(id)
    expect(tx?.valor).toBe(2590)
    expect(await db.transactions.where('data').equals('2026-10-05').count()).toBe(1)
  })
})
