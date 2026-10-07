import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { db } from '../../db/db'
import { cartoesAtivos, desfazerPagamentos, projetarRecorrencias, registrarPagamento } from '../../db/repo'
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
import { abrirParcelaOuCompra } from '../abrirLancamento'
import { avisar } from '../aviso'
import { Icon } from '../Icon'

const ROTULO_SITUACAO: Record<SituacaoFatura, string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  vencida: 'Vencida',
  paga: 'Paga',
}

// A fatura e o cartão escolhidos continuam os mesmos ao voltar de outra tela.
let faturaLembrada: YearMonth | null = null
let cartaoLembrado: string | null = null

export function Cartao() {
  const hoje = today()
  const cartoes = useLiveQuery(() => cartoesAtivos(), [], null as Card[] | null)
  const [cartaoId, setCartaoId] = useState<string | null>(cartaoLembrado)
  const cartao = cartoes === null ? null : (cartoes.find((c) => c.id === cartaoId) ?? cartoes[0])
  const cardId = cartao?.id ?? ''
  useEffect(() => {
    cartaoLembrado = cartaoId
  }, [cartaoId])
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
  // Assinaturas no crédito que ainda vão cair (não gravadas)
  const projecoes = useLiveQuery(
    () => projetarRecorrencias(hoje, `${addMonths(hoje.slice(0, 7), 14)}-28`),
    [hoje],
    [] as Transaction[],
  )
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
        <a class="btn-principal" href={href('/cartao/ajustes/novo')}>
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

  const previstas = projecoes.filter((t) => t.formaPagamento === 'credito' && t.cardId === cartao.id)
  const previstoPorRef = new Map<YearMonth, number>()
  for (const t of previstas) previstoPorRef.set(t.faturaRef!, (previstoPorRef.get(t.faturaRef!) ?? 0) + t.valor)

  const totalReal = totais.get(ref) ?? 0
  const totalPrevisto = previstoPorRef.get(ref) ?? 0
  const total = totalReal + totalPrevisto
  const pago = pagos.get(ref) ?? 0
  const quitada = totalReal > 0 && pago >= totalReal
  const situacao = situacaoDaFatura(ref, cartao, hoje, totalReal, pago)
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const ordem = (a: Transaction, b: Transaction) =>
    a.data === b.data ? (a.createdAt < b.createdAt ? 1 : -1) : a.data < b.data ? 1 : -1
  const compras = [
    ...previstas.filter((t) => t.faturaRef === ref).map((t) => ({ ...t, prevista: true })),
    ...txs.filter((t) => t.faturaRef === ref).map((t) => ({ ...t, prevista: false })),
  ].sort(ordem)

  // Limite: tudo que ainda não foi pago, em qualquer fatura
  const emAberto = (r: YearMonth) => Math.max(0, (totais.get(r) ?? 0) - (pagos.get(r) ?? 0))
  const comprometido = [...totais.keys()].reduce((s, r) => s + emAberto(r), 0)
  const destaFatura = emAberto(ref)
  const demais = comprometido - destaFatura
  const livre = cartao.limite ? cartao.limite - comprometido : 0

  const proximas = [1, 2, 3]
    .map((i) => addMonths(ref, i))
    .map((r) => ({ ref: r, total: (totais.get(r) ?? 0) + (previstoPorRef.get(r) ?? 0) }))
  const maiorProxima = Math.max(...proximas.map((p) => p.total))
  const ultimoPagamento = pagamentos.filter((p) => p.faturaRef === ref).sort((a, b) => (a.dataPagamento < b.dataPagamento ? 1 : -1))[0]

  const titulo = `Fatura de ${nomeMes(ref)}${ref.slice(0, 4) !== hoje.slice(0, 4) ? ` de ${ref.slice(0, 4)}` : ''}`

  async function pagar() {
    const pergunta =
      situacao === 'aberta'
        ? `A fatura ainda não fechou. Registrar o pagamento de ${formatValor(totalReal - pago)} hoje?`
        : `Registrar o pagamento de ${formatValor(totalReal - pago)} hoje?`
    if (!confirm(pergunta)) return
    await registrarPagamento(cartao!.id, ref, totalReal - pago, hoje)
    avisar('Pagamento registrado')
  }

  async function desfazer() {
    if (!confirm('Desfazer o pagamento desta fatura?')) return
    await desfazerPagamentos(cartao!.id, ref)
    avisar('Pagamento desfeito')
  }

  const abrirCompra = (t: Transaction) =>
    abrirParcelaOuCompra(t, t.descricao || porId.get(t.categoriaId)?.nome || 'compra')

  return (
    <main class="tela">
      {cartoes!.length > 1 && (
        <div class="alternador alternador-cartoes" role="group" aria-label="Cartão">
          {cartoes!.map((c) => (
            <button key={c.id} aria-pressed={c.id === cartao.id} onClick={() => (setCartaoId(c.id), setRef(null))}>
              {c.nome}
            </button>
          ))}
        </div>
      )}
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
          <a class="cartao-ajustes" href={href(`/cartao/ajustes/${cartao.id}`)}>
            {cartao.nome}
          </a>
          <span class={`selo selo-${situacao}`}>{ROTULO_SITUACAO[situacao]}</span>
          {ref !== atual && (
            <button class="link-acao voltar-atual" onClick={() => setRef(atual)}>
              Ir para a fatura atual
            </button>
          )}
        </div>
        <div>
          <div class="valor-grande">{formatValor(total)}</div>
          {totalPrevisto > 0 && (
            <p class="apoio-forte texto-curto">Inclui {formatValor(totalPrevisto)} de assinaturas que ainda vão cair.</p>
          )}
        </div>
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
        totalReal > 0 &&
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
                <button
                  key={t.id}
                  class="lanc lanc-botao"
                  onClick={() => (t.prevista ? navegar(`/recorrencia/${t.recorrenciaId}`) : abrirCompra(t))}
                >
                  <span class="lanc-texto">
                    <span class="lanc-principal">
                      {t.descricao || cat?.nome || 'Sem categoria'}
                      {t.parcelaTotal && (
                        <span class="selo-parcela">
                          {t.parcelaNumero} de {t.parcelaTotal}
                        </span>
                      )}
                      {t.prevista && <span class="selo-parcela">prevista</span>}
                    </span>
                    <span class="apoio">
                      {t.prevista ? `Cai em ${diaMes(t.data)}` : diaMes(t.data)}
                      {t.descricao && cat ? `, ${cat.nome.toLowerCase()}` : ''}
                    </span>
                  </span>
                  <span class={`lanc-valor ${t.prevista ? 'adiado' : ''}`}>{formatValor(t.valor)}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
