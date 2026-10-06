import { render } from 'preact'
import { App } from './app'
import { requestPersistentStorage } from './db/db'
import './styles/base.css'

render(<App />, document.getElementById('app')!)

requestPersistentStorage()
