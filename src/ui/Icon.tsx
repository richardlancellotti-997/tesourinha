// Ícones de traço (24×24), desenhados para o app. Cor = currentColor.

const CAMINHOS: Record<string, string> = {
  // navegação e ações
  inicio: 'M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z',
  cartao: 'M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18',
  voucher: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z',
  mais: 'M6 12h.01M12 12h.01M18 12h.01',
  somar: 'M12 5v14M5 12h14',
  voltar: 'M15 6l-6 6 6 6',
  avancar: 'M9 6l6 6-6 6',
  apagar: 'M9 6h11v12H9l-6-6zM12.5 9.5l5 5M17.5 9.5l-5 5',
  // categorias
  carrinho: 'M3 4h2l2.2 10.5h10.6L20 8H6.2M9 19.5h.01M17 19.5h.01',
  talheres: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7h3',
  onibus: 'M7 3h10a2 2 0 0 1 2 2v12H5V5a2 2 0 0 1 2-2zM5 11h14M8 17v3M16 17v3',
  casa: 'M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z',
  repetir: 'M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2M18 4v5h-5M6 20v-5h5',
  coracao: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  sorriso: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9 14.5c1.6 1.6 4.4 1.6 6 0M9.5 10h.01M14.5 10h.01',
  sacola: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  pontos: 'M6 12h.01M12 12h.01M18 12h.01',
  dinheiro: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  ferramenta: 'M14 6l4 4-8 8H6v-4z',
  devolver: 'M9 7l-5 5 5 5M4 12h11a5 5 0 0 1 0 10',
  presente: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1',
  livro: 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9',
  pata: 'M12 13c-3 0-5 3-5 5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2c0-2-2-5-5-5zM6 9.5h.01M9.5 6h.01M14.5 6h.01M18 9.5h.01',
  aviao: 'M3 13l7-2 4-7 2 1-2 6 6 1 1 2-7 1-3 5-2-1 1-4-6-1z',
  combustivel: 'M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M5 10h9M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3',
  cafe: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M11 3v2',
}

export function Icon({ nome, class: classe, size }: { nome: string; class?: string; size?: number }) {
  const estilo = size ? { width: `${size}px`, height: `${size}px` } : undefined
  return (
    <svg class={`icone ${classe ?? ''}`} viewBox="0 0 24 24" aria-hidden="true" style={estilo}>
      <path d={CAMINHOS[nome] ?? CAMINHOS.pontos} />
    </svg>
  )
}

/** Quadrado colorido com o ícone da categoria. */
export function IconeCategoria({ icone, cor }: { icone?: string; cor?: string }) {
  return (
    <span class="icone-cat" style={{ background: `var(--cat-${cor ?? 'cinza'})` }}>
      <Icon nome={icone ?? 'pontos'} />
    </span>
  )
}
