import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { db } from '../../db/db'
import { PERFIL_ID, projetarRecorrencias } from '../../db/repo'
import type { Category, PaymentMethod, Transaction } from '../../db/types'
import { addMonths, diaMes, diffDays, nomeMes, tituloMes, today, yearMonthOf } from '../../domain/dates'
import { formatComSinal, formatValor } from '../../domain/money'
import { agruparPorDia, juntarParcelas, principaisCategorias, resumoDoMes, type ItemCompra } from '../../domain/summary'
import { href } from '../../router'
import { abrirParcelaOuCompra } from '../abrirLancamento'
import { Icon, PontoCategoria } from '../Icon'

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

  // Compras feitas no mês (aparecem na lista, mesmo que contem em outro mês)
  const doMes = useLiveQuery(() => db.transactions.where('data').between(`${ym}-01`, `${ym}-31`, true, true).toArray(), [ym])
  // O que conta no balanço do mês (crédito pelo mês do vencimento da fatura)
  const noBalanco = useLiveQuery(() => db.transactions.where('mesBalanco').equals(ym).toArray(), [ym])
  const categorias = useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
  const perfil = useLiveQuery(() => db.profile.get(PERFIL_ID), [])
  const totalLancamentos = useLiveQuery(() => db.transactions.count(), [], 0)
  const todasAReceber = useLiveQuery(() => db.incomeExpected.where('status').equals('prevista').sortBy('dataPrevista'), [], [])
  // "A receber" do mês que está na tela: no mês atual, as do mês e as atrasadas; num mês
  // futuro, só as esperadas nele; em meses passados, nenhuma.
  const aReceber = todasAReceber.filter((p) =>
    ym === mesAtual ? p.dataPrevista <= `${ym}-31` : ym > mesAtual ? p.dataPrevista.startsWith(ym) : false,
  )
  // Recorrências que ainda vão cair (não gravadas): previstas do mês
  const projecoes = useLiveQuery(
    () => (ym >= mesAtual ? projetarRecorrencias(hoje, `${ym}-31`) : Promise.resolve([] as Transaction[])),
    [ym, hoje],
    [] as Transaction[],
  )

  if (!doMes || !noBalanco) return null

  const porId = new Map(categorias.map((c) => [c.id, c]))
  const nomeDe = (t: Transaction) => t.descricao || porId.get(t.categoriaId)?.nome || 'Sem categoria'
  const previstasDoMes = projecoes.filter((t) => t.mesBalanco === ym).sort((a, b) => (a.data < b.data ? -1 : 1))
  const futuro = ym > mesAtual
  // Mês futuro: o balanço já inclui as recorrências previstas. Mês atual: só o realizado.
  const r = resumoDoMes(futuro ? [...noBalanco, ...previstasDoMes] : noBalanco, ym)
  const aindaGastos = previstasDoMes
    .filter((t) => t.tipo === 'despesa' && t.formaPagamento !== 'voucher')
    .reduce((s, t) => s + t.valor, 0)
  const aindaReceitas = previstasDoMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
  const totalAReceber = aReceber.reduce((s, p) => s + p.valor, 0)
  const atrasadas = aReceber.filter((p) => p.dataPrevista < hoje).length
  const barras = principaisCategorias(r.porCategoria)
  const maior = barras.reduce((m, b) => Math.max(m, b.total), 0)
  const temParcelas = barras.some((b) => b.parcelado > 0)
  const temVoucher = barras.some((b) => b.voucher > 0)
  const formas = ORDEM_FORMAS.filter((f) => r.saiuPorForma[f] > 0)
  const dias = agruparPorDia(juntarParcelas(doMes, ym))
  const anteriores = noBalanco
    .filter((t) => !t.data.startsWith(ym))
    .sort((a, b) => (a.data === b.data ? (a.parcelaNumero ?? 0) - (b.parcelaNumero ?? 0) : a.data < b.data ? 1 : -1))

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
        <button class="btn-icone mes-proximo" aria-label="Próximo mês" onClick={() => setYm(addMonths(ym, 1))}>
          <Icon nome="avancar" />
        </button>
      </div>

      <section class="secao resumo" aria-label="Resumo do mês">
        <div>
          <div class="apoio-forte">
            {ym === mesAtual ? 'Sobrou até agora' : ym > mesAtual ? `Previsto para ${nomeMes(ym)}` : `Sobrou em ${nomeMes(ym)}`}
          </div>
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

      {ym === mesAtual && (aindaGastos > 0 || aindaReceitas > 0) && (
        <a class="lembrete" href={href('/assinaturas')}>
          <span>
            <span class="lembrete-titulo">Ainda este mês</span>
            <br />
            <span class="apoio">
              {[
                aindaGastos ? `${formatComSinal(aindaGastos, 'despesa')} em contas fixas` : '',
                aindaReceitas ? `${formatComSinal(aindaReceitas, 'receita')} de receitas fixas` : '',
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </span>
          <Icon nome="avancar" />
        </a>
      )}

      {aReceber.length > 0 && (
        <a class="lembrete" href={href('/receitas')}>
          <span>
            <span class="lembrete-titulo">
              {ym === mesAtual ? 'A receber' : `A receber em ${nomeMes(ym)}`}: {formatValor(totalAReceber)}
            </span>
            <br />
            <span class={`apoio ${atrasadas ? 'negativo' : ''}`}>
              {atrasadas
                ? `${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}`
                : `${aReceber.length} ${aReceber.length === 1 ? 'receita prevista' : 'receitas previstas'}, a próxima em ${diaMes(aReceber[0].dataPrevista)}`}
            </span>
          </span>
          <Icon nome="avancar" />
        </a>
      )}

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
              const nome = b.categoriaId ? (cat?.nome ?? 'Sem categoria') : 'Demais'
              const largura = Math.max(3, Math.round((b.total / maior) * 100))
              const avista = b.total - b.parcelado - b.voucher
              const detalhes = [
                b.parcelado ? `${formatValor(b.parcelado)} em parcelas` : '',
                b.voucher ? `${formatValor(b.voucher)} no voucher` : '',
              ].filter(Boolean)
              return (
                <li
                  key={b.categoriaId ?? 'demais'}
                  aria-label={`${nome}: ${formatValor(b.total)}${detalhes.length ? `, dos quais ${detalhes.join(' e ')}` : ''}`}
                >
                  <span class="barras-nome">
                    <span class="ponto" style={{ background: `var(--cat-${cat?.cor ?? 'cinza'})` }} />
                    {nome}
                  </span>
                  <span class="barra-trilho" style={{ width: `${largura}%` }} aria-hidden="true">
                    {avista > 0 && <span class="barra" style={{ flex: avista }} />}
                    {b.parcelado > 0 && <span class="barra barra-parcelas" style={{ flex: b.parcelado }} />}
                    {b.voucher > 0 && <span class="barra barra-voucher" style={{ flex: b.voucher }} />}
                  </span>
                  <span class="barras-valor">{formatValor(b.total)}</span>
                </li>
              )
            })}
          </ul>
          {(temParcelas || temVoucher) && (
            <p class="legenda legenda-coluna">
              {temParcelas && (
                <span>
                  <span class="ponto ponto-parcelas" /> Parcelas de compras parceladas no crédito
                </span>
              )}
              {temVoucher && (
                <span>
                  <span class="ponto ponto-voucher" /> Pago com voucher (fica fora do saldo do mês)
                </span>
              )}
            </p>
          )}
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

      {futuro && previstasDoMes.length > 0 && (
        <section class="secao">
          <h2>Previstos</h2>
          <div>
            {previstasDoMes.map((t) => (
              <a key={t.id} class="lanc" href={href(`/recorrencia/${t.recorrenciaId}`)}>
                <span class="lanc-texto">
                  <span class="lanc-principal">
                    <PontoCategoria cor={porId.get(t.categoriaId)?.cor} />
                    {nomeDe(t)}
                    <span class="selo-parcela">todo mês</span>
                  </span>
                  <span class="apoio">
                    {diaMes(t.data)}, {t.tipo === 'receita' ? 'receita' : NOME_FORMA[t.formaPagamento].toLowerCase()}
                  </span>
                </span>
                <span class={`lanc-valor ${t.tipo === 'receita' ? 'entrada' : ''}`}>{formatComSinal(t.valor, t.tipo)}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {anteriores.length > 0 && (
        <section class="secao">
          <h2>Parcelas de compras anteriores</h2>
          <div>
            {anteriores.map((t) => (
              <button key={t.id} class="lanc lanc-botao" onClick={() => abrirParcelaOuCompra(t, nomeDe(t))}>
                <span class="lanc-texto">
                  <span class="lanc-principal">
                    <PontoCategoria cor={porId.get(t.categoriaId)?.cor} />
                    {nomeDe(t)}
                    {t.parcelaTotal && (
                      <span class="selo-parcela">
                        {t.parcelaNumero} de {t.parcelaTotal}
                      </span>
                    )}
                  </span>
                  <span class="apoio">
                    Compra de {diaMes(t.data)}
                    {t.parcelaTotal ? '' : ', crédito'}
                  </span>
                </span>
                <span class="lanc-valor">{formatComSinal(t.valor, 'despesa')}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function LinhaLancamento({ t, cat }: { t: Transaction & ItemCompra; cat?: Category }) {
  const nomeCat = cat?.nome ?? 'Sem categoria'
  const comCat = (s: string) => (t.descricao ? `${nomeCat}, ${s}` : s)
  const ehCredito = t.tipo === 'despesa' && t.formaPagamento === 'credito'

  let detalhe: string
  let valor = t.valorTotal
  let adiado = false
  if (t.tipo === 'receita') {
    detalhe = t.descricao ? nomeCat : 'Receita'
  } else if (ehCredito && t.parcelaTotal) {
    if (t.valorNoMes > 0) {
      valor = t.valorNoMes
      detalhe = comCat(`1ª de ${t.parcelaTotal} parcelas, total ${formatValor(t.valorTotal)}`)
    } else {
      adiado = true
      detalhe = comCat(`${t.parcelaTotal}x, a partir de ${nomeMes(t.mesInicial)}`)
    }
  } else if (ehCredito && t.valorNoMes === 0) {
    adiado = true
    detalhe = comCat(`crédito, conta em ${nomeMes(t.mesInicial)}`)
  } else {
    detalhe = comCat(NOME_FORMA[t.formaPagamento].toLowerCase())
  }

  return (
    <a class="lanc" href={href(`/lancar/${t.id}`)}>
      <span class="lanc-texto">
        <span class="lanc-principal">
          <PontoCategoria cor={cat?.cor} />
          {t.descricao || nomeCat}
          {t.parcelaTotal && <span class="selo-parcela">{t.parcelaTotal}x</span>}
        </span>
        <span class="apoio">{detalhe}</span>
      </span>
      <span class={`lanc-valor ${t.tipo === 'receita' ? 'entrada' : ''} ${adiado ? 'adiado' : ''}`}>
        {formatComSinal(valor, t.tipo)}
      </span>
    </a>
  )
}
