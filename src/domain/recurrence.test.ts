import { describe, expect, it } from 'vitest'
import { comNovoValor, datasEntre, proximaData, valorNaData } from './recurrence'

const base = { diaDoMes: 10, inicio: '2026-10-07', historicoDeValores: [{ aPartirDe: '2026-10-07', valor: 4490 }] }

describe('datas da recorrência', () => {
  it('uma por mês, a partir do início', () => {
    expect(datasEntre(base, '2026-10-06', '2027-01-31')).toEqual(['2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10'])
  })
  it('dia anterior ao início no mesmo mês só começa no mês seguinte', () => {
    expect(datasEntre({ ...base, diaDoMes: 5 }, '2026-10-06', '2026-12-31')).toEqual(['2026-11-05', '2026-12-05'])
  })
  it('cai no próprio dia de início', () => {
    expect(datasEntre({ ...base, diaDoMes: 7 }, '2026-10-06', '2026-10-31')).toEqual(['2026-10-07'])
  })
  it('dia 31 vira o último dia em meses curtos', () => {
    expect(datasEntre({ ...base, diaDoMes: 31 }, '2027-01-31', '2027-04-30')).toEqual(['2027-02-28', '2027-03-31', '2027-04-30'])
  })
  it('para no fim (encerrada)', () => {
    expect(datasEntre({ ...base, fim: '2026-11-30' }, '2026-10-06', '2027-03-31')).toEqual(['2026-10-10', '2026-11-10'])
  })
  it('não repete o que já foi gerado', () => {
    expect(datasEntre(base, '2026-11-10', '2026-12-31')).toEqual(['2026-12-10'])
  })
  it('próxima data', () => {
    expect(proximaData(base, '2026-10-10')).toBe('2026-11-10')
    expect(proximaData({ ...base, fim: '2026-10-31' }, '2026-10-10')).toBeNull()
  })
})

describe('valor ao longo do tempo', () => {
  const historico = comNovoValor(base.historicoDeValores, '2026-12-01', 5490)
  it('mudança vale dali em diante, sem reescrever o passado', () => {
    expect(valorNaData({ historicoDeValores: historico }, '2026-11-10')).toBe(4490)
    expect(valorNaData({ historicoDeValores: historico }, '2026-12-10')).toBe(5490)
  })
  it('novo ajuste no mesmo dia substitui o anterior', () => {
    expect(comNovoValor(historico, '2026-12-01', 6000)).toHaveLength(2)
  })
})
