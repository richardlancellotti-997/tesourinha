import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { db } from '../../db/db'
import { excluirLancamento, PERFIL_ID, salvarLancamento } from '../../db/repo'
import type { Category, Kind, PaymentMethod, Transaction } from '../../db/types'
import { rotuloData, today } from '../../domain/dates'
import { centavosParaDigitos, digitosParaCentavos, pressionar, type Tecla } from '../../domain/keypad'
import { formatValor } from '../../domain/money'
import { voltar } from '../../router'
import { avisar } from '../aviso'
import { Icon, IconeCategoria } from '../Icon'

// Crédito e voucher são liberados nas Etapas 2 e 3.
const FORMAS: { id: PaymentMethod; nome: string; liberada: boolean }[] = [
  { id: 'debito_pix', nome: 'Débito/Pix', liberada: true },
  { id: 'credito', nome: 'Crédito', liberada: false },
  { id: 'voucher', nome: 'Voucher', liberada: false },
]
const liberada = (f?: PaymentMethod) => FORMAS.some((x) => x.id === f && x.liberada)

const TECLAS: Tecla[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'apagar']

function tamanhoDoValor(texto: string): number {
  if (texto.length <= 5) return 76
  if (texto.length <= 7) return 62
  if (texto.length <= 9) return 50
  return 40
}

export function Lancar({ id, tipoInicial }: { id?: string; tipoInicial?: Kind }) {
  const hoje = today()
  const perfil = useLiveQuery(() => db.profile.get(PERFIL_ID), [])
  const categorias = useLiveQuery(() => db.categories.orderBy('ordem').toArray(), [], [] as Category[])

  const [tipo, setTipo] = useState<Kind>(tipoInicial ?? 'despesa')
  const [digitos, setDigitos] = useState('')
  const [data, setData] = useState(hoje)
  const [descricao, setDescricao] = useState('')
  const [forma, setForma] = useState<PaymentMethod | null>(null)
  const [catId, setCatId] = useState<string | null>(null)
  // undefined = carregando; null = não encontrado (só na edição)
  const [original, setOriginal] = useState<Transaction | null | undefined>(id ? undefined : null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!id) return
    db.transactions.get(id).then((tx) => {
      setOriginal(tx ?? null)
      if (!tx) return
      setTipo(tx.tipo)
      setDigitos(centavosParaDigitos(tx.valor))
      setData(tx.data)
      setDescricao(tx.descricao ?? '')
      setForma(tx.formaPagamento)
      setCatId(tx.categoriaId)
    })
  }, [id])

  // Sem escolha explícita, vale a última forma usada (se já estiver liberada).
  const formaEfetiva: PaymentMethod = forma ?? (liberada(perfil?.ultimaForma) ? perfil!.ultimaForma! : 'debito_pix')

  const valor = digitosParaCentavos(digitos)
  const texto = formatValor(valor)
  const opcoes = categorias.filter((c) => c.tipo === tipo && (!c.arquivada || c.id === catId))
  const catValida = catId !== null && opcoes.some((c) => c.id === catId)
  const pendencia = valor === 0 ? 'Digite o valor' : !catValida ? 'Escolha a categoria' : null
  const rotuloSalvar = pendencia ?? (id ? 'Salvar alterações' : tipo === 'despesa' ? 'Salvar gasto' : 'Salvar receita')

  function trocarTipo(novo: Kind) {
    setTipo(novo)
    setCatId(null)
  }

  async function salvar() {
    if (pendencia || salvando) return
    setSalvando(true)
    try {
      await salvarLancamento(
        {
          tipo,
          valor,
          data,
          categoriaId: catId!,
          descricao,
          formaPagamento: tipo === 'despesa' ? formaEfetiva : 'debito_pix',
        },
        id,
      )
      avisar(id ? 'Alterações salvas' : tipo === 'despesa' ? 'Gasto salvo' : 'Receita salva')
      voltar()
    } catch {
      setSalvando(false)
      avisar('O lançamento não foi salvo. Tente de novo.')
    }
  }

  async function excluir() {
    if (!id || !confirm('Excluir este lançamento? Não dá para desfazer.')) return
    await excluirLancamento(id)
    avisar('Lançamento excluído')
    voltar()
  }

  // Teclado físico (útil no computador): números, Backspace e Enter.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement
      if (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA') return
      if (/^\d$/.test(e.key)) setDigitos((d) => pressionar(d, e.key as Tecla))
      else if (e.key === 'Backspace') setDigitos((d) => pressionar(d, 'apagar'))
      else if (e.key === 'Enter') salvar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  if (id && original === null) {
    return (
      <main class="tela">
        <p>Este lançamento não existe mais. Ele pode ter sido excluído.</p>
        <button class="btn-principal" onClick={voltar}>
          Voltar
        </button>
      </main>
    )
  }
  if (id && original === undefined) return null

  return (
    <main class="lancar">
      <div class="lancar-topo">
        <button class="lancar-cancelar" onClick={voltar}>
          Cancelar
        </button>
        <div class="alternador" role="group" aria-label="Tipo de lançamento">
          <button aria-pressed={tipo === 'despesa'} onClick={() => trocarTipo('despesa')}>
            Gasto
          </button>
          <button aria-pressed={tipo === 'receita'} onClick={() => trocarTipo('receita')}>
            Receita
          </button>
        </div>
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
          <label class="campo-data">
            <span>{rotuloData(data, hoje)}</span>
            <input
              type="date"
              value={data}
              aria-label="Data do lançamento"
              onInput={(e) => e.currentTarget.value && setData(e.currentTarget.value)}
            />
          </label>
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

        {tipo === 'despesa' && (
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
