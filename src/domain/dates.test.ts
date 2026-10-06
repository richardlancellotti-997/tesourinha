import { describe, expect, it } from 'vitest'
import { addMonths, dateWithClampedDay, daysInMonth, diaDaSemana, diffDays, rotuloData, tituloMes, today } from './dates'

describe('rótulos de data', () => {
  it('título do mês', () => {
    expect(tituloMes('2026-10')).toBe('Outubro de 2026')
    expect(tituloMes('2027-03')).toBe('Março de 2027')
  })
  it('dia da semana', () => {
    expect(diaDaSemana('2026-10-05')).toBe(1) // segunda
    expect(diaDaSemana('2026-10-14')).toBe(3) // quarta
  })
  it('hoje, ontem, dia da semana e outro ano', () => {
    expect(rotuloData('2026-10-06', '2026-10-06')).toBe('Hoje, 6 out')
    expect(rotuloData('2026-10-05', '2026-10-06')).toBe('Ontem, 5 out')
    expect(rotuloData('2026-10-03', '2026-10-06')).toBe('Sáb, 3 out')
    expect(rotuloData('2025-12-31', '2026-01-02')).toBe('31 dez 2025')
    expect(rotuloData('2025-12-31', '2026-01-01')).toBe('Ontem, 31 dez')
  })
})

describe('today', () => {
  it('usa o fuso de São Paulo, não UTC', () => {
    // 02:30 UTC de 06/10 ainda é 05/10 em São Paulo (UTC-3)
    expect(today(new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-05')
  })
})

describe('daysInMonth', () => {
  it('fevereiro comum e bissexto', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
  })
})

describe('dateWithClampedDay', () => {
  it('dia 31 em fevereiro vira o último dia', () => {
    expect(dateWithClampedDay(2026, 2, 31)).toBe('2026-02-28')
    expect(dateWithClampedDay(2028, 2, 31)).toBe('2028-02-29')
  })
  it('dia 31 em abril vira 30', () => {
    expect(dateWithClampedDay(2026, 4, 31)).toBe('2026-04-30')
  })
  it('mantém o dia quando cabe', () => {
    expect(dateWithClampedDay(2026, 10, 5)).toBe('2026-10-05')
  })
})

describe('addMonths', () => {
  it('vira o ano', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

describe('diffDays', () => {
  it('conta dias atravessando meses', () => {
    expect(diffDays('2026-01-30', '2026-03-01')).toBe(30)
    expect(diffDays('2026-10-05', '2026-10-05')).toBe(0)
  })
})
