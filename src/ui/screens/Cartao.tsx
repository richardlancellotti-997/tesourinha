import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { db } from '../../db/db'
import { cartaoPrincipal, desfazerPagamentos, registrarPagamento } from '../../db/repo'
import type { Card, Category, InvoicePayment, Transaction } from '../../db/types'
import { addMonths, diaMes, diaMesSemana, nomeMes, today, type YearMonth } from '../../domain/dates'
import {
  faturaAberta,
  fechamentoDe,
  situacaoDaFatura,
  vencimentoDe,
  type SituacaoFatura,
} from '../../domain/invoice'
import { formatValor } from '../../domain/money'
import { href, navegar } from '../../router'
import { avisar } from '../aviso'
import { escolher } from '../folha'
import { Icon } from '../Icon'

const ROTULO_SITUACAO: Record<SituacaoFatura, string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  vencida: 'Vencida',
  paga: 'Paga',
}

// A fatura escolhida continua a mesma ao voltar de outra tela.
let faturaLembrada: YearMonth | null = null

export function Cartao() {
  const hoje = today()
  const cartao = useLiveQuery(() => cartaoPrincipal(), [], null as Card | null | undefined)
  const cardId = cartao?.id ?? ''
  const txs = useLiveQuery(
    () => db.transactions.where('[cardId+faturaRef]').between([cardId, Dexie.minKey], [cardId, Dexie.maxKey]).toArray(),
    [cardId],
    [] as Transaction[],
  )
  const pagamentos = useLiveQuery(
    () => db.invoicePayments.where('[cardId+faturaRef]').between([cardId, Dexie.minKey], [cardId, Dexie.maxKey]).toArray(),
    [cardId],
    [] as InvoicePayment[],
  )
  const categorias = useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
  const [refEscolhida, setRef] = useState<YearMonth | null>(faturaLembrada)
  useEffect(() => {
    faturaLembrada = refEscolhida
  }, [refEscolhida])

  if (cartao === null) return null
  if (!cartao) {
    return (
      <main class="tela">
        <h1 class="titulo-grande">Cartão de crédito</h1>
        <p class="em-breve">Cadastre o cartão para acompanhar a fatura, as parcelas e o vencimento.</p>
        <a class="btn-principal" href={href('/cartao/ajustes')}>
          Cadastrar cartão
        </a>
      </main>
    )
  }

  const atual = faturaAberta(hoje, cartao)
  const ref = refEscolhida ?? atual
  const totais = new Map<YearMonth, number>()
  for (const t of txs) totais.set(t.faturaRef!, (totais.get(t.faturaRef!) ?? 0) + t.valor)
  const pagos = new Map<YearMonth, number>()
  for (const p of pagamentos) pagos.set(p.faturaRef, (pagos.get(p.faturaRef) ?? 0) + p.valorPago)

  const total = totais.get(ref) ?? 0
  const pago = pagos.get(ref) ?? 0
  const quitada = total > 0 && pago >= total
  const situacao = situacaoDaFatura(ref, cartao, hoje, total, pago)
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const compras = txs
    .filter((t) => t.faturaRef === ref)
    .sort((a, b) => (a.data === b.data ? (a.createdAt < b.createdAt ? 1 : -1) : a.data < b.data ? 1 : -1))

  // Limite: tudo que ainda não foi pago, em qualquer fatura
  const emAberto = (r: YearMonth) => Math.max(0, (totais.get(r) ?? 0) - (pagos.get(r) ?? 0))
  const comprometido = [...totais.keys()].reduce((s, r) => s + emAberto(r), 0)
  const destaFatura = emAberto(ref)
  const demais = comprometido - destaFatura
  const livre = cartao.limite ? cartao.limite - comprometido : 0

  const proximas = [1, 2, 3].map((i) => addMonths(ref, i)).map((r) => ({ ref: r, total: totais.get(r) ?? 0 }))
  const maiorProxima = Math.max(...proximas.map((p) => p.total))
  const ultimoPagamento = pagamentos.filter((p) => p.faturaRef === ref).sort((a, b) => (a.dataPagamento < b.dataPagamento ? 1 : -1))[0]

  const titulo = `Fatura de ${nomeMes(ref)}${ref.slice(0, 4) !== hoje.slice(0, 4) ? ` de ${ref.slice(0, 4)}` : ''}`

  async function pagar() {
    const pergunta =
      situacao === 'aberta'
        ? `A fatura ainda não fechou. Registrar o pagamento de ${formatValor(total - pago)} hoje?`
        : `Registrar o pagamento de ${formatValor(total - pago)} hoje?`
    if (!confirm(pergunta)) return
    await registrarPagamento(cartao!.id, ref, total - pago, hoje)
    avisar('Pagamento registrado')
  }

  async function desfazer() {
    if (!confirm('Desfazer o pagamento desta fatura?')) return
    await desfazerPagamentos(cartao!.id, ref)
    avisar('Pagamento desfeito')
  }

  async function abrirCompra(t: Transaction) {
    if (!t.parcelaGrupoId) return navegar(`/lancar/${t.id}`)
    const nome = t.descricao || porId.get(t.categoriaId)?.nome || 'compra'
    const escolha = await escolher(`Parcela ${t.parcelaNumero} de ${t.parcelaTotal}: ${nome}`, [
      { valor: 'parcela', rotulo: 'Editar só esta parcela' },
      { valor: 'compra', rotulo: 'Editar a compra toda' },
    ])
    if (escolha === 'parcela') navegar(`/lancar/${t.id}?parcela=1`)
    else if (escolha === 'compra') navegar(`/lancar/${t.id}`)
  }

  return (
    <main class="tela">
      <div class="topo">
        <button class="btn-icone mes-anterior" aria-label="Fatura anterior" onClick={() => setRef(addMonths(ref, -1))}>
          <Icon nome="voltar" />
        </button>
        <h1>{titulo}</h1>
        <button class="btn-icone mes-proximo" aria-label="Próxima fatura" onClick={() => setRef(addMonths(ref, 1))}>
          <Icon nome="avancar" />
        </button>
      </div>

      <section class="secao resumo" aria-label="Resumo da fatura">
        <div class="cartao-nome">
          <a class="cartao-ajustes" href={href('/cartao/ajustes')}>
            {cartao.nome}
          </a>
          <span class={`selo selo-${situacao}`}>{ROTULO_SITUACAO[situacao]}</span>
          {ref !== atual && (
            <button class="link-acao voltar-atual" onClick={() => setRef(atual)}>
              Ir para a fatura atual
            </button>
          )}
        </div>
        <div class="valor-grande">{formatValor(total)}</div>
        <div class="resumo-numeros">
          <div>
            <div class="apoio">Fecha em</div>
            <div class="numero-medio">{diaMesSemana(fechamentoDe(ref, cartao))}</div>
          </div>
          <div>
            <div class="apoio">Vence em</div>
            <div class="numero-medio">{diaMesSemana(vencimentoDe(ref, cartao))}</div>
          </div>
        </div>

        {cartao.limite ? (
          <div class="por-forma">
            <div class="barra-forma" aria-hidden="true">
              {destaFatura > 0 && <span style={{ flex: destaFatura, background: 'var(--acc)' }} />}
              {demais > 0 && <span style={{ flex: demais, background: 'color-mix(in oklab, var(--acc) 40%, var(--papel))' }} />}
              {livre > 0 && <span style={{ flex: livre, background: 'var(--tecla)' }} />}
            </div>
            <div class="legenda legenda-espalhada">
              <span>Esta fatura {formatValor(destaFatura)}</span>
              <span>Outras {formatValor(demais)}</span>
              {livre >= 0 ? (
                <span>Livre {formatValor(livre)}</span>
              ) : (
                <span class="negativo">Acima do limite {formatValor(-livre)}</span>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {quitada ? (
        <div class="pagamento-feito">
          <span>
            <span class="entrada pagamento-titulo">Fatura paga</span>
            <br />
            <span class="apoio">
              {formatValor(pago)} em {ultimoPagamento ? diaMes(ultimoPagamento.dataPagamento) : ''}
            </span>
          </span>
          <button class="btn-texto" onClick={desfazer}>
            Desfazer
          </button>
        </div>
      ) : (
        total > 0 &&
        ref <= atual && (
          <button class="btn-secundario" onClick={pagar}>
            Registrar pagamento
          </button>
        )
      )}

      {maiorProxima > 0 && (
        <section class="secao">
          <h2>Próximas faturas</h2>
          <div class="proximas">
            {proximas.map((p) => (
              <button key={p.ref} class="proxima" onClick={() => setRef(p.ref)} aria-label={`Fatura de ${nomeMes(p.ref)}: ${formatValor(p.total)}`}>
                <span class="proxima-valor">{formatValor(p.total)}</span>
                <span class="proxima-barra" style={{ height: `${Math.max(4, Math.round((p.total / maiorProxima) * 56))}px` }} />
                <span class="apoio">{nomeMes(p.ref)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="secao">
        <h2>Compras nesta fatura</h2>
        {compras.length === 0 ? (
          <p class="vazio">Nenhuma compra nesta fatura.</p>
        ) : (
          <div>
            {compras.map((t) => {
              const cat = porId.get(t.categoriaId)
              return (
                <button key={t.id} class="lanc lanc-botao" onClick={() => abrirCompra(t)}>
                  <span class="lanc-texto">
                    <span class="lanc-principal">
                      {t.descricao || cat?.nome || 'Sem categoria'}
                      {t.parcelaTotal && (
                        <span class="selo-parcela">
                          {t.parcelaNumero} de {t.parcelaTotal}
                        </span>
                      )}
                    </span>
                    <span class="apoio">
                      {diaMes(t.data)}
                      {t.descricao && cat ? `, ${cat.nome.toLowerCase()}` : ''}
                    </span>
                  </span>
                  <span class="lanc-valor">{formatValor(t.valor)}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
