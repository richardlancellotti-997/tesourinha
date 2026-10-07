import { describe, expect, it } from 'vitest'
import { formatBRL, formatComSinal, formatValor, parseBRL, splitCents } from './money'

describe('parseBRL', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['0,99', 99],
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['R$ 9,90', 990],
    ['12,', 1200],
  ])('%s → %i centavos', (input, cents) => {
    expect(parseBRL(input)).toBe(cents)
  })

  it.each(['', 'abc', '12,345', '1.23,00', '-5', '12.5'])('rejeita "%s"', (input) => {
    expect(parseBRL(input)).toBeNull()
  })
})

describe('formatBRL', () => {
  it('formata em reais', () => {
    // Intl usa espaço não separável entre R$ e o número
    expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
  })
})

describe('formatValor e formatComSinal', () => {
  it('sem R$, com centavos', () => {
    expect(formatValor(123456)).toBe('1.234,56')
    expect(formatValor(5)).toBe('0,05')
  })
  it('receita com +, despesa com sinal de menos', () => {
    expect(formatComSinal(1890, 'despesa')).toBe('−18,90')
    expect(formatComSinal(520000, 'receita')).toBe('+5.200,00')
    expect(formatComSinal(0, 'despesa')).toBe('0,00')
  })
})

describe('splitCents', () => {
  it('divide exato', () => {
    expect(splitCents(60000, 3)).toEqual([20000, 20000, 20000])
  })
  it('sobra vai para a primeira parte e a soma bate', () => {
    const parts = splitCents(1000, 3)
    expect(parts).toEqual([334, 333, 333])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000)
  })
  it('uma parte só', () => {
    expect(splitCents(999, 1)).toEqual([999])
  })
  it('rejeita entrada inválida', () => {
    expect(() => splitCents(10.5, 2)).toThrow()
    expect(() => splitCents(100, 0)).toThrow()
  })
})
