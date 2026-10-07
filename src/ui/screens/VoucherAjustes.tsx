import { useEffect, useState } from 'preact/hooks'
import { estadoDoVoucher, garantirCreditosVoucher, salvarVoucher } from '../../db/repo'
import type { VoucherConfig } from '../../db/types'
import { diaMes, nomeMes, today } from '../../domain/dates'
import { formatValor, type Cents } from '../../domain/money'
import { cicloDe, DIAS_UTEIS_PADRAO, valorDoCredito } from '../../domain/voucher'
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
        setValor(estado.cfg.valorPorDia ?? null)
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

  // Prévia do próximo crédito
  let previa: { data: string; dias: number; ym: string; valor: Cents } | null = null
  if (valor !== null && dia !== null) {
    const proxima = cicloDe(hoje, dia).proximoCredito
    previa = { data: proxima, ...valorDoCredito(proxima, valor, cfg?.mesDoCredito ?? 'seguinte') }
  }

  async function salvar(e: Event) {
    e.preventDefault()
    if (!completo) return
    // Saldo vazio = zero. Na edição, só grava ajuste se o saldo foi mudado.
    const mudouSaldo = !cfg || (saldo ?? 0) !== (saldoOriginal ?? 0)
    await salvarVoucher(
      { valorPorDia: valor!, mesDoCredito: cfg?.mesDoCredito ?? 'seguinte', diaCredito: dia!, acumulaSaldo: acumula, diasEmpresa },
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
            <span>Valor por dia útil</span>
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
        {previa && (
          <p class="apoio-forte nota-grupo">
            Próximo crédito em {diaMes(previa.data)}: {previa.dias} dias úteis de {nomeMes(previa.ym)} ×{' '}
            {formatValor(valor!)} = <strong>{formatValor(previa.valor)}</strong>.
          </p>
        )}
        {cfg && cfg.valorPorDia === undefined && (
          <p class="aviso-inline">
            O voucher estava configurado com {formatValor(cfg.valorMensal)} fixos por mês. Informe o valor por dia útil para o
            crédito ser calculado pelos dias úteis de cada mês.
          </p>
        )}
        <p class="apoio nota-grupo">
          Dia útil para o crédito: segunda a sexta, sem os feriados nacionais (Carnaval e Corpus Christi contam).
        </p>
        <p class="apoio nota-grupo">
          {cfg
            ? 'Se o saldo do app não bater com o do cartão do voucher, corrija o "Saldo hoje": a diferença fica registrada como ajuste.'
            : 'Digite os valores só com números: 3300 vira 33,00. O crédito entra sozinho no dia escolhido; mudar o valor depois vale só para os próximos créditos.'}
        </p>

        <button type="submit" class="btn-principal" disabled={!completo}>
          {completo ? 'Salvar voucher' : 'Preencha o valor por dia e o dia do crédito'}
        </button>
      </form>
    </main>
  )
}
