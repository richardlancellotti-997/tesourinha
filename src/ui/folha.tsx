import { useEffect, useState } from 'preact/hooks'

// Folha de escolha que sobe da parte de baixo da tela ("Editar só esta parcela" / "a compra toda").
// Fica dentro da .app (position: absolute), nunca position: fixed (ver DECISOES.md).

export interface OpcaoFolha {
  valor: string
  rotulo: string
  perigo?: boolean
}

interface Pedido {
  titulo: string
  texto?: string
  opcoes: OpcaoFolha[]
  responder: (v: string | null) => void
}

let atual: Pedido | null = null
const ouvintes = new Set<() => void>()
const avisarOuvintes = () => ouvintes.forEach((f) => f())

/** Abre a folha e devolve o valor escolhido (ou null se cancelar). */
export function escolher(titulo: string, opcoes: OpcaoFolha[], texto?: string): Promise<string | null> {
  atual?.responder(null)
  return new Promise((resolve) => {
    atual = {
      titulo,
      texto,
      opcoes,
      responder: (v) => {
        atual = null
        avisarOuvintes()
        resolve(v)
      },
    }
    avisarOuvintes()
  })
}

export function Folha() {
  const [, forcar] = useState(0)
  useEffect(() => {
    const f = () => forcar((n) => n + 1)
    ouvintes.add(f)
    return () => {
      ouvintes.delete(f)
    }
  }, [])

  useEffect(() => {
    if (!atual) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && atual?.responder(null)
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  if (!atual) return null
  const pedido = atual
  return (
    <div class="folha-fundo" onClick={(e) => e.target === e.currentTarget && pedido.responder(null)}>
      <div class="folha" role="dialog" aria-modal="true" aria-labelledby="folha-titulo">
        <h2 id="folha-titulo">{pedido.titulo}</h2>
        {pedido.texto && <p class="apoio">{pedido.texto}</p>}
        <div class="folha-opcoes">
          {pedido.opcoes.map((o, i) => (
            <button
              key={o.valor}
              class={o.perigo ? 'folha-opcao perigo' : 'folha-opcao'}
              autoFocus={i === 0}
              onClick={() => pedido.responder(o.valor)}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
        <button class="folha-cancelar" onClick={() => pedido.responder(null)}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
