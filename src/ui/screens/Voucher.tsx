import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'preact/hooks'
import { db } from '../../db/db'
import { estadoDoVoucher, garantirCreditosVoucher } from '../../db/repo'
import type { Category } from '../../db/types'
import { diaMes, rotuloData, today } from '../../domain/dates'
import { formatValor } from '../../domain/money'
import { ehDiaNaEmpresa, feriadosEntre } from '../../domain/voucher'
import { href } from '../../router'
import { Icon, PontoCategoria } from '../Icon'

export function Voucher() {
  const hoje = today()
  useEffect(() => {
    garantirCreditosVoucher(hoje)
  }, [hoje])

  // Recalcula quando mudam lançamentos, créditos ou ajustes
  const estado = useLiveQuery(() => estadoDoVoucher(hoje), [hoje], undefined)
  const gastos = useLiveQuery(
    () =>
      estado
        ? db.transactions
            .where('formaPagamento')
            .equals('voucher')
            .filter((t) => t.tipo === 'despesa' && t.data >= estado.ciclo.inicio && t.data <= estado.ciclo.fim)
            .toArray()
        : [],
    [estado?.ciclo.inicio],
    [],
  )
  const categorias = useLiveQuery(() => db.categories.toArray(), [], [] as Category[])

  if (estado === undefined) return null
  if (estado === null) {
    return (
      <main class="tela">
        <h1 class="titulo-grande">Voucher</h1>
        <p class="em-breve">
          Configure o vale-alimentação para ver o saldo e quanto dá para gastar por dia na empresa até o próximo crédito.
        </p>
        <a class="btn-principal" href={href('/voucher/ajustes')}>
          Configurar voucher
        </a>
      </main>
    )
  }

  const { cfg, ciclo, saldo, gastoNoCiclo, ritmo } = estado
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const disponivelNoCiclo = saldo + gastoNoCiclo
  const pctGasto = disponivelNoCiclo > 0 ? Math.min(100, Math.round((gastoNoCiclo / disponivelNoCiclo) * 100)) : 0
  const pctDias = ritmo.diasNoCiclo > 0 ? Math.round((ritmo.diasPassados / ritmo.diasNoCiclo) * 100) : 0
  const feriados = feriadosEntre(hoje, ciclo.fim, cfg.diasEmpresa)
  const hojeNaEmpresa = ehDiaNaEmpresa(hoje, cfg.diasEmpresa)

  const porCategoria = new Map<string, number>()
  for (const g of gastos) porCategoria.set(g.categoriaId, (porCategoria.get(g.categoriaId) ?? 0) + g.valor)
  const cats = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])
  const ultimos = [...gastos].sort((a, b) => (a.data === b.data ? (a.createdAt < b.createdAt ? 1 : -1) : a.data < b.data ? 1 : -1)).slice(0, 5)

  let textoSaldo: string
  if (saldo <= 0) textoSaldo = `O saldo acabou. O próximo crédito cai em ${diaMes(ciclo.proximoCredito)}.`
  else if (ritmo.porDia === null) textoSaldo = `Saldo de ${formatValor(saldo)}. Não há mais dias na empresa até o próximo crédito, em ${diaMes(ciclo.proximoCredito)}.`
  else {
    textoSaldo = `Saldo de ${formatValor(saldo)} para ${ritmo.diasRestantes} ${ritmo.diasRestantes === 1 ? 'dia' : 'dias'} na empresa até ${diaMes(ciclo.fim)}.`
    if (feriados.length === 1) textoSaldo += ` O feriado de ${diaMes(feriados[0].data)} já ficou de fora.`
    if (feriados.length > 1) textoSaldo += ` Os feriados de ${feriados.map((f) => diaMes(f.data)).join(' e ')} já ficaram de fora.`
  }

  let textoRitmo: string | null = null
  if (ritmo.porDia !== null && saldo > 0 && gastoNoCiclo > 0) {
    textoRitmo =
      pctGasto > pctDias + 5
        ? `O gasto está à frente dos dias na empresa. Mantendo ${formatValor(ritmo.porDia)} por dia, o saldo chega até ${diaMes(ciclo.fim)}.`
        : `O gasto está dentro do ritmo dos dias na empresa.`
  }

  return (
    <main class="tela">
      <div class="topo">
        <h1>Voucher</h1>
        <a class="apoio link-discreto" href={href('/voucher/ajustes')}>
          Ciclo de {diaMes(ciclo.inicio)} a {diaMes(ciclo.fim)}
        </a>
      </div>

      {cfg.valorPorDia === undefined && (
        <a class="lembrete" href={href('/voucher/ajustes')}>
          <span>
            <span class="lembrete-titulo">Informe o valor por dia útil</span>
            <br />
            <span class="apoio">O crédito passa a ser calculado pelos dias úteis de cada mês.</span>
          </span>
          <Icon nome="avancar" />
        </a>
      )}

      <section class="secao resumo" aria-label="Saldo do voucher">
        <div>
          <div class="apoio-forte">Dá para gastar por dia útil</div>
          <div class={`valor-grande ${saldo < 0 ? 'negativo' : ''}`}>{ritmo.porDia !== null ? formatValor(ritmo.porDia) : '—'}</div>
          <p class="apoio-forte texto-curto">{textoSaldo}</p>
        </div>

        <div class="ritmo">
          <div class="ritmo-topo">
            <span>
              <strong>{formatValor(gastoNoCiclo)}</strong> <span class="apoio">gastos de {formatValor(disponivelNoCiclo)}</span>
            </span>
            <span class="apoio">{pctGasto}%</span>
          </div>
          <div class="ritmo-barra" role="img" aria-label={`${pctGasto}% gasto, ${pctDias}% dos dias na empresa já passaram`}>
            <span class="ritmo-gasto" style={{ width: `${pctGasto}%` }} />
            <span class="ritmo-hoje" style={{ left: `${pctDias}%` }} />
          </div>
          <div class="apoio ritmo-legenda">
            {hojeNaEmpresa
              ? `Hoje é o ${ritmo.diasPassados + 1}º dia na empresa de ${ritmo.diasNoCiclo}`
              : `Hoje não é dia na empresa; ${ritmo.diasPassados} de ${ritmo.diasNoCiclo} já passaram`}
          </div>
          {textoRitmo && <p class="apoio texto-curto">{textoRitmo}</p>}
        </div>
      </section>

      <a class="btn-secundario" href={href('/lancar?forma=voucher')}>
        Lançar gasto no voucher
      </a>

      {cats.length > 0 && (
        <section class="secao">
          <h2>Neste ciclo</h2>
          <div>
            {cats.map(([id, total]) => {
              const cat = porId.get(id)
              return (
                <div key={id} class="lanc">
                  <span class="linha-cat-nome">
                    <span class="ponto" style={{ background: `var(--cat-${cat?.cor ?? 'cinza'})` }} />
                    {cat?.nome ?? 'Sem categoria'}
                  </span>
                  <span class="lanc-valor">{formatValor(total)}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section class="secao">
        <h2>Últimos gastos</h2>
        {ultimos.length === 0 ? (
          <p class="vazio">Nenhum gasto no voucher neste ciclo.</p>
        ) : (
          <div>
            {ultimos.map((t) => {
              const cat = porId.get(t.categoriaId)
              return (
                <a key={t.id} class="lanc" href={href(`/lancar/${t.id}`)}>
                  <span class="lanc-texto">
                    <span class="lanc-principal">
                      <PontoCategoria cor={cat?.cor} />
                      {t.descricao || cat?.nome || 'Sem categoria'}
                    </span>
                    <span class="apoio">
                      {rotuloData(t.data, hoje)}
                      {t.descricao && cat ? `, ${cat.nome.toLowerCase()}` : ''}
                    </span>
                  </span>
                  <span class="lanc-valor">{formatValor(t.valor)}</span>
                </a>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
