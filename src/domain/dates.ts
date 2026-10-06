// Datas são guardadas como data local "AAAA-MM-DD" (sem hora, sem fuso).
// Fuso de referência para "hoje": America/Sao_Paulo.

export type LocalDate = string // "2026-10-05"
export type YearMonth = string // "2026-10"

const TZ = 'America/Sao_Paulo'

export function today(now: Date = new Date()): LocalDate {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function parseDate(d: LocalDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) throw new RangeError(`Data inválida: ${d}`)
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function makeDate(year: number, month: number, day: number): LocalDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Dia configurado (ex.: 31) ajustado ao último dia do mês quando necessário. */
export function dateWithClampedDay(year: number, month: number, day: number): LocalDate {
  return makeDate(year, month, Math.min(day, daysInMonth(year, month)))
}

export function yearMonthOf(d: LocalDate): YearMonth {
  return d.slice(0, 7)
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

/** Diferença em dias entre duas datas locais (b - a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const toUTC = (d: LocalDate) => {
    const { year, month, day } = parseDate(d)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000)
}
