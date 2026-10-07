import { useEffect, useState } from 'preact/hooks'
import { estadoDoVoucher, garantirCreditosVoucher, salvarVoucher } from '../../db/repo'
import type { VoucherConfig } from '../../db/types'
import { today } from '../../domain/dates'
import { formatValor, parseBRL } from '../../domain/money'
import { DIAS_UTEIS_PADRAO } from '../../domain/voucher'
import { voltar } from '../../router'
import { avisar } from '../aviso'
import { Icon } from '../Icon'

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const SEMANA = [
  ['D', 'Domingo'],
  ['S', 'Segunda'],
  ['T', 'Terça'],
  ['Q', 'Quarta'],
  ['Q', 'Quinta'],
  ['S', 'Sexta'],
  ['S', 'Sábado'],
]

export function VoucherAjustes() {
  const hoje = today()
  const [cfg, setCfg] = useState<VoucherConfig | null | undefined>(undefined) // undefined = carregando
  const [valor, setValor] = useState('')
  const [dia, setDia] = useState(0)
  const [saldo, setSaldo] = useState('')
  const [saldoOriginal, setSaldoOriginal] = useState('')
  const [acumula, setAcumula] = useState(true)
  const [diasEmpresa, setDiasEmpresa] = useState<boolean[]>(DIAS_UTEIS_PADRAO)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      await garantirCreditosVoucher(hoje)
      const estado = await estadoDoVoucher(hoje)
      setCfg(estado?.cfg ?? null)
      if (estado) {
        setValor(formatValor(estado.cfg.valorMensal))
        setDia(estado.cfg.diaCredito)
        setAcumula(estado.cfg.acumulaSaldo)
        setDiasEmpresa(estado.cfg.diasEmpresa)
        setSaldo(formatValor(estado.saldo))
        setSaldoOriginal(formatValor(estado.saldo))
      }
    })()
  }, [hoje])

  if (cfg === undefined) return null

  const completo = !!valor.trim() && dia > 0 && (!!cfg || !!saldo.trim()) && diasEmpresa.some(Boolean)

  async function salvar(e: Event) {
    e.preventDefault()
    if (!completo) return
    const valorCents = parseBRL(valor)
    const saldoCents = saldo.trim() ? parseBRL(saldo) : null
    if (valorCents === null) return setErro('O valor por mês não está num formato válido. Use, por exemplo, 1.100,00.')
    if (saldo.trim() && saldoCents === null) return setErro('O saldo não está num formato válido. Use, por exemplo, 412,80.')
    const mudouSaldo = !cfg || saldo !== saldoOriginal
    await salvarVoucher(
      { valorMensal: valorCents, diaCredito: dia, acumulaSaldo: acumula, diasEmpresa },
      hoje,
      mudouSaldo ? (saldoCents ?? 0) : undefined,
    )
    avisar(cfg ? 'Voucher salvo' : 'Voucher configurado')
    voltar()
  }

  return (
    <main class="tela">
      <div class="topo topo-voltar">
        <button class="btn-icone" aria-label="Voltar" onClick={voltar}>
          <Icon nome="voltar" />
        </button>
        <h1>{cfg ? 'Ajustes do voucher' : 'Configurar voucher'}</h1>
        <span class="espaco-44" />
      </div>

      <form class="secao" onSubmit={salvar}>
        <div class="grupo">
          <label class="linha">
            <span>Valor por mês</span>
            <input
              class="campo-linha"
              value={valor}
              inputMode="decimal"
              placeholder="0,00"
              onInput={(e) => {
                setValor(e.currentTarget.value)
                setErro(null)
              }}
            />
          </label>
          <label class="linha">
            <span>Cai no dia</span>
            <select class="campo-linha" value={dia || ''} onChange={(e) => setDia(Number(e.currentTarget.value))}>
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
            <span>{cfg ? 'Saldo hoje' : 'Quanto tem hoje'}</span>
            <input
              class="campo-linha"
              value={saldo}
              inputMode="decimal"
              placeholder="0,00"
              onInput={(e) => {
                setSaldo(e.currentTarget.value)
                setErro(null)
              }}
            />
          </label>
          <label class="linha">
            <span>Saldo que sobra acumula</span>
            <input
              type="checkbox"
              role="switch"
              class="interruptor"
              checked={acumula}
              onChange={(e) => setAcumula(e.currentTarget.checked)}
            />
          </label>
          <div class="linha linha-coluna">
            <span>Dias na empresa</span>
            <div class="dias-semana" role="group" aria-label="Dias na empresa">
              {SEMANA.map(([letra, nome], i) => (
                <button
                  type="button"
                  key={nome}
                  aria-pressed={diasEmpresa[i]}
                  aria-label={nome}
                  class="dia-semana"
                  onClick={() => setDiasEmpresa((d) => d.map((v, j) => (j === i ? !v : v)))}
                >
                  {letra}
                </button>
              ))}
            </div>
            <span class="apoio">
              O "dá para gastar por dia" divide o saldo só por esses dias, sem os feriados nacionais, o Carnaval e o Corpus
              Christi.
            </span>
          </div>
        </div>
        {erro && <p class="negativo apoio-forte">{erro}</p>}
        <p class="apoio nota-grupo">
          {cfg
            ? 'Se o saldo do app não bater com o do cartão do voucher, corrija o "Saldo hoje": a diferença fica registrada como ajuste.'
            : 'O crédito mensal entra sozinho no dia escolhido. Mudar o valor depois vale só para os próximos créditos.'}
        </p>

        <button type="submit" class="btn-principal" disabled={!completo}>
          {completo ? 'Salvar voucher' : 'Preencha valor, dia e saldo'}
        </button>
      </form>
    </main>
  )
}
