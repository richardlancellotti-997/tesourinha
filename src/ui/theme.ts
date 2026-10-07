import type { Profile, Theme } from '../db/types'

export const CORES_DESTAQUE = [
  { hex: '#2442C9', nome: 'Caneta' },
  { hex: '#7445B0', nome: 'Lilás' },
  { hex: '#0E6E78', nome: 'Petróleo' },
  { hex: '#A1336F', nome: 'Ameixa' },
  { hex: '#3A4250', nome: 'Grafite' },
]

const CHAVE = 'tesourinha:tema'

interface TemaSalvo {
  tema: Theme
  cor: string
}

function aplicar({ tema, cor }: TemaSalvo) {
  const raiz = document.documentElement
  if (tema === 'auto') delete raiz.dataset.theme
  else raiz.dataset.theme = tema
  raiz.style.setProperty('--accent', cor)
  // A cor da barra de status NÃO é trocada aqui: no iOS instalado, mudar a meta
  // theme-color em tempo de execução desloca a barra de navegação para fora da tela.
}

/** Aplica o tema do perfil e guarda uma cópia para a próxima abertura não piscar. */
export function aplicarTema(perfil: Pick<Profile, 'tema' | 'corDestaque'>) {
  const salvo = { tema: perfil.tema, cor: perfil.corDestaque }
  aplicar(salvo)
  try {
    localStorage.setItem(CHAVE, JSON.stringify(salvo))
  } catch {
    // Sem armazenamento local: o tema só é aplicado depois que o banco carrega.
  }
}

/** Chamado antes de desenhar a tela, com a cópia guardada na última abertura. */
export function aplicarTemaInicial() {
  let salvo: TemaSalvo = { tema: 'auto', cor: CORES_DESTAQUE[0].hex }
  try {
    const texto = localStorage.getItem(CHAVE)
    if (texto) salvo = JSON.parse(texto)
  } catch {
    // Usa o padrão.
  }
  aplicar(salvo)
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    try {
      const texto = localStorage.getItem(CHAVE)
      if (texto) aplicar(JSON.parse(texto))
    } catch {
      aplicar(salvo)
    }
  })
}
