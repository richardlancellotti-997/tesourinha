import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { BackupInvalido, gerarBackup, lerBackup, restaurarBackup } from './backup'
import {
  apagarCategoria,
  excluirLancamento,
  garantirDadosIniciais,
  PERFIL_ID,
  salvarCategoria,
  salvarLancamento,
  salvarPerfil,
} from './repo'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const gasto = {
  tipo: 'despesa' as const,
  valor: 2590,
  data: '2026-10-06',
  categoriaId: 'cat-mercado',
  formaPagamento: 'debito_pix' as const,
}

describe('dados iniciais', () => {
  it('cria as categorias padrão uma vez só', async () => {
    await garantirDadosIniciais()
    await garantirDadosIniciais()
    expect(await db.categories.count()).toBe(13)
    expect(await db.categories.where('tipo').equals('receita').count()).toBe(4)
  })
})

describe('lançamentos', () => {
  it('cria, altera e exclui', async () => {
    await salvarPerfil({ nome: 'Richard' })
    const id = await salvarLancamento({ ...gasto, descricao: '  Feira  ' })
    expect((await db.transactions.get(id))?.descricao).toBe('Feira')

    await salvarLancamento({ ...gasto, valor: 3000, descricao: '' }, id)
    const alterado = await db.transactions.get(id)
    expect(alterado?.valor).toBe(3000)
    expect(alterado?.descricao).toBeUndefined()

    await excluirLancamento(id)
    expect(await db.transactions.count()).toBe(0)
  })

  it('lembra a última forma de pagamento usada num gasto', async () => {
    await salvarPerfil({ nome: 'Richard' })
    await salvarLancamento({ ...gasto, formaPagamento: 'voucher' })
    expect((await db.profile.get(PERFIL_ID))?.ultimaForma).toBe('voucher')
  })

  it('recusa valor zero ou quebrado', async () => {
    await expect(salvarLancamento({ ...gasto, valor: 0 })).rejects.toThrow()
    await expect(salvarLancamento({ ...gasto, valor: 10.5 })).rejects.toThrow()
  })
})

describe('categorias', () => {
  const nova = { nome: 'Pet', tipo: 'despesa' as const, cor: 'ambar' as const, icone: 'pata' as const, permitidaNoVoucher: false }

  it('apaga categoria sem uso', async () => {
    const id = await salvarCategoria(nova)
    expect(await apagarCategoria(id)).toBe('apagada')
    expect(await db.categories.get(id)).toBeUndefined()
  })

  it('arquiva categoria já usada, sem perder o histórico', async () => {
    const id = await salvarCategoria(nova)
    await salvarLancamento({ ...gasto, categoriaId: id })
    expect(await apagarCategoria(id)).toBe('arquivada')
    expect((await db.categories.get(id))?.arquivada).toBe(true)
  })

  it('exige nome', async () => {
    await expect(salvarCategoria({ ...nova, nome: '   ' })).rejects.toThrow()
  })
})

describe('backup', () => {
  it('exporta e restaura tudo', async () => {
    await garantirDadosIniciais()
    await salvarPerfil({ nome: 'Richard' })
    await salvarLancamento(gasto)
    const backup = lerBackup(JSON.stringify(await gerarBackup()))

    await Promise.all(db.tables.map((t) => t.clear()))
    await restaurarBackup(backup)

    expect(await db.categories.count()).toBe(13)
    expect(await db.transactions.count()).toBe(1)
    expect((await db.profile.get(PERFIL_ID))?.nome).toBe('Richard')
  })

  it('recusa arquivos que não são backup', () => {
    expect(() => lerBackup('não é json')).toThrow(BackupInvalido)
    expect(() => lerBackup('{"app":"outro"}')).toThrow(BackupInvalido)
    expect(() => lerBackup('{"app":"tesourinha","versaoEsquema":99,"dados":{}}')).toThrow(/mais nova/)
  })
})
