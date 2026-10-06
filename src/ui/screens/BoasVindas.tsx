import { useEffect, useState } from 'preact/hooks'
import { salvarPerfil } from '../../db/repo'
import { CoresDestaque } from '../CoresDestaque'
import { aplicarTema, CORES_DESTAQUE } from '../theme'

/** Primeira abertura: cada pessoa define o próprio nome e a cor de destaque. */
export function BoasVindas() {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES_DESTAQUE[0].hex)

  useEffect(() => aplicarTema({ tema: 'auto', corDestaque: cor }), [cor])

  async function comecar(e: Event) {
    e.preventDefault()
    if (!nome.trim()) return
    await salvarPerfil({ nome: nome.trim(), corDestaque: cor, tema: 'auto' })
  }

  return (
    <main class="tela boas-vindas">
      <h1 class="marca">Tesourinha</h1>
      <p class="boas-vindas-texto">Seus gastos, assinaturas e receitas do dia a dia. Tudo fica guardado só neste aparelho.</p>

      <form class="secao" onSubmit={comecar}>
        <label class="editor-campo">
          <span class="rotulo-campo">Como você quer ser chamado?</span>
          <input
            class="campo-texto"
            value={nome}
            maxLength={40}
            autoComplete="given-name"
            onInput={(e) => setNome(e.currentTarget.value)}
          />
        </label>
        <div class="editor-campo">
          <span class="rotulo-campo">Escolha sua cor</span>
          <CoresDestaque valor={cor} aoEscolher={setCor} />
        </div>
        <button type="submit" class="btn-principal" disabled={!nome.trim()}>
          Começar
        </button>
      </form>
    </main>
  )
}
