import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { db } from '../../db/db'
import { cartaoPrincipal, encerrarRecorrencia, pausarRecorrencia, salvarRecorrencia } from '../../db/repo'
import type { Card, Category, Kind, PaymentMethod, Recurrence } from '../../db/types'
import { addDays, addMonths, diaMes, nomeMes, today } from '../../domain/dates'
import type { Cents } from '../../domain/money'
import { proximaData, valorNaData } from '../../domain/recurrence'
import { href, voltar } from '../../router'
import { avisar } from '../aviso'
import { CampoLista, CampoValor, OPCOES_DIA } from '../Campos'
import { Icon, IconeCategoria } from '../Icon'

const FORMAS: { id: PaymentMethod; nome: string }[] = [
  { id: 'debito_pix', nome: 'Débito/Pix' },
  { id: 'credito', nome: 'Crédito' },
  { id: 'voucher', nome: 'Voucher' },
]

/** Cadastro e edição de assinatura, conta fixa ou receita fixa (salário). */
export function Recorrencia({ id, tipoInicial }: { id?: string; tipoInicial?: Kind }) {
  const hoje = today()
  const categorias = useLiveQuery(() => db.categories.orderBy('ordem').toArray(), [], [] as Category[])
  const cartao = useLiveQuery(() => cartaoPrincipal(), [], null as Card | null | undefined)

  const [original, setOriginal] = useState<Recurrence | null | undefined>(id ? undefined : null)
  const [tipo, setTipo] = useState<Kind>(tipoInicial ?? 'despesa')
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState<Cents | null>(null)
  const [dia, setDia] = useState<number | null>(null)
  const [forma, setForma] = useState<PaymentMethod>('debito_pix')
  const [catId, setCatId] = useState<string | null>(null)
  const [escolha, setEscolha] = useState<'esta' | 'proxima' | null>(null)

  useEffect(() => {
    if (!id) return
    db.recurrences.get(id).then((r) => {
      setOriginal(r ?? null)
      if (!r) return
      setTipo(r.tipo)
      setNome(r.nome)
      setValor(valorNaData(r, hoje))
      setDia(r.diaDoMes)
      setForma(r.formaPagamento)
      setCatId(r.categoriaId)
      setEscolha(r.escolhaFechamento ?? null)
    })
  }, [id])

  if (id && original === undefined) return null
  if (id && original === null) {
    return (
      <main class="tela">
        <p>Esta recorrência não existe mais.</p>
        <button class="btn-principal" onClick={voltar}>
          Voltar
        </button>
      </main>
    )
  }

  const ehCredito = tipo === 'despesa' && forma === 'credito'
  const ehVoucher = tipo === 'despesa' && forma === 'voucher'
  const opcoes = categorias.filter(
    (c) => c.tipo === tipo && (!c.arquivada || c.id === catId) && (!ehVoucher || c.permitidaNoVoucher || c.id === catId),
  )
  const catValida = catId !== null && opcoes.some((c) => c.id === catId)
  const diaDoFechamento = ehCredito && cartao && dia !== null && dia === cartao.diaFechamento

  // Próxima data (na edição, depois do que já foi lançado)
  const proxima =
    dia !== null
      ? proximaData(
          { diaDoMes: dia, inicio: original?.inicio ?? hoje, historicoDeValores: [] },
          original ? (original.geradoAte > hoje ? original.geradoAte : hoje) : addDays(hoje, -1),
        )
      : null

  let pendencia: string | null = null
  if (!nome.trim()) pendencia = 'Dê um nome'
  else if (!valor) pendencia = 'Digite o valor'
  else if (dia === null) pendencia = 'Escolha o dia'
  else if (!catValida) pendencia = 'Escolha a categoria'
  else if (ehCredito && !cartao) pendencia = 'Cadastre o cartão para usar o crédito'
  else if (diaDoFechamento && !escolha) pendencia = 'Escolha a fatura'

  const mudouValor = original && valor !== null && valor !== valorNaData(original, hoje)

  async function salvar(e: Event) {
    e.preventDefault()
    if (pendencia) return
    await salvarRecorrencia(
      {
        nome,
        tipo,
        valor: valor!,
        diaDoMes: dia!,
        formaPagamento: tipo === 'despesa' ? forma : 'debito_pix',
        categoriaId: catId!,
        cardId: ehCredito ? cartao!.id : undefined,
        escolhaFechamento: diaDoFechamento ? escolha! : undefined,
      },
      hoje,
      id,
    )
    avisar(original ? 'Alterações salvas' : tipo === 'despesa' ? 'Assinatura salva' : 'Receita fixa salva')
    voltar()
  }

  async function pausar() {
    await pausarRecorrencia(id!, original!.ativa, hoje)
    avisar(original!.ativa ? 'Pausada' : 'Retomada')
    voltar()
  }

  async function encerrar() {
    if (!confirm(`Encerrar "${original!.nome}"? Ela para de ser lançada; o que já foi lançado continua.`)) return
    await encerrarRecorrencia(id!, hoje)
    avisar('Encerrada')
    voltar()
  }

  const encerrada = !!original?.fim
  const titulo = original
    ? original.nome
    : tipo === 'despesa'
      ? 'Nova assinatura ou conta fixa'
      : 'Nova receita fixa'

  return (
    <main class="tela">
      <div class="topo topo-voltar">
        <button class="btn-icone" aria-label="Voltar" onClick={voltar}>
          <Icon nome="voltar" />
        </button>
        <h1>{titulo}</h1>
        <span class="espaco-44" />
      </div>

      <form class="secao" onSubmit={salvar}>
        {!original && (
          <div class="alternador" role="group" aria-label="Tipo">
            <button type="button" aria-pressed={tipo === 'despesa'} onClick={() => (setTipo('despesa'), setCatId(null))}>
              Gasto
            </button>
            <button type="button" aria-pressed={tipo === 'receita'} onClick={() => (setTipo('receita'), setCatId(null))}>
              Receita (salário)
            </button>
          </div>
        )}

        <div class="grupo">
          <label class="linha">
            <span>Nome</span>
            <input
              class="campo-linha"
              value={nome}
              maxLength={40}
              placeholder={tipo === 'despesa' ? 'Streaming, aluguel…' : 'Salário'}
              onInput={(e) => setNome(e.currentTarget.value)}
            />
          </label>
          <label class="linha">
            <span>Valor</span>
            <CampoValor valor={valor} aoMudar={setValor} />
          </label>
          <label class="linha">
            <span>Todo dia</span>
            <CampoLista rotulo="Dia do mês" valor={dia} opcoes={OPCOES_DIA} aoMudar={(d) => (setDia(d), setEscolha(null))} />
          </label>
        </div>

        {tipo === 'despesa' && (
          <div class="opcoes" role="group" aria-label="Forma de pagamento">
            {FORMAS.map((f) => (
              <button type="button" key={f.id} aria-pressed={forma === f.id} onClick={() => (setForma(f.id), setEscolha(null))}>
                {f.nome}
              </button>
            ))}
          </div>
        )}

        {ehCredito && cartao === undefined && (
          <p class="aviso-inline">
            Para usar o crédito, cadastre o cartão primeiro.{' '}
            <a class="link-acao" href={href('/cartao/ajustes')}>
              Cadastrar cartão
            </a>
          </p>
        )}

        {diaDoFechamento && proxima && (
          <div class="escolha-fatura">
            <span class="rotulo-campo">O cartão fecha no dia {dia}. Em qual fatura a cobrança entra?</span>
            <div class="opcoes" role="group" aria-label="Fatura da cobrança">
              <button type="button" aria-pressed={escolha === 'esta'} onClick={() => setEscolha('esta')}>
                Na que fecha ({nomeMes(proxima.slice(0, 7))})
              </button>
              <button type="button" aria-pressed={escolha === 'proxima'} onClick={() => setEscolha('proxima')}>
                Na seguinte ({nomeMes(addMonths(proxima.slice(0, 7), 1))})
              </button>
            </div>
            <span class="apoio">A escolha vale para todos os meses.</span>
          </div>
        )}

        <div class="grade-cats" role="group" aria-label="Categoria">
          {opcoes.map((c) => (
            <button type="button" key={c.id} class="cat-btn" aria-pressed={c.id === catId} onClick={() => setCatId(c.id)}>
              <IconeCategoria icone={c.icone} cor={c.cor} />
              <span class="cat-nome">{c.nome}</span>
            </button>
          ))}
        </div>

        {!encerrada && proxima && (
          <p class="apoio nota-grupo">
            {original ? 'Próxima vez' : tipo === 'despesa' ? 'Primeira cobrança' : 'Primeira entrada'}: {diaMes(proxima)}.{' '}
            {tipo === 'despesa' ? 'O app lança sozinho no dia.' : 'Entra sozinha no dia, como recebida.'}
            {mudouValor ? ' O novo valor vale a partir de hoje; os meses já lançados não mudam.' : ''}
          </p>
        )}

        {!encerrada && (
          <button type="submit" class="btn-principal" disabled={!!pendencia}>
            {pendencia ?? (original ? 'Salvar alterações' : tipo === 'despesa' ? 'Salvar assinatura' : 'Salvar receita fixa')}
          </button>
        )}
      </form>

      {original && !encerrada && (
        <div class="acoes-rec">
          <button class="btn-secundario" onClick={pausar}>
            {original.ativa ? 'Pausar' : 'Retomar'}
          </button>
          <button class="btn-perigo" onClick={encerrar}>
            Encerrar
          </button>
        </div>
      )}
      {encerrada && <p class="apoio nota-grupo">Encerrada em {diaMes(original!.fim!)}. O que já foi lançado continua no histórico.</p>}
    </main>
  )
}
