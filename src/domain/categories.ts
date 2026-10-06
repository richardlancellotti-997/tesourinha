// Categorias padrão, cores e ícones disponíveis.

/**
 * Cores das categorias (inspiradas nas cédulas), em ORDEM FIXA. Validadas com o validador
 * de paletas nos modos claro e escuro. Os valores ficam no CSS (--cat-<chave>).
 */
export const CORES_CATEGORIA = ['azul', 'laranja', 'verde', 'lilas', 'ambar', 'magenta', 'ciano', 'ocre', 'cinza'] as const
export type CorCategoria = (typeof CORES_CATEGORIA)[number]

export const ICONES_CATEGORIA = [
  'carrinho', 'talheres', 'onibus', 'casa', 'repetir', 'coracao', 'sorriso', 'sacola', 'pontos',
  'dinheiro', 'ferramenta', 'devolver', 'presente', 'livro', 'pata', 'aviao', 'combustivel', 'cafe',
] as const
export type IconeCategoria = (typeof ICONES_CATEGORIA)[number]

export interface CategoriaPadrao {
  id: string
  nome: string
  tipo: 'despesa' | 'receita'
  cor: CorCategoria
  icone: IconeCategoria
  permitidaNoVoucher: boolean
}

export const CATEGORIAS_PADRAO: CategoriaPadrao[] = [
  { id: 'cat-mercado', nome: 'Mercado', tipo: 'despesa', cor: 'verde', icone: 'carrinho', permitidaNoVoucher: true },
  { id: 'cat-restaurantes', nome: 'Restaurantes', tipo: 'despesa', cor: 'laranja', icone: 'talheres', permitidaNoVoucher: true },
  { id: 'cat-transporte', nome: 'Transporte', tipo: 'despesa', cor: 'azul', icone: 'onibus', permitidaNoVoucher: false },
  { id: 'cat-moradia', nome: 'Moradia', tipo: 'despesa', cor: 'ocre', icone: 'casa', permitidaNoVoucher: false },
  { id: 'cat-assinaturas', nome: 'Assinaturas', tipo: 'despesa', cor: 'lilas', icone: 'repetir', permitidaNoVoucher: false },
  { id: 'cat-saude', nome: 'Saúde', tipo: 'despesa', cor: 'magenta', icone: 'coracao', permitidaNoVoucher: false },
  { id: 'cat-lazer', nome: 'Lazer', tipo: 'despesa', cor: 'ambar', icone: 'sorriso', permitidaNoVoucher: false },
  { id: 'cat-compras', nome: 'Compras', tipo: 'despesa', cor: 'ciano', icone: 'sacola', permitidaNoVoucher: false },
  { id: 'cat-outros', nome: 'Outros', tipo: 'despesa', cor: 'cinza', icone: 'pontos', permitidaNoVoucher: false },
  { id: 'cat-salario', nome: 'Salário', tipo: 'receita', cor: 'verde', icone: 'dinheiro', permitidaNoVoucher: false },
  { id: 'cat-servicos', nome: 'Serviços', tipo: 'receita', cor: 'azul', icone: 'ferramenta', permitidaNoVoucher: false },
  { id: 'cat-reembolso', nome: 'Reembolso ou empréstimo', tipo: 'receita', cor: 'lilas', icone: 'devolver', permitidaNoVoucher: false },
  { id: 'cat-outros-receita', nome: 'Outros', tipo: 'receita', cor: 'cinza', icone: 'pontos', permitidaNoVoucher: false },
]

/** Próxima cor sugerida para uma categoria nova: a primeira ainda não usada no tipo. */
export function sugerirCor(usadas: string[]): CorCategoria {
  return CORES_CATEGORIA.find((c) => c !== 'cinza' && !usadas.includes(c)) ?? 'cinza'
}
