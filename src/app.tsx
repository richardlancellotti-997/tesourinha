import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'preact/hooks'
import { db } from './db/db'
import { PERFIL_ID } from './db/repo'
import type { Kind, PaymentMethod } from './db/types'
import { useRota } from './router'
import { useAviso } from './ui/aviso'
import { Folha } from './ui/folha'
import { Assinaturas } from './ui/screens/Assinaturas'
import { BoasVindas } from './ui/screens/BoasVindas'
import { Receitas } from './ui/screens/Receitas'
import { Recorrencia } from './ui/screens/Recorrencia'
import { Cartao } from './ui/screens/Cartao'
import { CartaoAjustes } from './ui/screens/CartaoAjustes'
import { Cartoes } from './ui/screens/Cartoes'
import { Categorias } from './ui/screens/Categorias'
import { Voucher } from './ui/screens/Voucher'
import { VoucherAjustes } from './ui/screens/VoucherAjustes'
import { Inicio } from './ui/screens/Inicio'
import { Lancar } from './ui/screens/Lancar'
import { Mais } from './ui/screens/Mais'
import { TabBar } from './ui/TabBar'
import { aplicarTema } from './ui/theme'

export function App() {
  const perfil = useLiveQuery(() => db.profile.get(PERFIL_ID), [], 'carregando' as const)
  const rota = useRota()
  const aviso = useAviso()

  const rolagem = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (perfil && perfil !== 'carregando') aplicarTema(perfil)
  }, [perfil])

  // Cada tela nova começa do topo
  const chaveRota = rota.partes.join('/')
  useEffect(() => {
    rolagem.current?.scrollTo(0, 0)
  }, [chaveRota])

  if (perfil === 'carregando') return null
  if (!perfil) {
    return (
      <div class="app">
        <div class="rolagem">
          <BoasVindas />
        </div>
      </div>
    )
  }

  const [tela, param] = rota.partes
  let conteudo
  let aba: string | null = null

  switch (tela) {
    case 'lancar':
      // Lançar ocupa a tela toda, sem a barra de navegação
      conteudo = (
        <Lancar
          key={rota.params.toString() + (param ?? 'novo')}
          id={param}
          soParcela={rota.params.get('parcela') === '1'}
          formaInicial={(rota.params.get('forma') as PaymentMethod) ?? undefined}
          previstaId={rota.params.get('prevista') ?? undefined}
          situacaoInicial={rota.params.get('situacao') === 'prevista' ? 'prevista' : undefined}
          tipoInicial={(rota.params.get('tipo') as Kind) ?? undefined}
        />
      )
      break
    case 'cartao':
      conteudo = param === 'ajustes' ? <CartaoAjustes key={rota.partes[2] ?? ''} id={rota.partes[2]} /> : <Cartao />
      aba = 'cartao'
      break
    case 'voucher':
      conteudo = param === 'ajustes' ? <VoucherAjustes /> : <Voucher />
      aba = 'voucher'
      break
    case 'mais':
      conteudo = <Mais />
      aba = 'mais'
      break
    case 'categorias':
      conteudo = <Categorias />
      aba = 'mais'
      break
    case 'cartoes':
      conteudo = <Cartoes />
      aba = 'mais'
      break
    case 'assinaturas':
      conteudo = <Assinaturas />
      aba = 'mais'
      break
    case 'recorrencia':
      conteudo = (
        <Recorrencia
          key={param}
          id={param === 'nova' ? undefined : param}
          tipoInicial={rota.params.get('tipo') === 'receita' ? 'receita' : undefined}
        />
      )
      aba = 'mais'
      break
    case 'receitas':
      conteudo = <Receitas />
      aba = 'mais'
      break
    default:
      conteudo = <Inicio />
      aba = 'inicio'
  }

  // Estrutura fixa: só a área de rolagem rola; a barra de navegação é a parte de baixo
  // do layout (não usa position: fixed, que o iOS instalado desloca).
  return (
    <div class="app">
      <div class="rolagem" ref={rolagem}>
        {conteudo}
      </div>
      {aba && <TabBar ativa={aba} />}
      {aviso && (
        <div class={`aviso ${aba ? '' : 'aviso-sem-barra'}`} role="status" key={aviso.id}>
          {aviso.texto}
        </div>
      )}
      <Folha />
    </div>
  )
}
