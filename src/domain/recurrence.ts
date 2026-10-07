// Recorrências (assinaturas, contas fixas, salário): em que datas caem, qual valor vale
// em cada data e o total do mês. Funções puras.

import { addMonths, dateWithClampedDay, yearMonthOf, type LocalDate } from './dates'
import type { Cents } from './money'

export interface ValorAPartirDe {
  aPartirDe: LocalDate
  valor: Cents
}

export interface RecorrenciaBase {
  diaDoMes: number
  /** Primeiro dia em que pode cair */
  inicio: LocalDate
  /** Último dia em que pode cair (encerrada) */
  fim?: LocalDate
  historicoDeValores: ValorAPartirDe[]
}

/** Datas em que a recorrência cai depois de `depoisDe` (exclusive) até `ate` (inclusive). */
export function datasEntre(rec: RecorrenciaBase, depoisDe: LocalDate, ate: LocalDate): LocalDate[] {
  const datas: LocalDate[] = []
  const limite = rec.fim && rec.fim < ate ? rec.fim : ate
  let ym = yearMonthOf(depoisDe > rec.inicio ? depoisDe : rec.inicio)
  for (;;) {
    const [y, m] = ym.split('-').map(Number)
    const d = dateWithClampedDay(y, m, rec.diaDoMes)
    if (d > limite) break
    if (d > depoisDe && d >= rec.inicio) datas.push(d)
    ym = addMonths(ym, 1)
  }
  return datas
}

/** Valor que vale numa data: o último ajuste feito até ela (mudanças não reescrevem o passado). */
export function valorNaData(rec: Pick<RecorrenciaBase, 'historicoDeValores'>, data: LocalDate): Cents {
  const ordenado = [...rec.historicoDeValores].sort((a, b) => (a.aPartirDe < b.aPartirDe ? -1 : 1))
  let valor = ordenado[0]?.valor ?? 0
  for (const v of ordenado) if (v.aPartirDe <= data) valor = v.valor
  return valor
}

/** Inclui um novo valor a partir de uma data (substitui um ajuste do mesmo dia). */
export function comNovoValor(historico: ValorAPartirDe[], aPartirDe: LocalDate, valor: Cents): ValorAPartirDe[] {
  return [...historico.filter((v) => v.aPartirDe !== aPartirDe), { aPartirDe, valor }].sort((a, b) =>
    a.aPartirDe < b.aPartirDe ? -1 : 1,
  )
}

/** Próxima data em que cai, a partir de `depoisDe` (exclusive). */
export function proximaData(rec: RecorrenciaBase, depoisDe: LocalDate): LocalDate | null {
  const ate = addMonths(yearMonthOf(depoisDe), 14) + '-28'
  return datasEntre(rec, depoisDe, ate)[0] ?? null
}
