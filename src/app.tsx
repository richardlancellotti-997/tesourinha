import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'preact/hooks'
import { db } from './db/db'
import { PERFIL_ID } from './db/repo'
import type { Kind } from './db/types'
import { useRota } from './router'
import { useAviso } from './ui/aviso'
import { BoasVindas } from './ui/screens/BoasVindas'
import { Categorias } from './ui/screens/Categorias'
import { EmBreve } from './ui/screens/EmBreve'
import { Inicio } from './ui/screens/Inicio'
import { Lancar } from './ui/screens/Lancar'
import { Mais } from './ui/screens/Mais'
import { TabBar } from './ui/TabBar'
import { aplicarTema } from './ui/theme'

export function App() {
  const perfil = useLiveQuery(() => db.profile.get(PERFIL_ID), [], 'carregando' as const)
  const rota = useRota()
  const aviso = useAviso()

  useEffect(() => {
    if (perfil && perfil !== 'carregando') aplicarTema(perfil)
  }, [perfil])

  if (perfil === 'carregando') return null
  if (!perfil) return <BoasVindas />

  const [tela, param] = rota.partes
  let conteudo
  let aba: string | null = null

  switch (tela) {
    case 'lancar':
      // Lançar ocupa a tela toda, sem a barra de navegação
      conteudo = <Lancar key={param ?? 'novo'} id={param} tipoInicial={(rota.params.get('tipo') as Kind) ?? undefined} />
      break
    case 'cartao':
      conteudo = <EmBreve qual="cartao" />
      aba = 'cartao'
      break
    case 'voucher':
      conteudo = <EmBreve qual="voucher" />
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
    default:
      conteudo = <Inicio />
      aba = 'inicio'
  }

  return (
    <>
      {conteudo}
      {aba && <TabBar ativa={aba} />}
      {aviso && (
        <div class="aviso" role="status" key={aviso.id}>
          {aviso.texto}
        </div>
      )}
    </>
  )
}
