// Backup completo em JSON: exportar e restaurar.

import { db, nowISO, preencherMesBalanco, SCHEMA_VERSION } from './db'
import type { Card, Transaction } from './types'

const TABELAS = [
  'profile',
  'categories',
  'cards',
  'transactions',
  'incomeExpected',
  'recurrences',
  'voucherConfig',
  'voucherCredits',
  'invoicePayments',
] as const

type NomeTabela = (typeof TABELAS)[number]

export interface ArquivoBackup {
  app: 'tesourinha'
  versaoEsquema: number
  exportadoEm: string
  dados: Record<NomeTabela, unknown[]>
}

export async function gerarBackup(): Promise<ArquivoBackup> {
  return db.transaction('r', TABELAS.map((t) => db.table(t)), async () => {
    const dados = {} as Record<NomeTabela, unknown[]>
    for (const t of TABELAS) dados[t] = await db.table(t).toArray()
    return { app: 'tesourinha', versaoEsquema: SCHEMA_VERSION, exportadoEm: nowISO(), dados }
  })
}

export function nomeArquivoBackup(quando = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `tesourinha-backup-${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}.json`
}

export class BackupInvalido extends Error {}

/** Confere o arquivo antes de apagar qualquer coisa. */
export function lerBackup(texto: string): ArquivoBackup {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new BackupInvalido('O arquivo não é um backup do Tesourinha (não é um JSON válido).')
  }
  const b = json as Partial<ArquivoBackup>
  if (b?.app !== 'tesourinha' || typeof b.versaoEsquema !== 'number' || typeof b.dados !== 'object' || !b.dados) {
    throw new BackupInvalido('O arquivo não é um backup do Tesourinha.')
  }
  if (b.versaoEsquema > SCHEMA_VERSION) {
    throw new BackupInvalido('Este backup veio de uma versão mais nova do app. Atualize o app e tente de novo.')
  }
  for (const t of TABELAS) {
    const lista = (b.dados as Record<string, unknown>)[t]
    if (lista !== undefined && !Array.isArray(lista)) throw new BackupInvalido(`O backup está corrompido (${t}).`)
  }
  return b as ArquivoBackup
}

/** Substitui TODOS os dados do aparelho pelos do backup, numa única transação. */
export async function restaurarBackup(backup: ArquivoBackup): Promise<void> {
  // Backups de versões antigas do esquema: migrar os dados antes de gravar.
  if (backup.versaoEsquema < 2) {
    preencherMesBalanco((backup.dados.transactions ?? []) as Transaction[], (backup.dados.cards ?? []) as Card[])
  }
  await db.transaction('rw', TABELAS.map((t) => db.table(t)), async () => {
    for (const t of TABELAS) {
      await db.table(t).clear()
      const lista = backup.dados[t] ?? []
      if (lista.length) await db.table(t).bulkAdd(lista)
    }
  })
}
