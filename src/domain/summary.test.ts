import { describe, expect, it } from 'vitest'
import { agruparPorDia, juntarParcelas, principaisCategorias, resumoDoMes, type LancamentoBase } from './summary'

let seq = 0
function l(p: Partial<LancamentoBase>): LancamentoBase {
  seq++
  const data = p.data ?? '2026-10-05'
  return {
    id: `t${seq}`,
    tipo: 'despesa',
    valor: 1000,
    data,
    mesBalanco: data.slice(0, 7),
    categoriaId: 'cat-mercado',
    formaPagamento: 'debito_pix',
    createdAt: `2026-10-05T10:00:${String(seq).padStart(2, '0')}Z`,
    ...p,
  }
}

describe('resumoDoMes', () => {
  const dados = [
    l({ tipo: 'receita', valor: 520000, categoriaId: 'cat-salario', data: '2026-10-01' }),
    l({ valor: 85000, categoriaId: 'cat-moradia', data: '2026-10-05' }),
    l({ valor: 14235, categoriaId: 'cat-mercado', formaPagamento: 'voucher', data: '2026-10-04' }),
    l({ valor: 2340, categoriaId: 'cat-transporte', formaPagamento: 'credito', data: '2026-10-05' }),
    l({ valor: 5000, categoriaId: 'cat-mercado', data: '2026-10-31' }),
    l({ valor: 99999, data: '2026-09-30' }), // mês anterior: fora
    l({ valor: 99999, data: '2026-11-01' }), // mês seguinte: fora
  ]
  const r = resumoDoMes(dados, '2026-10')

  it('soma entradas, saídas e o que sobrou', () => {
    expect(r.entrou).toBe(520000)
    expect(r.saiu).toBe(85000 + 14235 + 2340 + 5000)
    expect(r.sobrou).toBe(520000 - 106575)
  })
  it('separa as saídas por forma de pagamento', () => {
    expect(r.saiuPorForma).toEqual({ debito_pix: 90000, credito: 2340, voucher: 14235 })
  })
  it('ordena as categorias de despesa da maior para a menor', () => {
    expect(r.porCategoria.map((c) => [c.categoriaId, c.total])).toEqual([
      ['cat-moradia', 85000],
      ['cat-mercado', 19235],
      ['cat-transporte', 2340],
    ])
  })
  it('sobra pode ser negativa', () => {
    expect(resumoDoMes([l({ valor: 500 })], '2026-10').sobrou).toBe(-500)
  })
  it('mês sem lançamentos zera tudo', () => {
    const vazio = resumoDoMes([], '2026-10')
    expect(vazio.entrou + vazio.saiu + vazio.sobrou).toBe(0)
    expect(vazio.porCategoria).toEqual([])
  })

  it('compra parcelada: só a parcela do mês entra no balanço, e é marcada como parcelada', () => {
    const parcelas = [1, 2, 3].map((n) =>
      l({
        valor: 20000,
        data: '2026-10-06',
        formaPagamento: 'credito',
        categoriaId: 'cat-lazer',
        mesBalanco: ['2026-10', '2026-11', '2026-12'][n - 1],
        parcelaGrupoId: 'g',
        parcelaNumero: n,
        parcelaTotal: 3,
      }),
    )
    const out = resumoDoMes(parcelas, '2026-10')
    expect(out.saiu).toBe(20000)
    expect(out.porCategoria).toEqual([{ categoriaId: 'cat-lazer', total: 20000, parcelado: 20000 }])
    expect(resumoDoMes(parcelas, '2026-12').saiu).toBe(20000)
    expect(resumoDoMes(parcelas, '2027-01').saiu).toBe(0)
  })

  it('crédito à vista conta no mês do vencimento, não no da compra', () => {
    const compra = l({ valor: 5000, data: '2026-10-20', formaPagamento: 'credito', mesBalanco: '2026-11' })
    expect(resumoDoMes([compra], '2026-10').saiu).toBe(0)
    expect(resumoDoMes([compra], '2026-11').saiu).toBe(5000)
  })
})

describe('principaisCategorias', () => {
  const cats = [700, 600, 500, 400, 300, 200, 100].map((total, i) => ({ categoriaId: `c${i}`, total, parcelado: i === 6 ? 100 : 0 }))
  it('mantém as 5 maiores e agrupa o resto', () => {
    const r = principaisCategorias(cats)
    expect(r).toHaveLength(6)
    expect(r[5]).toEqual({ categoriaId: null, total: 300, parcelado: 100 })
  })
  it('não agrupa quando sobraria só uma categoria', () => {
    expect(principaisCategorias(cats.slice(0, 6))).toHaveLength(6)
  })
})

describe('juntarParcelas', () => {
  it('uma linha por compra, com total, valor no mês e primeiro mês', () => {
    const p = (n: number, mes: string) =>
      l({ valor: 20000, data: '2026-10-06', mesBalanco: mes, parcelaGrupoId: 'g', parcelaNumero: n, parcelaTotal: 3 })
    const p2 = p(2, '2026-11')
    const p1 = p(1, '2026-10')
    const p3 = p(3, '2026-12')
    const avulso = l({ valor: 500 })
    const r = juntarParcelas([p2, avulso, p1, p3], '2026-10')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ id: p1.id, valorTotal: 60000, valorNoMes: 20000, mesInicial: '2026-10' })
    expect(r[1]).toMatchObject({ valorTotal: 500, valorNoMes: 500 })
  })
  it('compra que só começa a contar no mês seguinte tem valor zero no mês', () => {
    const r = juntarParcelas([l({ valor: 5000, formaPagamento: 'credito', mesBalanco: '2026-11' })], '2026-10')
    expect(r[0]).toMatchObject({ valorNoMes: 0, mesInicial: '2026-11' })
  })
})

describe('agruparPorDia', () => {
  it('dias do mais recente ao mais antigo; no dia, o último lançado primeiro', () => {
    const a = l({ data: '2026-10-04' })
    const b = l({ data: '2026-10-05' })
    const c = l({ data: '2026-10-05' })
    const grupos = agruparPorDia([a, b, c])
    expect(grupos.map((g) => g.data)).toEqual(['2026-10-05', '2026-10-04'])
    expect(grupos[0].itens.map((i) => i.id)).toEqual([c.id, b.id])
  })
})
