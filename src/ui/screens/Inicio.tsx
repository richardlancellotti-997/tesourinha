import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { db } from '../../db/db'
import { PERFIL_ID } from '../../db/repo'
import type { Category, PaymentMethod, Transaction } from '../../db/types'
import { addMonths, diffDays, nomeMes, tituloMes, today, yearMonthOf } from '../../domain/dates'
import { formatComSinal, formatValor } from '../../domain/money'
import { agruparPorDia, principaisCategorias, resumoDoMes } from '../../domain/summary'
import { href } from '../../router'
import { Icon } from '../Icon'

const NOME_FORMA: Record<PaymentMethod, string> = { debito_pix: 'Débito/Pix', credito: 'Crédito', voucher: 'Voucher' }
const COR_FORMA: Record<PaymentMethod, string> = {
  debito_pix: 'var(--acc)',
  credito: 'color-mix(in oklab, var(--acc) 55%, var(--papel))',
  voucher: 'color-mix(in oklab, var(--acc) 25%, var(--papel))',
}
const ORDEM_FORMAS: PaymentMethod[] = ['debito_pix', 'credito', 'voucher']

// O mês escolhido continua o mesmo ao voltar de outra tela.
let mesLembrado: string | null = null

export function Inicio() {
  const hoje = today()
  const mesAtual = yearMonthOf(hoje)
  const [ym, setYm] = useState(mesLembrado ?? mesAtual)
  useEffect(() => {
    mesLembrado = ym
  }, [ym])

  const lancamentos = useLiveQuery(
    () => db.transactions.where('data').between(`${ym}-01`, `${ym}-31`, true, true).toArray(),
    [ym],
  )
  const categorias = useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
  const perfil = useLiveQuery(() => db.profile.get(PERFIL_ID), [])
  const totalLancamentos = useLiveQuery(() => db.transactions.count(), [], 0)

  if (!lancamentos) return null

  const porId = new Map(categorias.map((c) => [c.id, c]))
  const r = resumoDoMes(lancamentos, ym)
  const barras = principaisCategorias(r.porCategoria)
  const maior = barras.reduce((m, b) => Math.max(m, b.total), 0)
  const formas = ORDEM_FORMAS.filter((f) => r.saiuPorForma[f] > 0)
  const dias = agruparPorDia(lancamentos)

  // Lembrete discreto de backup
  const diasSemBackup = perfil?.ultimoBackupEm ? diffDays(perfil.ultimoBackupEm.slice(0, 10), hoje) : null
  const lembrarBackup = diasSemBackup === null ? totalLancamentos >= 10 : diasSemBackup > 30

  return (
    <main class="tela">
      <div class="topo">
        <button class="btn-icone mes-anterior" aria-label="Mês anterior" onClick={() => setYm(addMonths(ym, -1))}>
          <Icon nome="voltar" />
        </button>
        <h1>{tituloMes(ym)}</h1>
        <button
          class="btn-icone mes-proximo"
          aria-label="Próximo mês"
          disabled={ym >= mesAtual}
          onClick={() => setYm(addMonths(ym, 1))}
        >
          <Icon nome="avancar" />
        </button>
      </div>

      <section class="secao resumo" aria-label="Resumo do mês">
        <div>
          <div class="apoio-forte">{ym === mesAtual ? 'Sobrou até agora' : `Sobrou em ${nomeMes(ym)}`}</div>
          <div class={`valor-grande ${r.sobrou < 0 ? 'negativo' : ''}`}>
            {r.sobrou < 0 ? formatComSinal(r.sobrou, 'despesa') : formatValor(r.sobrou)}
          </div>
        </div>
        <div class="resumo-numeros">
          <div>
            <div class="apoio">Entrou</div>
            <div class="numero-medio entrada">{formatComSinal(r.entrou, 'receita')}</div>
          </div>
          <div>
            <div class="apoio">Saiu</div>
            <div class="numero-medio">{formatComSinal(r.saiu, 'despesa')}</div>
          </div>
        </div>
        {formas.length > 0 && (
          <div class="por-forma">
            <div class="barra-forma" aria-hidden="true">
              {formas.map((f) => (
                <span key={f} style={{ flex: r.saiuPorForma[f], background: COR_FORMA[f] }} />
              ))}
            </div>
            <div class="legenda">
              {formas.map((f) => (
                <span key={f}>
                  <span class="ponto" style={{ background: COR_FORMA[f] }} /> {NOME_FORMA[f]} {formatValor(r.saiuPorForma[f])}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {lembrarBackup && (
        <a class="lembrete" href={href('/mais')}>
          <span>
            <span class="lembrete-titulo">Hora de fazer um backup</span>
            <br />
            <span class="apoio">
              {diasSemBackup === null ? 'Você ainda não exportou nenhum.' : `O último foi há ${diasSemBackup} dias.`}
            </span>
          </span>
          <Icon nome="avancar" />
        </a>
      )}

      {barras.length > 0 && (
        <section class="secao">
          <h2>Para onde foi</h2>
          <ul class="barras-cat">
            {barras.map((b) => {
              const cat = b.categoriaId ? porId.get(b.categoriaId) : undefined
              return (
                <li key={b.categoriaId ?? 'demais'}>
                  <span class="barras-nome">
                    <span class="ponto" style={{ background: `var(--cat-${cat?.cor ?? 'cinza'})` }} />
                    {b.categoriaId ? (cat?.nome ?? 'Sem categoria') : 'Demais'}
                  </span>
                  <span class="barra" style={{ width: `${Math.max(3, Math.round((b.total / maior) * 100))}%` }} />
                  <span class="barras-valor">{formatValor(b.total)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section class="secao">
        <h2>Lançamentos</h2>
        {dias.length === 0 ? (
          <p class="vazio">
            Nenhum lançamento em {nomeMes(ym)}.{' '}
            {ym === mesAtual && (
              <a href={href('/lancar')} class="link-acao">
                Registrar o primeiro gasto
              </a>
            )}
          </p>
        ) : (
          <div class="livro">
            {dias.map((d) => (
              <div class="dia" key={d.data}>
                <div class={`dia-num ${d.data === hoje ? 'hoje' : ''}`}>{d.data.slice(8, 10)}</div>
                <div>
                  {d.itens.map((t) => (
                    <LinhaLancamento key={t.id} t={t} cat={porId.get(t.categoriaId)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function LinhaLancamento({ t, cat }: { t: Transaction; cat?: Category }) {
  const nomeCat = cat?.nome ?? 'Sem categoria'
  const detalhe =
    t.tipo === 'receita'
      ? t.descricao
        ? nomeCat
        : 'Receita'
      : [t.descricao ? nomeCat : null, NOME_FORMA[t.formaPagamento].toLowerCase()].filter(Boolean).join(', ')
  return (
    <a class="lanc" href={href(`/lancar/${t.id}`)}>
      <span class="lanc-texto">
        <span class="lanc-principal">{t.descricao || nomeCat}</span>
        <span class="apoio">{detalhe}</span>
      </span>
      <span class={`lanc-valor ${t.tipo === 'receita' ? 'entrada' : ''}`}>{formatComSinal(t.valor, t.tipo)}</span>
    </a>
  )
}
