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

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "2026-10-21" → "21/10" */
export function diaMes(d: LocalDate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

/** "2026-10-21" → "21/10, quarta" */
export function diaMesSemana(d: LocalDate): string {
  return `${diaMes(d)}, ${DIAS[diaDaSemana(d)]}`
}

/** "2026-10" → "outubro" */
export function nomeMes(ym: YearMonth): string {
  return MESES[Number(ym.slice(5, 7)) - 1]
}

/** "2026-10" → "Outubro de 2026" */
export function tituloMes(ym: YearMonth): string {
  return `${capitalizar(nomeMes(ym))} de ${ym.slice(0, 4)}`
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(d: LocalDate): number {
  const { year, month, day } = parseDate(d)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** "Hoje, 6 out", "Ontem, 5 out", "Sáb, 3 out" ou, em outro ano, "3 out 2025". */
export function rotuloData(d: LocalDate, hoje: LocalDate): string {
  const { year, month, day } = parseDate(d)
  const curta = `${day} ${MESES_CURTOS[month - 1]}`
  const dif = diffDays(d, hoje)
  if (dif === 0) return `Hoje, ${curta}`
  if (dif === 1) return `Ontem, ${curta}`
  if (year !== parseDate(hoje).year) return `${curta} ${year}`
  return `${DIAS_CURTOS[diaDaSemana(d)]}, ${curta}`
}

/** Soma (ou subtrai) dias a uma data local. */
export function addDays(d: LocalDate, n: number): LocalDate {
  const { year, month, day } = parseDate(d)
  const dt = new Date(Date.UTC(year, month - 1, day + n))
  return makeDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Diferença em dias entre duas datas locais (b - a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const toUTC = (d: LocalDate) => {
    const { year, month, day } = parseDate(d)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000)
}
