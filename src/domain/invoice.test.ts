import { describe, expect, it } from 'vitest'
import {
  faturaAberta,
  faturaDaCompra,
  faturaPelaData,
  fechamentoDe,
  mesNoBalanco,
  parcelar,
  situacaoDaFatura,
  vencimentoDe,
} from './invoice'

const fecha14vence21 = { diaFechamento: 14, diaVencimento: 21 }
const fecha28vence5 = { diaFechamento: 28, diaVencimento: 5 }
const fecha31vence10 = { diaFechamento: 31, diaVencimento: 10 }

describe('datas da fatura', () => {
  it('vence no mesmo mês quando o vencimento vem depois do fechamento', () => {
    expect(fechamentoDe('2026-10', fecha14vence21)).toBe('2026-10-14')
    expect(vencimentoDe('2026-10', fecha14vence21)).toBe('2026-10-21')
  })
  it('vence no mês seguinte quando o vencimento vem antes', () => {
    expect(vencimentoDe('2026-10', fecha28vence5)).toBe('2026-11-05')
  })
  it('vencimento atravessa a virada do ano', () => {
    expect(vencimentoDe('2026-12', fecha28vence5)).toBe('2027-01-05')
  })
  it('fechamento no dia 31 vira o último dia em meses curtos', () => {
    expect(fechamentoDe('2026-02', fecha31vence10)).toBe('2026-02-28')
    expect(fechamentoDe('2028-02', fecha31vence10)).toBe('2028-02-29')
    expect(fechamentoDe('2026-04', fecha31vence10)).toBe('2026-04-30')
  })
})

describe('a qual fatura a compra pertence', () => {
  it('antes do fechamento: fatura do mês', () => {
    expect(faturaPelaData('2026-10-13', fecha14vence21)).toEqual({ ref: '2026-10', diaDeFechamento: false })
  })
  it('depois do fechamento: fatura seguinte', () => {
    expect(faturaPelaData('2026-10-15', fecha14vence21)).toEqual({ ref: '2026-11', diaDeFechamento: false })
  })
  it('no dia do fechamento: pede escolha', () => {
    expect(faturaPelaData('2026-10-14', fecha14vence21)).toEqual({ ref: '2026-10', diaDeFechamento: true })
    expect(faturaDaCompra('2026-10-14', fecha14vence21, 'esta')).toBe('2026-10')
    expect(faturaDaCompra('2026-10-14', fecha14vence21, 'proxima')).toBe('2026-11')
    expect(() => faturaDaCompra('2026-10-14', fecha14vence21)).toThrow()
  })
  it('depois do fechamento de dezembro vai para janeiro do ano seguinte', () => {
    expect(faturaDaCompra('2026-12-20', fecha14vence21)).toBe('2027-01')
  })
  it('fechamento dia 31 em fevereiro: dia 28 é o dia do fechamento', () => {
    expect(faturaPelaData('2026-02-28', fecha31vence10).diaDeFechamento).toBe(true)
    expect(faturaPelaData('2026-03-01', fecha31vence10).ref).toBe('2026-03')
  })
})

describe('fatura em aberto', () => {
  it('no dia do fechamento a fatura do mês ainda está aberta', () => {
    expect(faturaAberta('2026-10-14', fecha14vence21)).toBe('2026-10')
    expect(faturaAberta('2026-10-15', fecha14vence21)).toBe('2026-11')
    expect(faturaAberta('2026-12-31', fecha14vence21)).toBe('2027-01')
  })
})

describe('parcelas', () => {
  it('R$ 600 em 3x: 200 por fatura consecutiva', () => {
    expect(parcelar(60000, 3, '2026-10')).toEqual([
      { numero: 1, valor: 20000, faturaRef: '2026-10' },
      { numero: 2, valor: 20000, faturaRef: '2026-11' },
      { numero: 3, valor: 20000, faturaRef: '2026-12' },
    ])
  })
  it('sobra dos centavos na primeira e soma exata', () => {
    const p = parcelar(10000, 3, '2026-11')
    expect(p.map((x) => x.valor)).toEqual([3334, 3333, 3333])
    expect(p.reduce((s, x) => s + x.valor, 0)).toBe(10000)
  })
  it('parcelas atravessam a virada do ano', () => {
    expect(parcelar(40000, 4, '2026-11').map((x) => x.faturaRef)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})

describe('mês no balanço', () => {
  it('débito e receita contam no mês da data', () => {
    expect(mesNoBalanco({ formaPagamento: 'debito_pix', data: '2026-10-20' })).toBe('2026-10')
  })
  it('crédito conta no mês em que a fatura vence', () => {
    // fecha 14, vence 21: fatura de novembro vence em novembro
    expect(mesNoBalanco({ formaPagamento: 'credito', data: '2026-10-20', faturaRef: '2026-11' }, fecha14vence21)).toBe('2026-11')
    // fecha 28, vence 5: fatura de outubro vence em novembro
    expect(mesNoBalanco({ formaPagamento: 'credito', data: '2026-10-06', faturaRef: '2026-10' }, fecha28vence5)).toBe('2026-11')
    // dezembro vence em janeiro do ano seguinte
    expect(mesNoBalanco({ formaPagamento: 'credito', data: '2026-12-01', faturaRef: '2026-12' }, fecha28vence5)).toBe('2027-01')
  })
  it('sem a configuração do cartão, usa o mês da fatura', () => {
    expect(mesNoBalanco({ formaPagamento: 'credito', data: '2026-10-06', faturaRef: '2026-10' })).toBe('2026-10')
  })
})

describe('situação da fatura', () => {
  it('aberta até o dia do fechamento', () => {
    expect(situacaoDaFatura('2026-10', fecha14vence21, '2026-10-14', 5000, 0)).toBe('aberta')
  })
  it('fechada entre o fechamento e o vencimento', () => {
    expect(situacaoDaFatura('2026-10', fecha14vence21, '2026-10-21', 5000, 0)).toBe('fechada')
  })
  it('vencida depois do vencimento sem pagamento', () => {
    expect(situacaoDaFatura('2026-10', fecha14vence21, '2026-10-22', 5000, 0)).toBe('vencida')
  })
  it('paga quando o pagamento cobre o total', () => {
    expect(situacaoDaFatura('2026-10', fecha14vence21, '2026-10-22', 5000, 5000)).toBe('paga')
  })
  it('paga mesmo se foi quitada antes de fechar', () => {
    expect(situacaoDaFatura('2026-10', fecha14vence21, '2026-10-10', 5000, 5000)).toBe('paga')
  })
  it('fatura sem compras ainda aberta não aparece como paga', () => {
    expect(situacaoDaFatura('2026-10', fecha14vence21, '2026-10-10', 0, 0)).toBe('aberta')
  })
})
