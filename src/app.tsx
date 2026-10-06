import type { ComponentChildren } from 'preact'
import { href, useRoute } from './router'

// Telas vazias da Etapa 0. O layout real vem depois da aprovação do plano de design.
const screens: { path: string; title: string; label: string }[] = [
  { path: '/', title: 'Início', label: 'Início' },
  { path: '/lancar', title: 'Lançar', label: 'Lançar' },
  { path: '/fatura', title: 'Fatura', label: 'Fatura' },
  { path: '/voucher', title: 'Voucher', label: 'Voucher' },
  { path: '/ajustes', title: 'Ajustes', label: 'Ajustes' },
]

function Screen({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <main class="screen">
      <h1>{title}</h1>
      {children ?? <p class="placeholder">Tela em construção.</p>}
    </main>
  )
}

export function App() {
  const path = useRoute()
  const screen = screens.find((s) => s.path === path) ?? screens[0]

  return (
    <div class="shell">
      <Screen title={screen.title} />
      <nav class="tabbar" aria-label="Navegação principal">
        {screens.map((s) => (
          <a key={s.path} href={href(s.path)} aria-current={s.path === screen.path ? 'page' : undefined}>
            {s.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
