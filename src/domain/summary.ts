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
  categoriaId: string
  formaPagamento: FormaPagamento
  createdAt: string
}

export interface TotalCategoria {
  /** null = "Demais categorias" (agrupamento das menores) */
  categoriaId: string | null
  total: Cents
}

export interface ResumoMes {
  entrou: Cents
  saiu: Cents
  sobrou: Cents
  saiuPorForma: Record<FormaPagamento, Cents>
  /** Despesas por categoria, do maior para o menor */
  porCategoria: TotalCategoria[]
}

/** Resumo de um mês. Crédito conta pela data da compra (decisão aprovada). */
export function resumoDoMes(lancamentos: LancamentoBase[], ym: YearMonth): ResumoMes {
  let entrou = 0
  let saiu = 0
  const saiuPorForma: Record<FormaPagamento, Cents> = { debito_pix: 0, credito: 0, voucher: 0 }
  const cats = new Map<string, Cents>()

  for (const l of lancamentos) {
    if (!l.data.startsWith(ym)) continue
    if (l.tipo === 'receita') {
      entrou += l.valor
    } else {
      saiu += l.valor
      saiuPorForma[l.formaPagamento] += l.valor
      cats.set(l.categoriaId, (cats.get(l.categoriaId) ?? 0) + l.valor)
    }
  }

  const porCategoria = [...cats.entries()]
    .map(([categoriaId, total]) => ({ categoriaId, total }))
    .sort((a, b) => b.total - a.total)

  return { entrou, saiu, sobrou: entrou - saiu, saiuPorForma, porCategoria }
}

/** Mantém as `n` maiores categorias e soma o resto numa linha "Demais categorias". */
export function principaisCategorias(porCategoria: TotalCategoria[], n = 5): TotalCategoria[] {
  if (porCategoria.length <= n + 1) return porCategoria
  const resto = porCategoria.slice(n).reduce((s, c) => s + c.total, 0)
  return [...porCategoria.slice(0, n), { categoriaId: null, total: resto }]
}

export interface GrupoDia<T> {
  data: LocalDate
  itens: T[]
}

/** Agrupa por dia, do dia mais recente para o mais antigo; dentro do dia, o último lançado primeiro. */
export function agruparPorDia<T extends LancamentoBase>(lancamentos: T[]): GrupoDia<T>[] {
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
