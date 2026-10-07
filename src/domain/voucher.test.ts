import { describe, expect, it } from 'vitest'
import {
  cicloDe,
  creditosEntre,
  DIAS_UTEIS_PADRAO,
  diasNaEmpresa,
  feriadosDoAno,
  feriadosEntre,
  pascoa,
  ritmoDoCiclo,
  saldoVoucher,
} from './voucher'

describe('ciclo', () => {
  it('do dia do crédito até a véspera do próximo', () => {
    expect(cicloDe('2026-10-05', 20)).toEqual({ inicio: '2026-09-20', fim: '2026-10-19', proximoCredito: '2026-10-20' })
    expect(cicloDe('2026-10-20', 20)).toEqual({ inicio: '2026-10-20', fim: '2026-11-19', proximoCredito: '2026-11-20' })
  })
  it('crédito no dia 31: meses curtos usam o último dia', () => {
    expect(cicloDe('2026-02-28', 31)).toEqual({ inicio: '2026-02-28', fim: '2026-03-30', proximoCredito: '2026-03-31' })
    expect(cicloDe('2026-02-27', 31).inicio).toBe('2026-01-31')
  })
  it('atravessa a virada do ano', () => {
    expect(cicloDe('2027-01-05', 20)).toEqual({ inicio: '2026-12-20', fim: '2027-01-19', proximoCredito: '2027-01-20' })
  })
})

describe('créditos mensais', () => {
  it('lista os dias de crédito depois de uma data até hoje', () => {
    expect(creditosEntre('2026-09-25', '2026-12-20', 20)).toEqual(['2026-10-20', '2026-11-20', '2026-12-20'])
    expect(creditosEntre('2026-10-20', '2026-10-25', 20)).toEqual([])
  })
})

describe('feriados', () => {
  it('Páscoa', () => {
    expect(pascoa(2026)).toBe('2026-04-05')
    expect(pascoa(2027)).toBe('2027-03-28')
    expect(pascoa(2025)).toBe('2025-04-20')
  })
  it('móveis de 2026: Carnaval (seg e ter), Sexta-feira Santa e Corpus Christi', () => {
    const datas = feriadosDoAno(2026).map((f) => f.data)
    expect(datas).toEqual(expect.arrayContaining(['2026-02-16', '2026-02-17', '2026-04-03', '2026-06-04']))
    expect(datas).toContain('2026-11-20') // Consciência Negra (nacional desde 2024)
  })
  it('só conta feriado que cai em dia na empresa', () => {
    // 15/11/2026 é domingo
    expect(feriadosEntre('2026-11-01', '2026-11-30', DIAS_UTEIS_PADRAO).map((f) => f.data)).toEqual(['2026-11-02', '2026-11-20'])
  })
})

describe('dias na empresa', () => {
  it('segunda a sexta sem o feriado de 12/10', () => {
    // 05/10 (seg) a 19/10 (seg): 11 dias úteis menos 12/10
    expect(diasNaEmpresa('2026-10-05', '2026-10-19', DIAS_UTEIS_PADRAO)).toBe(10)
  })
  it('regime híbrido (terça a quinta)', () => {
    const hibrido = [false, false, true, true, true, false, false]
    expect(diasNaEmpresa('2026-10-05', '2026-10-19', hibrido)).toBe(6) // 6,7,8 + 13,14,15 (12 é segunda)
  })
  it('intervalo vazio', () => {
    expect(diasNaEmpresa('2026-10-10', '2026-10-09', DIAS_UTEIS_PADRAO)).toBe(0)
  })
})

describe('saldo e ritmo', () => {
  const ciclo = cicloDe('2026-10-05', 20)
  const creditos = [
    { data: '2026-08-20', valor: 110000 },
    { data: '2026-09-20', valor: 110000 },
  ]
  const gastos = [
    { data: '2026-09-01', valor: 100000 }, // ciclo anterior
    { data: '2026-10-01', valor: 68720 },
    { data: '2026-10-30', valor: 99999 }, // futuro: não conta
  ]
  it('acumulando: sobra do ciclo anterior entra no saldo', () => {
    expect(saldoVoucher(creditos, gastos, '2026-10-05', ciclo, true)).toBe(220000 - 168720)
  })
  it('sem acumular: só o ciclo atual', () => {
    expect(saldoVoucher(creditos, gastos, '2026-10-05', ciclo, false)).toBe(110000 - 68720)
  })
  it('dá para gastar por dia útil = saldo ÷ dias na empresa restantes (contando hoje)', () => {
    const r = ritmoDoCiclo(41280, '2026-10-05', ciclo, DIAS_UTEIS_PADRAO)
    expect(r.diasRestantes).toBe(10)
    expect(r.porDia).toBe(4128)
    expect(r.diasNoCiclo).toBe(20)
    expect(r.diasPassados).toBe(10)
  })
  it('sem dias na empresa restantes, não há valor por dia', () => {
    expect(ritmoDoCiclo(5000, '2026-10-18', ciclo, [false, false, false, false, false, false, false]).porDia).toBeNull()
  })
})
