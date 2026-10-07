import { MAX_DIGITOS } from '../domain/keypad'
import { formatValor, type Cents } from '../domain/money'
import { Icon } from './Icon'

/**
 * Campo de valor em reais que se preenche pelos centavos, como o teclado do lançamento:
 * digitar 72088 mostra 720,88. Usa o teclado só de números, então a vírgula aparece
 * sempre, mesmo com o iPhone configurado numa região que usa ponto.
 */
export function CampoValor({
  valor,
  aoMudar,
  rotulo,
  placeholder = '0,00',
}: {
  valor: Cents | null
  aoMudar: (c: Cents | null) => void
  rotulo?: string
  placeholder?: string
}) {
  return (
    <input
      class="campo-linha"
      inputMode="numeric"
      autoComplete="off"
      aria-label={rotulo}
      placeholder={placeholder}
      value={valor === null ? '' : formatValor(valor)}
      onInput={(e) => {
        const digitos = e.currentTarget.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITOS)
        const cents = digitos ? Number(digitos) : null
        e.currentTarget.value = cents === null ? '' : formatValor(cents)
        aoMudar(cents)
      }}
    />
  )
}

/**
 * Lista de opções com o valor escrito à direita, alinhado aos outros campos.
 * O Safari ignora o alinhamento de <select>; o select fica invisível por cima do texto.
 */
export function CampoLista<T extends string | number>({
  valor,
  opcoes,
  aoMudar,
  rotulo,
  placeholder = 'Escolha',
}: {
  valor: T | null
  opcoes: { valor: T; rotulo: string }[]
  aoMudar: (v: T) => void
  rotulo: string
  placeholder?: string
}) {
  const atual = opcoes.find((o) => o.valor === valor)
  return (
    <span class="campo-lista">
      <span class={atual ? '' : 'campo-lista-vazio'}>{atual?.rotulo ?? placeholder}</span>
      <Icon nome="abaixo" size={16} />
      <select
        aria-label={rotulo}
        value={valor === null ? '' : String(valor)}
        onChange={(e) => {
          const escolhido = opcoes.find((o) => String(o.valor) === e.currentTarget.value)
          if (escolhido) aoMudar(escolhido.valor)
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {opcoes.map((o) => (
          <option key={String(o.valor)} value={String(o.valor)}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </span>
  )
}

export const OPCOES_DIA = Array.from({ length: 31 }, (_, i) => ({ valor: i + 1, rotulo: String(i + 1) }))
