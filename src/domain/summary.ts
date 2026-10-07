// Resumo do mês e agrupamentos. Funções puras: recebem os lançamentos e devolvem números.

import type { Cents } from './money'
import type { LocalDate, YearMonth } from './dates'

export type FormaPagamento = 'debito_pix' | 'credito' | 'voucher'

/** O mínimo de um lançamento que o resumo precisa. */
export interface LancamentoBase {
  id: string
  tipo: 'despesa' | 'receita'
  valor: Cents
  data: LocalDate
  /** Mês em que conta no balanço (crédito: mês do vencimento da fatura). Ver mesNoBalanco. */
  mesBalanco: YearMonth
  categoriaId: string
  formaPagamento: FormaPagamento
  createdAt: string
  parcelaGrupoId?: string
  parcelaNumero?: number
  parcelaTotal?: number
}

export interface TotalCategoria {
  /** null = "Demais categorias" (agrupamento das menores) */
  categoriaId: string | null
  total: Cents
  /** Quanto do total veio de parcelas de compras parceladas no crédito */
  parcelado: Cents
}

export interface ResumoMes {
  entrou: Cents
  saiu: Cents
  sobrou: Cents
  saiuPorForma: Record<FormaPagamento, Cents>
  /** Despesas por categoria, do maior para o menor */
  porCategoria: TotalCategoria[]
}

/**
 * Resumo de um mês pelo mês no balanço: débito e receitas pela data; crédito pelo mês em
 * que a fatura vence (cada parcela no seu mês).
 */
export function resumoDoMes(lancamentos: LancamentoBase[], ym: YearMonth): ResumoMes {
  let entrou = 0
  let saiu = 0
  const saiuPorForma: Record<FormaPagamento, Cents> = { debito_pix: 0, credito: 0, voucher: 0 }
  const cats = new Map<string, { total: Cents; parcelado: Cents }>()

  for (const l of lancamentos) {
    if (l.mesBalanco !== ym) continue
    if (l.tipo === 'receita') {
      entrou += l.valor
    } else {
      saiu += l.valor
      saiuPorForma[l.formaPagamento] += l.valor
      const c = cats.get(l.categoriaId) ?? { total: 0, parcelado: 0 }
      c.total += l.valor
      if (l.parcelaGrupoId) c.parcelado += l.valor
      cats.set(l.categoriaId, c)
    }
  }

  const porCategoria = [...cats.entries()]
    .map(([categoriaId, c]) => ({ categoriaId, ...c }))
    .sort((a, b) => b.total - a.total)

  return { entrou, saiu, sobrou: entrou - saiu, saiuPorForma, porCategoria }
}

/** Mantém as `n` maiores categorias e soma o resto numa linha "Demais categorias". */
export function principaisCategorias(porCategoria: TotalCategoria[], n = 5): TotalCategoria[] {
  if (porCategoria.length <= n + 1) return porCategoria
  const resto = porCategoria.slice(n)
  return [
    ...porCategoria.slice(0, n),
    {
      categoriaId: null,
      total: resto.reduce((s, c) => s + c.total, 0),
      parcelado: resto.reduce((s, c) => s + c.parcelado, 0),
    },
  ]
}

export interface ItemCompra {
  valorTotal: Cents
  /** Quanto desta compra conta no balanço do mês pedido */
  valorNoMes: Cents
  /** Primeiro mês em que a compra conta no balanço */
  mesInicial: YearMonth
}

/**
 * Junta as parcelas de uma mesma compra numa linha só (representada pela 1ª parcela).
 * Todas as parcelas guardam a data da compra.
 */
export function juntarParcelas<T extends LancamentoBase>(lancamentos: T[], ym: YearMonth): (T & ItemCompra)[] {
  const grupos = new Map<string, number>()
  const resultado: (T & ItemCompra)[] = []
  for (const l of lancamentos) {
    const noMes = l.mesBalanco === ym ? l.valor : 0
    const idx = l.parcelaGrupoId ? grupos.get(l.parcelaGrupoId) : undefined
    if (idx === undefined) {
      if (l.parcelaGrupoId) grupos.set(l.parcelaGrupoId, resultado.length)
      resultado.push({ ...l, valorTotal: l.valor, valorNoMes: noMes, mesInicial: l.mesBalanco })
      continue
    }
    const atual = resultado[idx]
    const junto = {
      valorTotal: atual.valorTotal + l.valor,
      valorNoMes: atual.valorNoMes + noMes,
      mesInicial: l.mesBalanco < atual.mesInicial ? l.mesBalanco : atual.mesInicial,
    }
    // a linha representa a 1ª parcela (o link de edição abre a compra a partir dela)
    resultado[idx] = (l.parcelaNumero ?? 0) < (atual.parcelaNumero ?? 0) ? { ...l, ...junto } : { ...atual, ...junto }
  }
  return resultado
}

export interface GrupoDia<T> {
  data: LocalDate
  itens: T[]
}

/** Agrupa por dia, do dia mais recente para o mais antigo; dentro do dia, o último lançado primeiro. */
export function agruparPorDia<T extends { data: LocalDate; createdAt: string }>(lancamentos: T[]): GrupoDia<T>[] {
  const grupos = new Map<LocalDate, T[]>()
  for (const l of lancamentos) {
    const lista = grupos.get(l.data)
    if (lista) lista.push(l)
    else grupos.set(l.data, [l])
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([data, itens]) => ({
      data,
      itens: itens.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    }))
}
