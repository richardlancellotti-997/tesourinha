import { useEffect, useState } from 'preact/hooks'

// Navegação por hash (#/lancar?tipo=receita): funciona no GitHub Pages sem 404 ao recarregar.

export interface Rota {
  /** Partes do caminho: "#/lancar/abc" → ["lancar", "abc"] */
  partes: string[]
  params: URLSearchParams
}

function rotaAtual(): Rota {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [caminho, busca = ''] = hash.split('?')
  return { partes: caminho.split('/').filter(Boolean), params: new URLSearchParams(busca) }
}

export function useRota(): Rota {
  const [rota, setRota] = useState(rotaAtual)
  useEffect(() => {
    const aoMudar = () => {
      setRota(rotaAtual())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  return rota
}

export function href(caminho: string): string {
  return `#${caminho}`
}

export function navegar(caminho: string, substituir = false) {
  if (substituir) window.location.replace(href(caminho))
  else window.location.hash = caminho
}

// Quantas trocas de tela aconteceram desde que o app abriu.
let trocas = 0
window.addEventListener('hashchange', () => trocas++)

/** Volta para a tela anterior do app; se o app abriu direto nesta tela, vai para o início. */
export function voltar() {
  if (trocas > 0) history.back()
  else navegar('/', true)
}
