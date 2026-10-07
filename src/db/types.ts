import type { Cents } from '../domain/money'
import type { LocalDate, YearMonth } from '../domain/dates'

// Todos os registros têm id, createdAt e updatedAt (ISO 8601).
export interface BaseRecord {
  id: string
  createdAt: string
  updatedAt: string
}

export type Kind = 'despesa' | 'receita'
export type PaymentMethod = 'debito_pix' | 'credito' | 'voucher'
export type Theme = 'auto' | 'claro' | 'escuro'

export interface Profile extends BaseRecord {
  nome: string
  corDestaque: string
  tema: Theme
  ultimoBackupEm?: string
  /** Última forma de pagamento usada num gasto: vem pré-selecionada no próximo. */
  ultimaForma?: PaymentMethod
}

export interface Category extends BaseRecord {
  nome: string
  tipo: Kind
  icone?: string
  cor?: string
  ordem: number
  arquivada: boolean
  permitidaNoVoucher: boolean
}

export interface Card extends BaseRecord {
  nome: string
  diaFechamento: number
  diaVencimento: number
  limite?: Cents
  arquivado: boolean
}

export interface Transaction extends BaseRecord {
  tipo: Kind
  valor: Cents
  data: LocalDate
  /** Mês em que conta no balanço (crédito: mês do vencimento da fatura). Desde o esquema 2. */
  mesBalanco: YearMonth
  categoriaId: string
  descricao?: string
  formaPagamento: PaymentMethod
  cardId?: string
  faturaRef?: YearMonth
  parcelaGrupoId?: string
  parcelaNumero?: number
  parcelaTotal?: number
  recorrenciaId?: string
}

export interface IncomeExpected extends BaseRecord {
  valor: Cents
  dataPrevista: LocalDate
  categoriaId: string
  descricao?: string
  devedor?: string
  status: 'prevista' | 'recebida'
  dataRecebimento?: LocalDate
  transacaoId?: string
}

export interface RecurrenceValue {
  aPartirDe: LocalDate
  valor: Cents
}

export interface Recurrence extends BaseRecord {
  nome: string
  tipo: Kind
  diaDoMes: number
  formaPagamento: PaymentMethod
  categoriaId: string
  cardId?: string
  inicio: LocalDate
  fim?: LocalDate
  ativa: boolean
  historicoDeValores: RecurrenceValue[]
}

export interface VoucherConfig extends BaseRecord {
  valorMensal: Cents
  diaCredito: number
  acumulaSaldo: boolean
  /** Dias da semana na empresa, 0 = domingo … 6 = sábado */
  diasEmpresa: boolean[]
  /** Dia em que o voucher foi configurado (o saldo informado vale a partir dele) */
  inicio: LocalDate
}

export interface VoucherCredit extends BaseRecord {
  data: LocalDate
  /** Pode ser negativo numa correção de saldo */
  valor: Cents
  /** inicial = saldo informado ao configurar; mensal = crédito automático; ajuste = correção */
  origem: 'inicial' | 'mensal' | 'ajuste'
}

export interface InvoicePayment extends BaseRecord {
  cardId: string
  faturaRef: YearMonth
  valorPago: Cents
  dataPagamento: LocalDate
}
