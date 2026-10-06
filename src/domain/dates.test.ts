import { describe, expect, it } from 'vitest'
import { addMonths, dateWithClampedDay, daysInMonth, diffDays, today } from './dates'

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
