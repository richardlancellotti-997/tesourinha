import { useLiveQuery } from 'dexie-react-hooks'
import { cartoesAtivos } from '../../db/repo'
import type { Card } from '../../db/types'
import { formatValor } from '../../domain/money'
import { href, voltar } from '../../router'
import { Icon } from '../Icon'

/** Mais → Cartões de crédito: os dados de cada cartão e o cadastro de outro. */
export function Cartoes() {
  const cartoes = useLiveQuery(() => cartoesAtivos(), [], undefined as Card[] | undefined)
  if (!cartoes) return null

  const linha = (c: Card, rotulo: string, valor: string) => (
    <a class="linha" href={href(`/cartao/ajustes/${c.id}`)}>
      <span>{rotulo}</span>
      <span class="valor-lateral">
        {valor} <Icon nome="avancar" size={18} />
      </span>
    </a>
  )

  return (
    <main class="tela">
      <div class="topo topo-voltar">
        <button class="btn-icone" aria-label="Voltar para Mais" onClick={voltar}>
          <Icon nome="voltar" />
        </button>
        <h1>Cartões de crédito</h1>
        <span class="espaco-44" />
      </div>

      {cartoes.length === 0 && (
        <p class="em-breve">Cadastre um cartão para lançar compras no crédito e acompanhar as faturas.</p>
      )}

      {cartoes.map((c) => (
        <section key={c.id}>
          <h2 class="rotulo-grupo">{c.nome}</h2>
          <div class="grupo">
            {linha(c, 'Nome', c.nome)}
            {linha(c, 'Fecha no dia', String(c.diaFechamento))}
            {linha(c, 'Vence no dia', String(c.diaVencimento))}
            {linha(c, 'Limite', c.limite ? formatValor(c.limite) : 'Sem limite')}
          </div>
        </section>
      ))}

      <a class={cartoes.length ? 'btn-secundario' : 'btn-principal'} href={href('/cartao/ajustes/novo')}>
        {cartoes.length ? 'Adicionar outro cartão' : 'Cadastrar cartão'}
      </a>
    </main>
  )
}
