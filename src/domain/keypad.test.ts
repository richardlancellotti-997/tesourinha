import { describe, expect, it } from 'vitest'
import { centavosParaDigitos, digitosParaCentavos, pressionar, type Tecla } from './keypad'

const digitar = (teclas: Tecla[]) => teclas.reduce(pressionar, '')

describe('teclado em centavos', () => {
  it('2590 vira 25,90', () => {
    expect(digitosParaCentavos(digitar(['2', '5', '9', '0']))).toBe(2590)
  })
  it('"00" multiplica por cem', () => {
    expect(digitosParaCentavos(digitar(['1', '5', '00']))).toBe(1500)
  })
  it('zeros à esquerda não contam', () => {
    expect(digitar(['0', '0', '00', '7'])).toBe('7')
  })
  it('apagar remove o último dígito', () => {
    expect(digitar(['1', '2', '3', 'apagar'])).toBe('12')
    expect(digitar(['apagar'])).toBe('')
  })
  it('ignora dígitos além de 9.999.999,99', () => {
    const cheio = digitar(['9', '9', '9', '9', '9', '9', '9', '9', '9'])
    expect(pressionar(cheio, '1')).toBe(cheio)
    expect(pressionar('12345678', '00')).toBe('12345678')
  })
  it('converte de volta para editar', () => {
    expect(centavosParaDigitos(2590)).toBe('2590')
    expect(centavosParaDigitos(0)).toBe('')
  })
})
