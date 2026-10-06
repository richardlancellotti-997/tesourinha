import { CORES_DESTAQUE } from './theme'

/** Escolha da cor de destaque (bolinhas). */
export function CoresDestaque({ valor, aoEscolher }: { valor: string; aoEscolher: (hex: string) => void }) {
  return (
    <div class="cores-destaque" role="radiogroup" aria-label="Cor de destaque">
      {CORES_DESTAQUE.map((c) => {
        const marcada = c.hex.toLowerCase() === valor.toLowerCase()
        return (
          <button
            key={c.hex}
            role="radio"
            aria-checked={marcada}
            aria-label={c.nome}
            class="cor-bolinha"
            style={{ background: c.hex, boxShadow: marcada ? `0 0 0 3px var(--folha), 0 0 0 5px ${c.hex}` : 'none' }}
            onClick={() => aoEscolher(c.hex)}
          />
        )
      })}
    </div>
  )
}
