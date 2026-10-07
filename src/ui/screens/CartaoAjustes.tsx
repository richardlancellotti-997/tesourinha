import { useEffect, useState } from 'preact/hooks'
import { cartaoPrincipal, salvarCartao } from '../../db/repo'
import type { Card } from '../../db/types'
import { diaMes, today } from '../../domain/dates'
import { faturaAberta, fechamentoDe, vencimentoDe } from '../../domain/invoice'
import type { Cents } from '../../domain/money'
import { voltar } from '../../router'
import { avisar } from '../aviso'
import { CampoLista, CampoValor, OPCOES_DIA } from '../Campos'
import { Icon } from '../Icon'

export function CartaoAjustes() {
  const [cartao, setCartao] = useState<Card | null | undefined>(null) // null = carregando
  const [nome, setNome] = useState('')
  const [fecha, setFecha] = useState<number | null>(null)
  const [vence, setVence] = useState<number | null>(null)
  const [limite, setLimite] = useState<Cents | null>(null)

  useEffect(() => {
    cartaoPrincipal().then((c) => {
      setCartao(c)
      if (c) {
        setNome(c.nome)
        setFecha(c.diaFechamento)
        setVence(c.diaVencimento)
        setLimite(c.limite ?? null)
      }
    })
  }, [])

  if (cartao === null) return null

  const cfg = fecha !== null && vence !== null ? { diaFechamento: fecha, diaVencimento: vence } : null
  const exemplo = cfg ? faturaAberta(today(), cfg) : null

  async function salvar(e: Event) {
    e.preventDefault()
    if (!cfg) return
    await salvarCartao({ nome, ...cfg, limite: limite ?? 0 }, cartao?.id)
    avisar('Cartão salvo')
    voltar()
  }

  return (
    <main class="tela">
      <div class="topo topo-voltar">
        <button class="btn-icone" aria-label="Voltar" onClick={voltar}>
          <Icon nome="voltar" />
        </button>
        <h1>{cartao ? 'Ajustes do cartão' : 'Cadastrar cartão'}</h1>
        <span class="espaco-44" />
      </div>

      <form class="secao" onSubmit={salvar}>
        <div class="grupo">
          <label class="linha">
            <span>Nome</span>
            <input
              class="campo-linha"
              value={nome}
              placeholder="Meu cartão"
              maxLength={30}
              onInput={(e) => setNome(e.currentTarget.value)}
            />
          </label>
          <label class="linha">
            <span>Fecha no dia</span>
            <CampoLista rotulo="Dia de fechamento" valor={fecha} opcoes={OPCOES_DIA} aoMudar={setFecha} />
          </label>
          <label class="linha">
            <span>Vence no dia</span>
            <CampoLista rotulo="Dia de vencimento" valor={vence} opcoes={OPCOES_DIA} aoMudar={setVence} />
          </label>
          <label class="linha">
            <span>Limite (opcional)</span>
            <CampoValor valor={limite} aoMudar={setLimite} />
          </label>
        </div>

        {exemplo && cfg && (
          <p class="apoio nota-grupo">
            A fatura atual fecha em {diaMes(fechamentoDe(exemplo, cfg))} e vence em {diaMes(vencimentoDe(exemplo, cfg))}.
            Compras feitas no dia do fechamento perguntam em qual fatura entram.
          </p>
        )}
        {cartao && (
          <p class="apoio nota-grupo">
            Mudar os dias não move compras já lançadas: cada uma continua na fatura em que entrou.
          </p>
        )}

        <button type="submit" class="btn-principal" disabled={!cfg}>
          {cfg ? 'Salvar cartão' : 'Escolha os dias de fechamento e vencimento'}
        </button>
      </form>
    </main>
  )
}
