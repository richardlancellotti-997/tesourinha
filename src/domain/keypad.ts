// Teclado estilo caixa registradora: os dígitos entram pelos centavos.
// "2" → 0,02; "25" → 0,25; "2590" → 25,90.

import type { Cents } from './money'

export type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'apagar'

/** Até 9.999.999,99 */
export const MAX_DIGITOS = 9

export function pressionar(digitos: string, tecla: Tecla): string {
  if (tecla === 'apagar') return digitos.slice(0, -1)
  const novo = (digitos + tecla).replace(/^0+/, '')
  return novo.length > MAX_DIGITOS ? digitos : novo
}

export function digitosParaCentavos(digitos: string): Cents {
  return digitos ? Number(digitos) : 0
}

export function centavosParaDigitos(cents: Cents): string {
  return cents > 0 ? String(cents) : ''
}
