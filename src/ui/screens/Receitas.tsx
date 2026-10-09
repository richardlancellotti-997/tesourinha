import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'preact/hooks'
import { db } from '../../db/db'
import { excluirReceitaPrevista, receberPrevista } from '../../db/repo'
import type { Category, IncomeExpected } from '../../db/types'
import { diaMes, diffDays, nomeMes, today, yearMonthOf } from '../../domain/dates'
import { formatComSinal, formatValor } from '../../domain/money'
import { href, navegar, voltar } from '../../router'
import { avisar } from '../aviso'
import { escolher } from '../folha'
import { Icon, PontoCategoria } from '../Icon'

export function Receitas() {
  const hoje = today()
  const ym = yearMonthOf(hoje)
  const [aba, setAba] = useState<'previstas' | 'recebidas'>('previstas')
  const previstas = useLiveQuery(
    () => db.incomeExpected.where('status').equals('prevista').sortBy('dataPrevista'),
    [],
    undefined as IncomeExpected[] | undefined,
  )
  const recebidas = useLiveQuery(
    () => db.transactions.where('mesBalanco').equals(ym).filter((t) => t.tipo === 'receita').toArray(),
    [ym],
    [],
  )
  const categorias = useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
  if (!previstas) return null

  const porId = new Map(categorias.map((c) => [c.id, c]))
  const totalPrevisto = previstas.reduce((s, p) => s + p.valor, 0)
  const totalRecebido = recebidas.reduce((s, t) => s + t.valor, 0)
  const recebidasOrdem = [...recebidas].sort((a, b) => (a.data < b.data ? 1 : -1))

  async function receber(p: IncomeExpected) {
    await receberPrevista(p.id, hoje)
    avisar(`Recebida: ${formatValor(p.valor)}`)
  }

  async function opcoes(p: IncomeExpected) {
    const nome = p.descricao || porId.get(p.categoriaId)?.nome || 'Receita'
    const r = await escolher(nome, [
      { valor: 'editar', rotulo: 'Editar' },
      { valor: 'excluir', rotulo: 'Excluir', perigo: true },
    ])
    if (r === 'editar') navegar(`/lancar?prevista=${p.id}`)
    if (r === 'excluir' && confirm(`Excluir "${nome}" das receitas a receber?`)) {
      await excluirReceitaPrevista(p.id)
      avisar('Receita a receber excluída')
    }
  }

  return (
    <main class="tela">
      <div class="topo topo-voltar">
        <button class="btn-icone" aria-label="Voltar" onClick={voltar}>
          <Icon nome="voltar" />
        </button>
        <h1>Receitas</h1>
        <span class="espaco-44" />
      </div>

      <div class="alternador" role="group" aria-label="Receitas">
        <button aria-pressed={aba === 'previstas'} onClick={() => setAba('previstas')}>
          A receber
        </button>
        <button aria-pressed={aba === 'recebidas'} onClick={() => setAba('recebidas')}>
          Recebidas
        </button>
      </div>

      {aba === 'previstas' ? (
        <>
          <section class="secao resumo">
            <div>
              <div class="apoio-forte">Previsto para entrar</div>
              <div class="valor-grande">{formatValor(totalPrevisto)}</div>
              <p class="apoio-forte texto-curto">Só entra no balanço quando você marcar como recebida.</p>
            </div>
            <a class="btn-principal" href={href('/lancar?tipo=receita&situacao=prevista')}>
              Nova receita a receber
            </a>
          </section>
          {previstas.length === 0 ? (
            <p class="vazio">Nada a receber. Registre dinheiro emprestado, serviços ou reembolsos que ainda vão entrar.</p>
          ) : (
            <div>
              {previstas.map((p) => {
                const dias = diffDays(hoje, p.dataPrevista)
                const situacao =
                  dias < 0 ? `Atrasada há ${-dias} ${dias === -1 ? 'dia' : 'dias'}` : dias === 0 ? 'Esperada hoje' : `Em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
                return (
                  <div class="item-receita" key={p.id}>
                    <button class="item-receita-topo" onClick={() => opcoes(p)}>
                      <span class="lanc-texto">
                        <span class="lanc-principal">
                          <PontoCategoria cor={porId.get(p.categoriaId)?.cor} />
                          {p.descricao || porId.get(p.categoriaId)?.nome || 'Receita'}
                        </span>
                        <span class="apoio">
                          {[p.devedor, `esperado em ${diaMes(p.dataPrevista)}`].filter(Boolean).join(', ')}
                        </span>
                      </span>
                      <span class="lanc-valor">{formatValor(p.valor)}</span>
                    </button>
                    <div class="item-receita-rodape">
                      <span class={`apoio ${dias < 0 ? 'negativo atrasada' : ''}`}>{situacao}</span>
                      <button class={dias <= 0 ? 'btn-receber forte' : 'btn-receber'} onClick={() => receber(p)}>
                        Marcar como recebida
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <section class="secao resumo">
            <div>
              <div class="apoio-forte">Entrou em {nomeMes(ym)}</div>
              <div class="valor-grande entrada">{formatValor(totalRecebido)}</div>
            </div>
          </section>
          {recebidasOrdem.length === 0 ? (
            <p class="vazio">Nenhuma receita em {nomeMes(ym)} ainda.</p>
          ) : (
            <div>
              {recebidasOrdem.map((t) => (
                <a key={t.id} class="lanc" href={href(`/lancar/${t.id}`)}>
                  <span class="lanc-texto">
                    <span class="lanc-principal">
                      <PontoCategoria cor={porId.get(t.categoriaId)?.cor} />
                      {t.descricao || porId.get(t.categoriaId)?.nome || 'Receita'}
                    </span>
                    <span class="apoio">
                      {diaMes(t.data)}
                      {t.recorrenciaId ? ', todo mês' : ''}
                    </span>
                  </span>
                  <span class="lanc-valor entrada">{formatComSinal(t.valor, 'receita')}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
