import { describe, expect, it } from 'vitest'
import { agruparPorDia, juntarParcelas, principaisCategorias, resumoDoMes, type LancamentoBase } from './summary'

let seq = 0
function l(p: Partial<LancamentoBase>): LancamentoBase {
  seq++
  return {
    id: `t${seq}`,
    tipo: 'despesa',
    valor: 1000,
    data: '2026-10-05',
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
    expect(r.porCategoria).toEqual([
      { categoriaId: 'cat-moradia', total: 85000 },
      { categoriaId: 'cat-mercado', total: 19235 },
      { categoriaId: 'cat-transporte', total: 2340 },
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
})

describe('principaisCategorias', () => {
  const cats = [700, 600, 500, 400, 300, 200, 100].map((total, i) => ({ categoriaId: `c${i}`, total }))
  it('mantém as 5 maiores e agrupa o resto', () => {
    const r = principaisCategorias(cats)
    expect(r).toHaveLength(6)
    expect(r[5]).toEqual({ categoriaId: null, total: 300 })
  })
  it('não agrupa quando sobraria só uma categoria', () => {
    expect(principaisCategorias(cats.slice(0, 6))).toHaveLength(6)
  })
})

describe('juntarParcelas', () => {
  it('uma linha por compra parcelada, com o valor total e a 1ª parcela', () => {
    const p2 = { ...l({ valor: 20000 }), parcelaGrupoId: 'g', parcelaNumero: 2, parcelaTotal: 3 }
    const p1 = { ...l({ valor: 20000 }), parcelaGrupoId: 'g', parcelaNumero: 1, parcelaTotal: 3 }
    const p3 = { ...l({ valor: 20000 }), parcelaGrupoId: 'g', parcelaNumero: 3, parcelaTotal: 3 }
    const avulso = l({ valor: 500 })
    const r = juntarParcelas([p2, avulso, p1, p3])
    expect(r).toHaveLength(2)
    expect(r[0].id).toBe(p1.id)
    expect(r[0].valorTotal).toBe(60000)
    expect(r[1].valorTotal).toBe(500)
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
