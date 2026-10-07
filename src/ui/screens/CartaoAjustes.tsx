import { useEffect, useState } from 'preact/hooks'
import { cartaoPrincipal, salvarCartao } from '../../db/repo'
import type { Card } from '../../db/types'
import { diaMes, today } from '../../domain/dates'
import { faturaAberta, fechamentoDe, vencimentoDe } from '../../domain/invoice'
import { formatValor, parseBRL } from '../../domain/money'
import { voltar } from '../../router'
import { avisar } from '../aviso'
import { Icon } from '../Icon'

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)

export function CartaoAjustes() {
  const [cartao, setCartao] = useState<Card | null | undefined>(null) // null = carregando
  const [nome, setNome] = useState('')
  const [fecha, setFecha] = useState(0)
  const [vence, setVence] = useState(0)
  const [limite, setLimite] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    cartaoPrincipal().then((c) => {
      setCartao(c)
      if (c) {
        setNome(c.nome)
        setFecha(c.diaFechamento)
        setVence(c.diaVencimento)
        setLimite(c.limite ? formatValor(c.limite) : '')
      }
    })
  }, [])

  if (cartao === null) return null

  const completo = fecha > 0 && vence > 0
  const exemplo = completo ? faturaAberta(today(), { diaFechamento: fecha, diaVencimento: vence }) : null

  async function salvar(e: Event) {
    e.preventDefault()
    if (!completo) return
    const limiteCents = limite.trim() ? parseBRL(limite) : 0
    if (limiteCents === null) {
      setErro('O limite não está num formato válido. Use, por exemplo, 4.000,00.')
      return
    }
    await salvarCartao({ nome, diaFechamento: fecha, diaVencimento: vence, limite: limiteCents }, cartao?.id)
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
            <select class="campo-linha" value={fecha || ''} onChange={(e) => setFecha(Number(e.currentTarget.value))}>
              <option value="" disabled>
                Escolha
              </option>
              {DIAS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label class="linha">
            <span>Vence no dia</span>
            <select class="campo-linha" value={vence || ''} onChange={(e) => setVence(Number(e.currentTarget.value))}>
              <option value="" disabled>
                Escolha
              </option>
              {DIAS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label class="linha">
            <span>Limite (opcional)</span>
            <input
              class="campo-linha"
              value={limite}
              inputMode="decimal"
              placeholder="0,00"
              onInput={(e) => {
                setLimite(e.currentTarget.value)
                setErro(null)
              }}
            />
          </label>
        </div>
        {erro && <p class="negativo apoio-forte">{erro}</p>}

        {exemplo && (
          <p class="apoio nota-grupo">
            A fatura atual fecha em {diaMes(fechamentoDe(exemplo, { diaFechamento: fecha, diaVencimento: vence }))} e vence em{' '}
            {diaMes(vencimentoDe(exemplo, { diaFechamento: fecha, diaVencimento: vence }))}. Compras feitas no dia do fechamento
            perguntam em qual fatura entram.
          </p>
        )}
        {cartao && (
          <p class="apoio nota-grupo">
            Mudar os dias não move compras já lançadas: cada uma continua na fatura em que entrou.
          </p>
        )}

        <button type="submit" class="btn-principal" disabled={!completo}>
          {completo ? 'Salvar cartão' : 'Escolha os dias de fechamento e vencimento'}
        </button>
      </form>
    </main>
  )
}
