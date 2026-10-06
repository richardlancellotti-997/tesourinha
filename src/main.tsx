import { render } from 'preact'
import { App } from './app'
import { requestPersistentStorage } from './db/db'
import { garantirDadosIniciais } from './db/repo'
import { aplicarTemaInicial } from './ui/theme'
import './styles/base.css'
import './styles/telas.css'

aplicarTemaInicial()

garantirDadosIniciais().finally(() => {
  render(<App />, document.getElementById('app')!)
})

requestPersistentStorage()
