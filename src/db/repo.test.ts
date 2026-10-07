import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { BackupInvalido, gerarBackup, lerBackup, restaurarBackup } from './backup'
import {
  apagarCategoria,
  cartaoPrincipal,
  desfazerPagamentos,
  estadoDoVoucher,
  garantirCreditosVoucher,
  excluirLancamentos,
  garantirDadosIniciais,
  lancamentosDaCompra,
  PERFIL_ID,
  registrarPagamento,
  salvarCartao,
  salvarCategoria,
  salvarCompra,
  salvarParcela,
  salvarPerfil,
  salvarVoucher,
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
  it('cria, altera (substituindo) e exclui', async () => {
    await salvarPerfil({ nome: 'Richard' })
    const [id] = await salvarCompra({ ...gasto, descricao: '  Feira  ' })
    const original = await db.transactions.get(id)
    expect(original?.descricao).toBe('Feira')

    const [novoId] = await salvarCompra({ ...gasto, valor: 3000, descricao: '' }, [id])
    const alterado = await db.transactions.get(novoId)
    expect(alterado?.valor).toBe(3000)
    expect(alterado?.descricao).toBeUndefined()
    expect(alterado?.createdAt).toBe(original?.createdAt) // mantém a posição na lista
    expect(await db.transactions.count()).toBe(1)

    await excluirLancamentos([novoId])
    expect(await db.transactions.count()).toBe(0)
  })

  it('lembra a última forma de pagamento usada num gasto', async () => {
    await salvarPerfil({ nome: 'Richard' })
    await salvarCompra({ ...gasto, formaPagamento: 'voucher' })
    expect((await db.profile.get(PERFIL_ID))?.ultimaForma).toBe('voucher')
  })

  it('recusa valor zero ou quebrado', async () => {
    await expect(salvarCompra({ ...gasto, valor: 0 })).rejects.toThrow()
    await expect(salvarCompra({ ...gasto, valor: 10.5 })).rejects.toThrow()
  })
})

describe('crédito', () => {
  const credito = { ...gasto, valor: 60000, formaPagamento: 'credito' as const, cardId: 'c1', faturaInicial: '2026-10' }

  it('parcela em faturas consecutivas, todas com a data da compra', async () => {
    await salvarCompra({ ...credito, parcelas: 3 })
    const txs = await db.transactions.orderBy('data').toArray()
    expect(txs.map((t) => [t.parcelaNumero, t.valor, t.faturaRef, t.data])).toEqual(
      expect.arrayContaining([
        [1, 20000, '2026-10', '2026-10-06'],
        [2, 20000, '2026-11', '2026-10-06'],
        [3, 20000, '2026-12', '2026-10-06'],
      ]),
    )
    expect(new Set(txs.map((t) => t.parcelaGrupoId)).size).toBe(1)
  })

  it('cada parcela conta no balanço do mês em que a fatura vence', async () => {
    const cardId = await salvarCartao({ nome: 'C', diaFechamento: 28, diaVencimento: 5 })
    await salvarCompra({ ...credito, cardId, parcelas: 3 })
    const meses = (await db.transactions.toArray()).map((t) => t.mesBalanco).sort()
    expect(meses).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('débito conta no mês da data', async () => {
    const [id] = await salvarCompra(gasto)
    expect((await db.transactions.get(id))?.mesBalanco).toBe('2026-10')
  })

  it('à vista no crédito não cria grupo de parcelas', async () => {
    const [id] = await salvarCompra({ ...credito, parcelas: 1 })
    const tx = await db.transactions.get(id)
    expect(tx?.parcelaGrupoId).toBeUndefined()
    expect(tx?.faturaRef).toBe('2026-10')
  })

  it('editar a compra toda troca todas as parcelas', async () => {
    const ids = await salvarCompra({ ...credito, parcelas: 3 })
    const tx = (await db.transactions.get(ids[1]))!
    const todas = await lancamentosDaCompra(tx)
    expect(todas.map((t) => t.parcelaNumero)).toEqual([1, 2, 3])
    await salvarCompra({ ...credito, valor: 40000, parcelas: 2 }, todas.map((t) => t.id))
    expect(await db.transactions.count()).toBe(2)
  })

  it('editar só uma parcela não mexe nas outras', async () => {
    const ids = await salvarCompra({ ...credito, parcelas: 3 })
    await salvarParcela(ids[1], { valor: 25000, categoriaId: 'cat-compras' })
    const txs = await db.transactions.bulkGet(ids)
    expect(txs.map((t) => t?.valor)).toEqual([20000, 25000, 20000])
  })

  it('recusa crédito sem cartão', async () => {
    await expect(salvarCompra({ ...credito, cardId: undefined })).rejects.toThrow()
  })

  it('cartão: valida os dias e registra/desfaz pagamento', async () => {
    await expect(salvarCartao({ nome: 'X', diaFechamento: 0, diaVencimento: 10 })).rejects.toThrow()
    const id = await salvarCartao({ nome: ' ', diaFechamento: 14, diaVencimento: 21 })
    expect((await cartaoPrincipal())?.nome).toBe('Meu cartão')
    await registrarPagamento(id, '2026-10', 5000, '2026-10-20')
    expect(await db.invoicePayments.count()).toBe(1)
    await desfazerPagamentos(id, '2026-10')
    expect(await db.invoicePayments.count()).toBe(0)
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
    await salvarCompra({ ...gasto, categoriaId: id })
    expect(await apagarCategoria(id)).toBe('arquivada')
    expect((await db.categories.get(id))?.arquivada).toBe(true)
  })

  it('exige nome', async () => {
    await expect(salvarCategoria({ ...nova, nome: '   ' })).rejects.toThrow()
  })
})

describe('voucher', () => {
  const cfg = { valorMensal: 110000, diaCredito: 20, acumulaSaldo: true, diasEmpresa: [false, true, true, true, true, true, false] }
  const gastoVoucher = { ...gasto, formaPagamento: 'voucher' as const }

  it('saldo inicial, gastos e créditos mensais automáticos', async () => {
    await salvarVoucher(cfg, '2026-10-05', 50000)
    await salvarCompra({ ...gastoVoucher, valor: 8720, data: '2026-10-05' })
    expect((await estadoDoVoucher('2026-10-05'))?.saldo).toBe(41280)

    // em 20/11 já caíram os créditos de 20/10 e 20/11; rodar de novo não duplica
    await garantirCreditosVoucher('2026-11-20')
    await garantirCreditosVoucher('2026-11-20')
    expect(await db.voucherCredits.where('data').equals('2026-10-20').count()).toBe(1)
    expect((await estadoDoVoucher('2026-11-20'))?.saldo).toBe(41280 + 220000)
  })

  it('o gasto no voucher fica no mês da data e não entra no crédito do cartão', async () => {
    const [id] = await salvarCompra({ ...gastoVoucher, valor: 1000 })
    const tx = await db.transactions.get(id)
    expect(tx?.mesBalanco).toBe('2026-10')
    expect(tx?.faturaRef).toBeUndefined()
  })

  it('corrigir o saldo grava a diferença como ajuste', async () => {
    await salvarVoucher(cfg, '2026-10-05', 50000)
    await salvarVoucher(cfg, '2026-10-06', 45000)
    expect((await estadoDoVoucher('2026-10-06'))?.saldo).toBe(45000)
    expect(await db.voucherCredits.filter((c) => c.origem === 'ajuste').count()).toBe(1)
  })

  it('sem acumular, o saldo do ciclo anterior não passa para o novo', async () => {
    await salvarVoucher({ ...cfg, acumulaSaldo: false }, '2026-10-05', 50000)
    await garantirCreditosVoucher('2026-10-21')
    expect((await estadoDoVoucher('2026-10-21'))?.saldo).toBe(110000)
  })
})

describe('backup', () => {
  it('exporta e restaura tudo', async () => {
    await garantirDadosIniciais()
    await salvarPerfil({ nome: 'Richard' })
    await salvarCompra(gasto)
    const backup = lerBackup(JSON.stringify(await gerarBackup()))

    await Promise.all(db.tables.map((t) => t.clear()))
    await restaurarBackup(backup)

    expect(await db.categories.count()).toBe(13)
    expect(await db.transactions.count()).toBe(1)
    expect((await db.profile.get(PERFIL_ID))?.nome).toBe('Richard')
  })

  it('restaura backup da versão 1 preenchendo o mês no balanço', async () => {
    const antigo = {
      app: 'tesourinha',
      versaoEsquema: 1,
      exportadoEm: '2026-10-06T12:00:00Z',
      dados: {
        cards: [{ id: 'k', nome: 'C', diaFechamento: 14, diaVencimento: 21, arquivado: false, createdAt: 'x', updatedAt: 'x' }],
        transactions: [
          { ...gasto, id: 't1', formaPagamento: 'credito', cardId: 'k', faturaRef: '2026-11', createdAt: 'x', updatedAt: 'x' },
        ],
      },
    }
    await restaurarBackup(lerBackup(JSON.stringify(antigo)))
    expect((await db.transactions.get('t1'))?.mesBalanco).toBe('2026-11')
  })

  it('recusa arquivos que não são backup', () => {
    expect(() => lerBackup('não é json')).toThrow(BackupInvalido)
    expect(() => lerBackup('{"app":"outro"}')).toThrow(BackupInvalido)
    expect(() => lerBackup('{"app":"tesourinha","versaoEsquema":99,"dados":{}}')).toThrow(/mais nova/)
  })
})
