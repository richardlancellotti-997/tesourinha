import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'preact/hooks'
import { db } from '../../db/db'
import { garantirRecorrencias } from '../../db/repo'
import type { Category, PaymentMethod, Recurrence } from '../../db/types'
import { diaMes, today } from '../../domain/dates'
import { formatValor } from '../../domain/money'
import { proximaData, valorNaData } from '../../domain/recurrence'
import { href, voltar } from '../../router'
import { Icon } from '../Icon'

const NOME_FORMA: Record<PaymentMethod, string> = { debito_pix: 'Débito/Pix', credito: 'Crédito', voucher: 'Voucher' }
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function Assinaturas() {
  const hoje = today()
  useEffect(() => {
    garantirRecorrencias(hoje)
  }, [hoje])
  const recs = useLiveQuery(() => db.recurrences.toArray(), [], undefined as Recurrence[] | undefined)
  const categorias = useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
  if (!recs) return null

  const porId = new Map(categorias.map((c) => [c.id, c]))
  const comProxima = recs.map((r) => {
    const proxima = r.ativa ? proximaData(r, r.geradoAte > hoje ? r.geradoAte : hoje) : null
    return { r, proxima, valor: valorNaData(r, proxima ?? hoje) }
  })
  const ordenar = (a: { proxima: string | null }, b: { proxima: string | null }) => ((a.proxima ?? '9') < (b.proxima ?? '9') ? -1 : 1)
  const gastos = comProxima.filter((x) => x.r.ativa && x.r.tipo === 'despesa').sort(ordenar)
  const receitas = comProxima.filter((x) => x.r.ativa && x.r.tipo === 'receita').sort(ordenar)
  const pausadas = comProxima.filter((x) => !x.r.ativa && !x.r.fim)
  const encerradas = comProxima.filter((x) => !x.r.ativa && x.r.fim)
  const totalMes = gastos.reduce((s, x) => s + x.valor, 0)
  const noCredito = gastos.filter((x) => x.r.formaPagamento === 'credito').length

  const linha = ({ r, proxima, valor }: (typeof comProxima)[number]) => {
    const cat = porId.get(r.categoriaId)
    const detalhe = r.tipo === 'receita' ? (cat?.nome ?? 'Receita') : `${NOME_FORMA[r.formaPagamento]}, ${(cat?.nome ?? '').toLowerCase()}`
    return (
      <a key={r.id} class={`lanc lanc-rec ${r.ativa ? '' : 'inativa'}`} href={href(`/recorrencia/${r.id}`)}>
        <span class="quando" aria-hidden={!proxima}>
          {proxima ? (
            <>
              <b>{proxima.slice(8, 10)}</b>
              {MESES[Number(proxima.slice(5, 7)) - 1]}
            </>
          ) : (
            '—'
          )}
        </span>
        <span class="lanc-texto">
          <span class="lanc-principal">{r.nome}</span>
          <span class="apoio">
            {proxima ? `${detalhe}` : r.fim ? `Encerrada em ${diaMes(r.fim)}` : `Pausada, ${detalhe}`}
          </span>
        </span>
        <span class={`lanc-valor ${r.tipo === 'receita' ? 'entrada' : ''}`}>{formatValor(valor)}</span>
      </a>
    )
  }

  return (
    <main class="tela">
      <div class="topo topo-voltar">
        <button class="btn-icone" aria-label="Voltar" onClick={voltar}>
          <Icon nome="voltar" />
        </button>
        <h1>Assinaturas e contas fixas</h1>
        <span class="espaco-44" />
      </div>

      <section class="secao resumo">
        <div>
          <div class="apoio-forte">Todo mês</div>
          <div class="valor-grande">{formatValor(totalMes)}</div>
          <div class="apoio-forte">
            {gastos.length === 0
              ? 'Nenhuma assinatura ou conta fixa ativa.'
              : `${gastos.length} ${gastos.length === 1 ? 'ativa' : 'ativas'}${noCredito ? `, ${noCredito} no crédito` : ''}${pausadas.length ? ` e ${pausadas.length} ${pausadas.length === 1 ? 'pausada' : 'pausadas'}` : ''}`}
          </div>
        </div>
        <a class="btn-principal" href={href('/recorrencia/nova')}>
          Nova assinatura ou conta fixa
        </a>
      </section>

      {gastos.length > 0 && (
        <section class="secao">
          <h2>Próximas cobranças</h2>
          <div>{gastos.map(linha)}</div>
        </section>
      )}

      <section class="secao">
        <h2>Receitas fixas</h2>
        {receitas.length > 0 ? (
          <div>{receitas.map(linha)}</div>
        ) : (
          <p class="vazio">
            Cadastre o salário para ele entrar sozinho todo mês.{' '}
            <a class="link-acao" href={href('/recorrencia/nova?tipo=receita')}>
              Nova receita fixa
            </a>
          </p>
        )}
        {receitas.length > 0 && (
          <a class="link-acao" href={href('/recorrencia/nova?tipo=receita')}>
            Nova receita fixa
          </a>
        )}
      </section>

      {pausadas.length > 0 && (
        <section class="secao">
          <h2 class="rotulo-secundario">Pausadas</h2>
          <div>{pausadas.map(linha)}</div>
        </section>
      )}

      {encerradas.length > 0 && (
        <section class="secao">
          <h2 class="rotulo-secundario">Encerradas</h2>
          <div>{encerradas.map(linha)}</div>
        </section>
      )}
    </main>
  )
}
