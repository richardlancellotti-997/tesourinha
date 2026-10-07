// Regras do cartão de crédito: a qual fatura uma compra pertence, datas da fatura,
// parcelas e situação. Funções puras.
//
// Convenção: a fatura é identificada pelo mês em que FECHA ("2026-10" = fatura que fecha
// em outubro). O vencimento vem dos dias configurados.

import { addMonths, dateWithClampedDay, yearMonthOf, type LocalDate, type YearMonth } from './dates'
import { splitCents, type Cents } from './money'

export interface ConfigCartao {
  diaFechamento: number
  diaVencimento: number
}

function partes(ref: YearMonth) {
  const [y, m] = ref.split('-').map(Number)
  return { y, m }
}

/** Dia em que a fatura fecha (dia 31 em fevereiro vira o último dia do mês). */
export function fechamentoDe(ref: YearMonth, cfg: ConfigCartao): LocalDate {
  const { y, m } = partes(ref)
  return dateWithClampedDay(y, m, cfg.diaFechamento)
}

/**
 * Vencimento: no mesmo mês do fechamento se o dia de vencimento vem depois do de
 * fechamento (fecha 14, vence 21); senão, no mês seguinte (fecha 28, vence 5).
 */
export function vencimentoDe(ref: YearMonth, cfg: ConfigCartao): LocalDate {
  const mes = cfg.diaVencimento > cfg.diaFechamento ? ref : addMonths(ref, 1)
  const { y, m } = partes(mes)
  return dateWithClampedDay(y, m, cfg.diaVencimento)
}

export interface FaturaPelaData {
  /** Fatura padrão: a que fecha no mês da compra, ou a seguinte se a compra foi depois do fechamento */
  ref: YearMonth
  /** Compra no dia exato do fechamento: o usuário escolhe entre `ref` e a seguinte */
  diaDeFechamento: boolean
}

export function faturaPelaData(data: LocalDate, cfg: ConfigCartao): FaturaPelaData {
  const ym = yearMonthOf(data)
  const fechamento = fechamentoDe(ym, cfg)
  if (data < fechamento) return { ref: ym, diaDeFechamento: false }
  if (data === fechamento) return { ref: ym, diaDeFechamento: true }
  return { ref: addMonths(ym, 1), diaDeFechamento: false }
}

export type EscolhaFatura = 'esta' | 'proxima'

/** Fatura da compra (da 1ª parcela). No dia do fechamento a escolha é obrigatória. */
export function faturaDaCompra(data: LocalDate, cfg: ConfigCartao, escolha?: EscolhaFatura): YearMonth {
  const { ref, diaDeFechamento } = faturaPelaData(data, cfg)
  if (!diaDeFechamento) return ref
  if (!escolha) throw new Error('Compra no dia do fechamento: escolha a fatura')
  return escolha === 'esta' ? ref : addMonths(ref, 1)
}

/** Fatura em aberto hoje: a que ainda vai fechar (no dia do fechamento ela ainda está aberta). */
export function faturaAberta(hoje: LocalDate, cfg: ConfigCartao): YearMonth {
  const ym = yearMonthOf(hoje)
  return hoje <= fechamentoDe(ym, cfg) ? ym : addMonths(ym, 1)
}

export interface Parcela {
  numero: number
  valor: Cents
  faturaRef: YearMonth
}

/** Uma parcela por fatura consecutiva; a sobra dos centavos vai para a primeira. */
export function parcelar(total: Cents, quantidade: number, faturaInicial: YearMonth): Parcela[] {
  return splitCents(total, quantidade).map((valor, i) => ({
    numero: i + 1,
    valor,
    faturaRef: addMonths(faturaInicial, i),
  }))
}

/**
 * Mês em que o lançamento conta no balanço (decisão de 06/10/2026):
 * - crédito (à vista ou parcela): mês em que a fatura dele VENCE, quando o dinheiro sai;
 * - débito/Pix, voucher e receitas: mês da data.
 * Sem a configuração do cartão, usa o mês da própria fatura.
 */
export function mesNoBalanco(
  l: { formaPagamento: string; data: LocalDate; faturaRef?: YearMonth },
  cfg?: ConfigCartao,
): YearMonth {
  if (l.formaPagamento !== 'credito' || !l.faturaRef) return yearMonthOf(l.data)
  return cfg ? yearMonthOf(vencimentoDe(l.faturaRef, cfg)) : l.faturaRef
}

export type SituacaoFatura = 'aberta' | 'fechada' | 'vencida' | 'paga'

export function situacaoDaFatura(
  ref: YearMonth,
  cfg: ConfigCartao,
  hoje: LocalDate,
  total: Cents,
  pago: Cents,
): SituacaoFatura {
  if (total > 0 && pago >= total) return 'paga' // inclusive paga antes de fechar
  if (hoje <= fechamentoDe(ref, cfg)) return 'aberta'
  if (total === 0) return 'paga'
  return hoje > vencimentoDe(ref, cfg) ? 'vencida' : 'fechada'
}
