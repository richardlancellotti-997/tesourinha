import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { BackupInvalido, gerarBackup, lerBackup, restaurarBackup } from './backup'
import {
  apagarCategoria,
  arquivarCartao,
  cartaoPrincipal,
  cartoesAtivos,
  desfazerPagamentos,
  encerrarRecorrencia,
  garantirRecorrencias,
  pausarRecorrencia,
  projetarRecorrencias,
  receberPrevista,
  salvarReceitaPrevista,
  salvarRecorrencia,
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

  it('vários cartões: cada compra vai para o seu, e o último usado fica lembrado', async () => {
    await salvarPerfil({ nome: 'Richard' })
    const a = await salvarCartao({ nome: 'A', diaFechamento: 14, diaVencimento: 21 })
    const b = await salvarCartao({ nome: 'B', diaFechamento: 28, diaVencimento: 5 })
    const [idB] = await salvarCompra({ ...credito, cardId: b, faturaInicial: '2026-10' })
    expect((await db.transactions.get(idB))?.mesBalanco).toBe('2026-11') // B vence no mês seguinte
    expect((await db.profile.get(PERFIL_ID))?.ultimoCartaoId).toBe(b)
    await arquivarCartao(a)
    expect((await cartoesAtivos()).map((c) => c.nome)).toEqual(['B'])
    expect(await db.transactions.count()).toBe(1)
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
  const cfg = { valorPorDia: 5000, mesDoCredito: 'mesmo' as const, diaCredito: 20, acumulaSaldo: true, diasEmpresa: [false, true, true, true, true, true, false] }
  const gastoVoucher = { ...gasto, formaPagamento: 'voucher' as const }

  it('saldo inicial, gastos e créditos mensais automáticos', async () => {
    await salvarVoucher(cfg, '2026-10-05', 50000)
    await salvarCompra({ ...gastoVoucher, valor: 8720, data: '2026-10-05' })
    expect((await estadoDoVoucher('2026-10-05'))?.saldo).toBe(41280)

    // em 20/11 já caíram os créditos de 20/10 e 20/11; rodar de novo não duplica
    await garantirCreditosVoucher('2026-11-20')
    await garantirCreditosVoucher('2026-11-20')
    expect(await db.voucherCredits.where('data').equals('2026-10-20').count()).toBe(1)
    expect((await estadoDoVoucher('2026-11-20'))?.saldo).toBe(41280 + 105000 + 95000) // 21 dias úteis de outubro e 19 de novembro × 50,00
  })

  it('o gasto no voucher fica no mês da data e não entra no crédito do cartão', async () => {
    const [id] = await salvarCompra({ ...gastoVoucher, valor: 1000 })
    const tx = await db.transactions.get(id)
    expect(tx?.mesBalanco).toBe('2026-10')
    expect(tx?.faturaRef).toBeUndefined()
  })

  it('crédito do dia 30 paga os dias úteis do mês seguinte (padrão)', async () => {
    await salvarVoucher({ ...cfg, mesDoCredito: undefined, diaCredito: 30, valorPorDia: 3300 }, '2026-10-07', 0)
    await garantirCreditosVoucher('2026-10-30')
    const credito = await db.voucherCredits.where('data').equals('2026-10-30').first()
    expect(credito?.valor).toBe(3300 * 19) // novembro: 19 dias úteis
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
    expect((await estadoDoVoucher('2026-10-21'))?.saldo).toBe(105000)
  })
})

describe('recorrências', () => {
  const assinatura = {
    nome: 'Música',
    tipo: 'despesa' as const,
    valor: 2190,
    diaDoMes: 8,
    formaPagamento: 'debito_pix' as const,
    categoriaId: 'cat-assinaturas',
  }
  const daRec = (id: string) => db.transactions.where('recorrenciaId').equals(id).sortBy('data')

  it('lança no dia, uma vez só, e recupera os meses em que o app ficou fechado', async () => {
    const id = await salvarRecorrencia(assinatura, '2026-10-07')
    expect(await daRec(id)).toHaveLength(0) // dia 8 ainda não chegou
    await garantirRecorrencias('2026-10-08')
    await garantirRecorrencias('2026-10-08')
    expect((await daRec(id)).map((t) => [t.data, t.valor, t.descricao])).toEqual([['2026-10-08', 2190, 'Música']])
    await garantirRecorrencias('2027-01-20')
    expect((await daRec(id)).map((t) => t.data)).toEqual(['2026-10-08', '2026-11-08', '2026-12-08', '2027-01-08'])
  })

  it('se o dia é hoje, já lança ao cadastrar', async () => {
    const id = await salvarRecorrencia({ ...assinatura, diaDoMes: 7 }, '2026-10-07')
    expect(await daRec(id)).toHaveLength(1)
  })

  it('mudar o valor vale dali em diante; o já lançado não muda', async () => {
    const id = await salvarRecorrencia(assinatura, '2026-10-07')
    await garantirRecorrencias('2026-10-08')
    await salvarRecorrencia({ ...assinatura, valor: 2490 }, '2026-10-20', id)
    await garantirRecorrencias('2026-11-08')
    expect((await daRec(id)).map((t) => t.valor)).toEqual([2190, 2490])
  })

  it('pausada não lança; retomada segue das próximas datas, sem as que passaram', async () => {
    const id = await salvarRecorrencia(assinatura, '2026-10-07')
    await pausarRecorrencia(id, true, '2026-10-07')
    await garantirRecorrencias('2026-12-20')
    expect(await daRec(id)).toHaveLength(0)
    await pausarRecorrencia(id, false, '2026-12-20')
    await garantirRecorrencias('2027-01-08')
    expect((await daRec(id)).map((t) => t.data)).toEqual(['2027-01-08'])
  })

  it('encerrada não lança mais e some das projeções', async () => {
    const id = await salvarRecorrencia(assinatura, '2026-10-07')
    await encerrarRecorrencia(id, '2026-10-09')
    await garantirRecorrencias('2027-01-20')
    expect(await daRec(id)).toHaveLength(1)
    expect(await projetarRecorrencias('2027-01-20', '2027-06-30')).toHaveLength(0)
  })

  it('no crédito, no dia do fechamento usa a escolha do cadastro e conta no mês do vencimento', async () => {
    const cardId = await salvarCartao({ nome: 'C', diaFechamento: 14, diaVencimento: 21 })
    const id = await salvarRecorrencia(
      { ...assinatura, diaDoMes: 14, formaPagamento: 'credito', cardId, escolhaFechamento: 'proxima' },
      '2026-10-07',
    )
    await garantirRecorrencias('2026-10-14')
    const [tx] = await daRec(id)
    expect([tx.faturaRef, tx.mesBalanco, tx.cardId]).toEqual(['2026-11', '2026-11', cardId])
  })

  it('projeta as próximas ocorrências sem gravar', async () => {
    await salvarRecorrencia(assinatura, '2026-10-07')
    const prev = await projetarRecorrencias('2026-10-07', '2026-12-31')
    expect(prev.map((t) => t.data)).toEqual(['2026-10-08', '2026-11-08', '2026-12-08'])
    expect(await db.transactions.count()).toBe(0)
  })

  it('salário entra sozinho como receita', async () => {
    const id = await salvarRecorrencia(
      { ...assinatura, nome: 'Salário', tipo: 'receita', valor: 520000, diaDoMes: 5, categoriaId: 'cat-salario' },
      '2026-10-07',
    )
    await garantirRecorrencias('2026-11-05')
    expect((await daRec(id)).map((t) => [t.tipo, t.valor, t.data, t.mesBalanco])).toEqual([['receita', 520000, '2026-11-05', '2026-11']])
  })
})

describe('receitas a receber', () => {
  it('prevista não conta; ao receber vira receita com a data de hoje', async () => {
    const id = await salvarReceitaPrevista({
      valor: 80000,
      dataPrevista: '2026-10-10',
      categoriaId: 'cat-servicos',
      descricao: 'Site',
      devedor: 'Ana',
    })
    expect(await db.transactions.count()).toBe(0)
    await receberPrevista(id, '2026-10-12')
    await receberPrevista(id, '2026-10-12') // não duplica
    const txs = await db.transactions.toArray()
    expect(txs.map((t) => [t.tipo, t.valor, t.data, t.descricao])).toEqual([['receita', 80000, '2026-10-12', 'Site, Ana']])
    expect((await db.incomeExpected.get(id))?.status).toBe('recebida')
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
