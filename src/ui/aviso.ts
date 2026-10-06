import { useEffect, useState } from 'preact/hooks'

// Aviso curto que aparece embaixo e some sozinho ("Gasto salvo").

let atual: { texto: string; id: number } | null = null
const ouvintes = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

export function avisar(texto: string) {
  atual = { texto, id: Date.now() }
  ouvintes.forEach((f) => f())
  clearTimeout(timer)
  timer = setTimeout(() => {
    atual = null
    ouvintes.forEach((f) => f())
  }, 2600)
}

export function useAviso() {
  const [, forcar] = useState(0)
  useEffect(() => {
    const f = () => forcar((n) => n + 1)
    ouvintes.add(f)
    return () => {
      ouvintes.delete(f)
    }
  }, [])
  return atual
}
