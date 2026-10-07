import type { Transaction } from '../db/types'
import { navegar } from '../router'
import { escolher } from './folha'

/** Abre a edição. Numa parcela, pergunta se edita só ela ou a compra toda. */
export async function abrirParcelaOuCompra(t: Transaction, nome: string) {
  if (!t.parcelaGrupoId) return navegar(`/lancar/${t.id}`)
  const escolha = await escolher(`Parcela ${t.parcelaNumero} de ${t.parcelaTotal}: ${nome}`, [
    { valor: 'parcela', rotulo: 'Editar só esta parcela' },
    { valor: 'compra', rotulo: 'Editar a compra toda' },
  ])
  if (escolha === 'parcela') navegar(`/lancar/${t.id}?parcela=1`)
  else if (escolha === 'compra') navegar(`/lancar/${t.id}`)
}
