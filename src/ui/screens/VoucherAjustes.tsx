import { useEffect, useState } from 'preact/hooks'
import { estadoDoVoucher, garantirCreditosVoucher, salvarVoucher } from '../../db/repo'
import type { VoucherConfig } from '../../db/types'
import { today } from '../../domain/dates'
import type { Cents } from '../../domain/money'
import { DIAS_UTEIS_PADRAO } from '../../domain/voucher'
import { voltar } from '../../router'
import { avisar } from '../aviso'
import { CampoLista, CampoValor, OPCOES_DIA } from '../Campos'
import { Icon } from '../Icon'

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
  const [valor, setValor] = useState<Cents | null>(null)
  const [dia, setDia] = useState<number | null>(null)
  const [saldo, setSaldo] = useState<Cents | null>(null)
  const [saldoOriginal, setSaldoOriginal] = useState<Cents | null>(null)
  const [acumula, setAcumula] = useState(true)
  const [diasEmpresa, setDiasEmpresa] = useState<boolean[]>(DIAS_UTEIS_PADRAO)

  useEffect(() => {
    ;(async () => {
      await garantirCreditosVoucher(hoje)
      const estado = await estadoDoVoucher(hoje)
      setCfg(estado?.cfg ?? null)
      if (estado) {
        setValor(estado.cfg.valorMensal)
        setDia(estado.cfg.diaCredito)
        setAcumula(estado.cfg.acumulaSaldo)
        setDiasEmpresa(estado.cfg.diasEmpresa)
        setSaldo(estado.saldo)
        setSaldoOriginal(estado.saldo)
      }
    })()
  }, [hoje])

  if (cfg === undefined) return null

  const completo = valor !== null && dia !== null && diasEmpresa.some(Boolean)

  async function salvar(e: Event) {
    e.preventDefault()
    if (!completo) return
    // Saldo vazio = zero. Na edição, só grava ajuste se o saldo foi mudado.
    const mudouSaldo = !cfg || (saldo ?? 0) !== (saldoOriginal ?? 0)
    await salvarVoucher(
      { valorMensal: valor!, diaCredito: dia!, acumulaSaldo: acumula, diasEmpresa },
      hoje,
      mudouSaldo ? (saldo ?? 0) : undefined,
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
            <CampoValor valor={valor} aoMudar={setValor} />
          </label>
          <label class="linha">
            <span>Cai no dia</span>
            <CampoLista rotulo="Dia do crédito" valor={dia} opcoes={OPCOES_DIA} aoMudar={setDia} />
          </label>
          <label class="linha">
            <span>{cfg ? 'Saldo hoje' : 'Quanto tem hoje'}</span>
            <CampoValor valor={saldo} aoMudar={setSaldo} />
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
        <p class="apoio nota-grupo">
          {cfg
            ? 'Se o saldo do app não bater com o do cartão do voucher, corrija o "Saldo hoje": a diferença fica registrada como ajuste.'
            : 'Digite os valores só com números: 72088 vira 720,88. O crédito mensal entra sozinho no dia escolhido; mudar o valor depois vale só para os próximos créditos.'}
        </p>

        <button type="submit" class="btn-principal" disabled={!completo}>
          {completo ? 'Salvar voucher' : 'Preencha o valor por mês e o dia'}
        </button>
      </form>
    </main>
  )
}
