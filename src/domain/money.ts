// Valores monetários são SEMPRE inteiros em centavos. Formatação só na exibição.

export type Cents = number

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100)
}

/** Valor sem o "R$" (o app mostra valores assim nas listas): 123456 → "1.234,56" */
export function formatValor(cents: Cents): string {
  return num.format(cents / 100)
}

/** Receita com "+", despesa com "−" (sinal de menos tipográfico). */
export function formatComSinal(cents: Cents, tipo: 'despesa' | 'receita'): string {
  if (cents === 0) return formatValor(0)
  return (tipo === 'receita' ? '+' : '−') + formatValor(Math.abs(cents))
}

/**
 * Converte o texto digitado ("12", "12,5", "1.234,56", "R$ 9,90") em centavos.
 * Retorna null se o texto não for um valor válido.
 */
export function parseBRL(input: string): Cents | null {
  const cleaned = input.replace(/R\$|\s/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(cleaned)) return null
  const [intPart, decPart = ''] = cleaned.replace(/\./g, '').split(',')
  return Number(intPart) * 100 + Number(decPart.padEnd(2, '0'))
}

/**
 * Divide um total em `parts` inteiros que somam exatamente o total.
 * A sobra do arredondamento vai para a primeira parte.
 * Ex.: 1000 em 3 → [334, 333, 333]
 */
export function splitCents(total: Cents, parts: number): Cents[] {
  if (!Number.isInteger(total) || !Number.isInteger(parts) || parts < 1) {
    throw new RangeError(`splitCents: entrada inválida (${total}, ${parts})`)
  }
  const base = Math.trunc(total / parts)
  const rest = total - base * parts
  return Array.from({ length: parts }, (_, i) => (i === 0 ? base + rest : base))
}
