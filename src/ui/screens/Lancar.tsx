import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { db } from '../../db/db'
import {
  cartaoPrincipal,
  excluirLancamentos,
  lancamentosDaCompra,
  PERFIL_ID,
  salvarCompra,
  salvarParcela,
} from '../../db/repo'
import type { Card, Category, Kind, PaymentMethod, Transaction } from '../../db/types'
import { addMonths, diaMes, nomeMes, rotuloData, today, type YearMonth } from '../../domain/dates'
import { faturaDaCompra, faturaPelaData, parcelar, vencimentoDe, type EscolhaFatura } from '../../domain/invoice'
import { centavosParaDigitos, digitosParaCentavos, pressionar, type Tecla } from '../../domain/keypad'
import { formatValor } from '../../domain/money'
import { href, voltar } from '../../router'
import { avisar } from '../aviso'
import { Icon, IconeCategoria } from '../Icon'

// Voucher é liberado na Etapa 3.
const FORMAS: { id: PaymentMethod; nome: string; liberada: boolean }[] = [
  { id: 'debito_pix', nome: 'Débito/Pix', liberada: true },
  { id: 'credito', nome: 'Crédito', liberada: true },
  { id: 'voucher', nome: 'Voucher', liberada: false },
]
const liberada = (f?: PaymentMethod) => FORMAS.some((x) => x.id === f && x.liberada)

const TECLAS: Tecla[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'apagar']
const MAX_PARCELAS = 24

function tamanhoDoValor(texto: string): number {
  if (texto.length <= 5) return 76
  if (texto.length <= 7) return 62
  if (texto.length <= 9) return 50
  return 40
}

/**
 * Modos:
 * - novo: /lancar
 * - compra: /lancar/<id> edita o lançamento; se for parcelado, a compra toda
 * - parcela: /lancar/<id>?parcela=1 edita só aquela parcela
 */
export function Lancar({ id, tipoInicial, soParcela }: { id?: string; tipoInicial?: Kind; soParcela?: boolean }) {
  const hoje = today()
  const perfil = useLiveQuery(() => db.profile.get(PERFIL_ID), [])
  const categorias = useLiveQuery(() => db.categories.orderBy('ordem').toArray(), [], [] as Category[])
  const cartao = useLiveQuery(() => cartaoPrincipal(), [], null as Card | null | undefined)

  const [tipo, setTipo] = useState<Kind>(tipoInicial ?? 'despesa')
  const [digitos, setDigitos] = useState('')
  const [data, setData] = useState(hoje)
  const [descricao, setDescricao] = useState('')
  const [forma, setForma] = useState<PaymentMethod | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  const [parcelas, setParcelas] = useState(1)
  const [escolhaFatura, setEscolhaFatura] = useState<EscolhaFatura | null>(null)
  // undefined = carregando; [] = não encontrado
  const [originais, setOriginais] = useState<Transaction[] | undefined>(id ? undefined : [])
  const [salvando, setSalvando] = useState(false)

  const modo: 'novo' | 'compra' | 'parcela' = !id ? 'novo' : soParcela ? 'parcela' : 'compra'

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const tx = await db.transactions.get(id)
      if (!tx) return setOriginais([])
      const lista = soParcela ? [tx] : await lancamentosDaCompra(tx)
      setOriginais(lista)
      setTipo(tx.tipo)
      setDigitos(centavosParaDigitos(lista.reduce((s, t) => s + t.valor, 0)))
      setData(tx.data)
      setDescricao(tx.descricao ?? '')
      setForma(tx.formaPagamento)
      setCatId(tx.categoriaId)
      setParcelas(soParcela ? 1 : (tx.parcelaTotal ?? 1))
      const card = await cartaoPrincipal()
      if (tx.formaPagamento === 'credito' && card && lista[0].faturaRef) {
        const padrao = faturaPelaData(tx.data, card)
        if (padrao.diaDeFechamento) setEscolhaFatura(lista[0].faturaRef === padrao.ref ? 'esta' : 'proxima')
      }
    })()
  }, [id, soParcela])

  // Sem escolha explícita, vale a última forma usada (se já estiver liberada).
  const formaEfetiva: PaymentMethod = forma ?? (liberada(perfil?.ultimaForma) ? perfil!.ultimaForma! : 'debito_pix')
  const ehCredito = tipo === 'despesa' && formaEfetiva === 'credito'

  const valor = digitosParaCentavos(digitos)
  const texto = formatValor(valor)
  const opcoes = categorias.filter((c) => c.tipo === tipo && (!c.arquivada || c.id === catId))
  const catValida = catId !== null && opcoes.some((c) => c.id === catId)

  // ---- Fatura (só no crédito) ----
  const original = originais?.[0]
  // Na edição, se a data e a forma não mudaram, a compra continua na fatura em que estava
  // (mesmo que o dia de fechamento do cartão tenha mudado depois).
  const manterFatura =
    modo === 'compra' && original?.formaPagamento === 'credito' && original.data === data && !!original.faturaRef
  const padrao = ehCredito && cartao ? faturaPelaData(data, cartao) : null
  let faturaInicial: YearMonth | null = null
  if (padrao && cartao) {
    if (padrao.diaDeFechamento) faturaInicial = escolhaFatura ? faturaDaCompra(data, cartao, escolhaFatura) : null
    else faturaInicial = manterFatura ? original!.faturaRef! : padrao.ref
  }

  let pendencia: string | null = null
  if (valor === 0) pendencia = 'Digite o valor'
  else if (!catValida) pendencia = 'Escolha a categoria'
  else if (ehCredito && modo !== 'parcela' && !cartao) pendencia = 'Cadastre o cartão para usar o crédito'
  else if (ehCredito && modo !== 'parcela' && !faturaInicial) pendencia = 'Escolha a fatura para salvar'

  let rotuloSalvar = pendencia
  if (!rotuloSalvar) {
    if (modo === 'parcela') rotuloSalvar = 'Salvar parcela'
    else if (modo === 'compra') rotuloSalvar = 'Salvar alterações'
    else rotuloSalvar = tipo === 'despesa' ? 'Salvar gasto' : 'Salvar receita'
  }

  function trocarTipo(novo: Kind) {
    setTipo(novo)
    setCatId(null)
  }

  function trocarData(nova: string) {
    setData(nova)
    setEscolhaFatura(null)
  }

  async function salvar() {
    if (pendencia || salvando) return
    setSalvando(true)
    try {
      if (modo === 'parcela') {
        await salvarParcela(id!, { valor, categoriaId: catId!, descricao })
        avisar('Parcela salva')
      } else {
        await salvarCompra(
          {
            tipo,
            valor,
            data,
            categoriaId: catId!,
            descricao,
            formaPagamento: tipo === 'despesa' ? formaEfetiva : 'debito_pix',
            cardId: ehCredito ? cartao!.id : undefined,
            faturaInicial: ehCredito ? faturaInicial! : undefined,
            parcelas: ehCredito ? parcelas : 1,
          },
          (originais ?? []).map((t) => t.id),
        )
        avisar(modo === 'compra' ? 'Alterações salvas' : tipo === 'despesa' ? 'Gasto salvo' : 'Receita salva')
      }
      voltar()
    } catch {
      setSalvando(false)
      avisar('O lançamento não foi salvo. Tente de novo.')
    }
  }

  async function excluir() {
    if (!originais?.length) return
    const n = originais.length
    const pergunta =
      modo === 'parcela'
        ? 'Excluir só esta parcela? As outras continuam.'
        : n > 1
          ? `Excluir a compra inteira (${n} parcelas)? Não dá para desfazer.`
          : 'Excluir este lançamento? Não dá para desfazer.'
    if (!confirm(pergunta)) return
    await excluirLancamentos(originais.map((t) => t.id))
    avisar(modo === 'parcela' ? 'Parcela excluída' : n > 1 ? 'Compra excluída' : 'Lançamento excluído')
    voltar()
  }

  // Teclado físico (útil no computador): números, Backspace e Enter.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement
      if (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT') return
      if (/^\d$/.test(e.key)) setDigitos((d) => pressionar(d, e.key as Tecla))
      else if (e.key === 'Backspace') setDigitos((d) => pressionar(d, 'apagar'))
      else if (e.key === 'Enter') salvar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  if (id && originais?.length === 0) {
    return (
      <main class="tela">
        <p>Este lançamento não existe mais. Ele pode ter sido excluído.</p>
        <button class="btn-principal" onClick={voltar}>
          Voltar
        </button>
      </main>
    )
  }
  if (id && originais === undefined) return null

  // Texto das parcelas: "3x de 200,00" ou "1x de 333,34 e 2x de 333,33"
  const divisao = parcelas > 1 && valor >= parcelas ? parcelar(valor, parcelas, '2000-01') : null
  let textoParcelas = 'À vista'
  if (divisao) {
    const [p1, p2] = [divisao[0].valor, divisao[1].valor]
    textoParcelas =
      p1 === p2 ? `${parcelas}x de ${formatValor(p1)}` : `1x de ${formatValor(p1)} e ${parcelas - 1}x de ${formatValor(p2)}`
  }

  return (
    <main class="lancar">
      <div class="lancar-topo">
        <button class="lancar-cancelar" onClick={voltar}>
          Cancelar
        </button>
        {modo === 'parcela' ? (
          <h1 class="lancar-titulo">
            Parcela {original?.parcelaNumero} de {original?.parcelaTotal}
          </h1>
        ) : (
          <div class="alternador" role="group" aria-label="Tipo de lançamento">
            <button aria-pressed={tipo === 'despesa'} onClick={() => trocarTipo('despesa')}>
              Gasto
            </button>
            <button aria-pressed={tipo === 'receita'} onClick={() => trocarTipo('receita')}>
              Receita
            </button>
          </div>
        )}
        {id ? (
          <button class="btn-perigo lancar-excluir" onClick={excluir}>
            Excluir
          </button>
        ) : (
          <span />
        )}
      </div>

      <div class="lancar-valor" aria-live="polite">
        <span class="moeda">R$</span>
        <span class={`numero ${valor ? '' : 'vazio'}`} style={{ fontSize: `${tamanhoDoValor(texto)}px` }}>
          {texto}
        </span>
      </div>

      <div class="lancar-meio">
        <div class="linha-campos">
          {modo === 'parcela' ? (
            <span class="campo-data">{rotuloData(data, hoje)}</span>
          ) : (
            <label class="campo-data">
              <span>{rotuloData(data, hoje)}</span>
              <input
                type="date"
                value={data}
                aria-label="Data do lançamento"
                onInput={(e) => e.currentTarget.value && trocarData(e.currentTarget.value)}
              />
            </label>
          )}
          <label class="campo-texto-rotulo">
            <span class="sr-only">Descrição</span>
            <input
              class="campo-texto"
              placeholder="Descrição (opcional)"
              value={descricao}
              maxLength={80}
              enterKeyHint="done"
              onInput={(e) => setDescricao(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
        </div>

        {tipo === 'despesa' && modo !== 'parcela' && (
          <div class="opcoes" role="group" aria-label="Forma de pagamento">
            {FORMAS.map((f) => (
              <button
                key={f.id}
                aria-pressed={formaEfetiva === f.id}
                disabled={!f.liberada}
                title={f.liberada ? undefined : 'Disponível em breve'}
                onClick={() => setForma(f.id)}
              >
                {f.nome}
              </button>
            ))}
          </div>
        )}

        {ehCredito && modo !== 'parcela' && !cartao && cartao !== null && (
          <p class="aviso-inline">
            Para lançar no crédito, cadastre o cartão primeiro.{' '}
            <a class="link-acao" href={href('/cartao/ajustes')}>
              Cadastrar cartão
            </a>
          </p>
        )}

        {ehCredito && modo !== 'parcela' && cartao && (
          <>
            <div class="parcelas">
              <span class="apoio-forte">{textoParcelas}</span>
              <div class="parcelas-controle">
                <button
                  class="parcelas-btn"
                  aria-label="Menos parcelas"
                  disabled={parcelas <= 1}
                  onClick={() => setParcelas((p) => Math.max(1, p - 1))}
                >
                  −
                </button>
                <span class="parcelas-qtd" aria-live="polite">
                  {parcelas}x
                </span>
                <button
                  class="parcelas-btn"
                  aria-label="Mais parcelas"
                  disabled={parcelas >= MAX_PARCELAS}
                  onClick={() => setParcelas((p) => Math.min(MAX_PARCELAS, p + 1))}
                >
                  +
                </button>
              </div>
            </div>

            {padrao?.diaDeFechamento ? (
              <div class="escolha-fatura">
                <span class="rotulo-campo">Hoje a fatura fecha. Em qual ela entra?</span>
                <div class="opcoes" role="group" aria-label="Fatura da compra">
                  <button aria-pressed={escolhaFatura === 'esta'} onClick={() => setEscolhaFatura('esta')}>
                    Esta ({nomeMes(padrao.ref)})
                  </button>
                  <button aria-pressed={escolhaFatura === 'proxima'} onClick={() => setEscolhaFatura('proxima')}>
                    Próxima ({nomeMes(addMonths(padrao.ref, 1))})
                  </button>
                </div>
              </div>
            ) : (
              faturaInicial && (
                <p class="apoio info-fatura">
                  {parcelas > 1
                    ? `1ª parcela na fatura de ${nomeMes(faturaInicial)} (vence ${diaMes(vencimentoDe(faturaInicial, cartao))}); a última em ${nomeMes(addMonths(faturaInicial, parcelas - 1))}.`
                    : `Entra na fatura de ${nomeMes(faturaInicial)}, que vence em ${diaMes(vencimentoDe(faturaInicial, cartao))}.`}
                </p>
              )
            )}
          </>
        )}

        <div class="grade-cats" role="group" aria-label="Categoria">
          {opcoes.map((c) => (
            <button key={c.id} class="cat-btn" aria-pressed={c.id === catId} onClick={() => setCatId(c.id)}>
              <IconeCategoria icone={c.icone} cor={c.cor} />
              <span class="cat-nome">{c.nome}</span>
            </button>
          ))}
        </div>
      </div>

      <div class="teclado">
        {TECLAS.map((t) => (
          <button
            key={t}
            class="tecla"
            aria-label={t === 'apagar' ? 'Apagar' : t}
            onClick={() => setDigitos((d) => pressionar(d, t))}
          >
            {t === 'apagar' ? <Icon nome="apagar" size={26} /> : t}
          </button>
        ))}
      </div>

      <button class="btn-principal" disabled={!!pendencia || salvando} onClick={salvar}>
        {rotuloSalvar}
      </button>
    </main>
  )
}
