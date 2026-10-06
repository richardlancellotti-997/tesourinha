import { useEffect, useState } from 'preact/hooks'

// Navegação por hash (#/fatura): funciona no GitHub Pages sem 404 ao recarregar.

function currentPath(): string {
  return window.location.hash.replace(/^#/, '') || '/'
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

export function href(path: string): string {
  return `#${path}`
}
