import { href } from '../../router'

const TEXTOS = {
  voucher: {
    titulo: 'Voucher',
    texto: 'Em breve aqui: o saldo do vale-alimentação e quanto dá para gastar por dia na empresa até o próximo crédito.',
  },
}

export function EmBreve({ qual }: { qual: keyof typeof TEXTOS }) {
  const { titulo, texto } = TEXTOS[qual]
  return (
    <main class="tela">
      <h1 class="titulo-grande">{titulo}</h1>
      <p class="em-breve">{texto}</p>
      <p class="apoio">
        Até lá, o lançamento aceita Débito/Pix e Crédito.{' '}
        <a href={href('/')} class="link-acao">
          Voltar ao início
        </a>
      </p>
    </main>
  )
}
