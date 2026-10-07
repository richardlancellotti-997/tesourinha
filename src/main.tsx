import { render } from 'preact'
import { App } from './app'
import { requestPersistentStorage } from './db/db'
import { garantirCreditosVoucher, garantirDadosIniciais } from './db/repo'
import { today } from './domain/dates'
import { aplicarTemaInicial } from './ui/theme'
import './styles/base.css'
import './styles/telas.css'

aplicarTemaInicial()

// Sem zoom de pinça: o Safari do iPhone ignora user-scalable=no, então o gesto é bloqueado aqui.
for (const evento of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(evento, (e) => e.preventDefault(), { passive: false })
}

Promise.all([garantirDadosIniciais(), garantirCreditosVoucher(today())]).finally(() => {
  render(<App />, document.getElementById('app')!)
})

requestPersistentStorage()
