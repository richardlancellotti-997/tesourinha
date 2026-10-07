// Regras do voucher (vale-alimentação): ciclo, feriados, dias na empresa, saldo e
// quanto dá para gastar por dia. Funções puras.

import { addDays, addMonths, dateWithClampedDay, diaDaSemana, makeDate, yearMonthOf, type LocalDate } from './dates'
import type { Cents } from './money'

/** Dia em que o crédito cai num mês (dia 31 em fevereiro vira o último dia). */
export function dataDoCredito(ym: string, diaCredito: number): LocalDate {
  const [y, m] = ym.split('-').map(Number)
  return dateWithClampedDay(y, m, diaCredito)
}

export interface Ciclo {
  /** Dia do crédito */
  inicio: LocalDate
  /** Véspera do próximo crédito */
  fim: LocalDate
  proximoCredito: LocalDate
}

/** Ciclo que contém `hoje`: do último dia de crédito até a véspera do próximo. */
export function cicloDe(hoje: LocalDate, diaCredito: number): Ciclo {
  const ym = yearMonthOf(hoje)
  const credMes = dataDoCredito(ym, diaCredito)
  const inicio = hoje >= credMes ? credMes : dataDoCredito(addMonths(ym, -1), diaCredito)
  const proximoCredito = dataDoCredito(addMonths(yearMonthOf(inicio), 1), diaCredito)
  return { inicio, fim: addDays(proximoCredito, -1), proximoCredito }
}

/** Datas de crédito depois de `depoisDe` (exclusive) até `ate` (inclusive). */
export function creditosEntre(depoisDe: LocalDate, ate: LocalDate, diaCredito: number): LocalDate[] {
  const datas: LocalDate[] = []
  let ym = yearMonthOf(depoisDe)
  for (;;) {
    const d = dataDoCredito(ym, diaCredito)
    if (d > ate) break
    if (d > depoisDe) datas.push(d)
    ym = addMonths(ym, 1)
  }
  return datas
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): LocalDate {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return makeDate(ano, mes, dia)
}

export interface Feriado {
  data: LocalDate
  nome: string
}

/**
 * Dias sem expediente considerados (decisão de 06/10/2026): feriados nacionais +
 * Carnaval (segunda e terça) e Corpus Christi, em que a empresa também não funciona.
 */
export function feriadosDoAno(ano: number): Feriado[] {
  const p = pascoa(ano)
  const fixo = (mmdd: string, nome: string) => ({ data: `${ano}-${mmdd}`, nome })
  return [
    fixo('01-01', 'Confraternização Universal'),
    { data: addDays(p, -48), nome: 'Carnaval' },
    { data: addDays(p, -47), nome: 'Carnaval' },
    { data: addDays(p, -2), nome: 'Sexta-feira Santa' },
    fixo('04-21', 'Tiradentes'),
    fixo('05-01', 'Dia do Trabalho'),
    { data: addDays(p, 60), nome: 'Corpus Christi' },
    fixo('09-07', 'Independência'),
    fixo('10-12', 'Nossa Senhora Aparecida'),
    fixo('11-02', 'Finados'),
    fixo('11-15', 'Proclamação da República'),
    fixo('11-20', 'Consciência Negra'),
    fixo('12-25', 'Natal'),
  ].sort((a, b) => (a.data < b.data ? -1 : 1))
}

/** Feriados que caem em dias na empresa entre duas datas (inclusive). */
export function feriadosEntre(de: LocalDate, ate: LocalDate, diasEmpresa: boolean[]): Feriado[] {
  const anos = new Set([Number(de.slice(0, 4)), Number(ate.slice(0, 4))])
  return [...anos]
    .flatMap(feriadosDoAno)
    .filter((f) => f.data >= de && f.data <= ate && diasEmpresa[diaDaSemana(f.data)])
}

/** Quantos dias na empresa há entre duas datas (inclusive), sem os feriados. */
export function diasNaEmpresa(de: LocalDate, ate: LocalDate, diasEmpresa: boolean[]): number {
  if (de > ate) return 0
  const folgas = new Set(feriadosEntre(de, ate, diasEmpresa).map((f) => f.data))
  let n = 0
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    if (diasEmpresa[diaDaSemana(d)] && !folgas.has(d)) n++
  }
  return n
}

export function ehDiaNaEmpresa(d: LocalDate, diasEmpresa: boolean[]): boolean {
  return diasNaEmpresa(d, d, diasEmpresa) === 1
}

export interface Movimento {
  data: LocalDate
  valor: Cents
}

/**
 * Saldo em `hoje`. Acumulando: todos os créditos menos todos os gastos até hoje.
 * Sem acumular: só o que entrou e saiu no ciclo atual.
 */
export function saldoVoucher(
  creditos: Movimento[],
  gastos: Movimento[],
  hoje: LocalDate,
  ciclo: Ciclo,
  acumula: boolean,
): Cents {
  const desde = acumula ? '0000-01-01' : ciclo.inicio
  const soma = (l: Movimento[]) => l.filter((m) => m.data >= desde && m.data <= hoje).reduce((s, m) => s + m.valor, 0)
  return soma(creditos) - soma(gastos)
}

export interface Ritmo {
  /** Dias na empresa de hoje (se for um) até o fim do ciclo */
  diasRestantes: number
  /** Saldo ÷ dias restantes; null se não há mais dias na empresa no ciclo */
  porDia: Cents | null
  diasNoCiclo: number
  /** Dias na empresa do ciclo que já passaram (antes de hoje) */
  diasPassados: number
}

export function ritmoDoCiclo(saldo: Cents, hoje: LocalDate, ciclo: Ciclo, diasEmpresa: boolean[]): Ritmo {
  const diasRestantes = diasNaEmpresa(hoje, ciclo.fim, diasEmpresa)
  return {
    diasRestantes,
    porDia: diasRestantes > 0 ? Math.max(0, Math.floor(saldo / diasRestantes)) : null,
    diasNoCiclo: diasNaEmpresa(ciclo.inicio, ciclo.fim, diasEmpresa),
    diasPassados: diasNaEmpresa(ciclo.inicio, addDays(hoje, -1), diasEmpresa),
  }
}

export const DIAS_UTEIS_PADRAO = [false, true, true, true, true, true, false]

/**
 * Dias úteis para o CRÉDITO do voucher (decisão de 07/10/2026): segunda a sexta sem os
 * feriados nacionais oficiais. Carnaval e Corpus Christi (ponto facultativo) CONTAM.
 * É independente dos dias na empresa, usados só no "dá para gastar por dia".
 */
export function diasUteisDoMes(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  const oficiais = new Set(
    feriadosDoAno(y)
      .filter((f) => f.nome !== 'Carnaval' && f.nome !== 'Corpus Christi')
      .map((f) => f.data),
  )
  let n = 0
  for (let d = makeDate(y, m, 1); d.startsWith(ym); d = addDays(d, 1)) {
    const dia = diaDaSemana(d)
    if (dia >= 1 && dia <= 5 && !oficiais.has(d)) n++
  }
  return n
}

export type MesDoCredito = 'seguinte' | 'mesmo'

/** Mês cujos dias úteis o crédito paga (crédito de 30/10 → novembro, no modelo "seguinte"). */
export function mesPagoPeloCredito(dataCredito: LocalDate, mes: MesDoCredito): string {
  const ym = yearMonthOf(dataCredito)
  return mes === 'seguinte' ? addMonths(ym, 1) : ym
}

/** Valor do crédito = valor por dia útil × dias úteis do mês que ele paga. */
export function valorDoCredito(dataCredito: LocalDate, valorPorDia: Cents, mes: MesDoCredito): { valor: Cents; dias: number; ym: string } {
  const ym = mesPagoPeloCredito(dataCredito, mes)
  const dias = diasUteisDoMes(ym)
  return { valor: valorPorDia * dias, dias, ym }
}
