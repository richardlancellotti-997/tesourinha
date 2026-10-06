import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'preact/hooks'
import { db } from '../../db/db'
import { apagarCategoria, restaurarCategoria, salvarCategoria } from '../../db/repo'
import type { Category, Kind } from '../../db/types'
import {
  CORES_CATEGORIA,
  ICONES_CATEGORIA,
  sugerirCor,
  type CorCategoria,
  type IconeCategoria as NomeIcone,
} from '../../domain/categories'
import { voltar } from '../../router'
import { avisar } from '../aviso'
import { Icon, IconeCategoria } from '../Icon'

const NOMES_COR: Record<CorCategoria, string> = {
  azul: 'Azul',
  laranja: 'Laranja',
  verde: 'Verde',
  lilas: 'Lilás',
  ambar: 'Âmbar',
  magenta: 'Magenta',
  ciano: 'Ciano',
  ocre: 'Ocre',
  cinza: 'Cinza',
}

type Editando = { id: string } | { nova: Kind } | null

export function Categorias() {
  const cats = useLiveQuery(() => db.categories.orderBy('ordem').toArray(), [], [] as Category[])
  const [editando, setEditando] = useState<Editando>(null)

  return (
    <main class="tela">
      <div class="topo topo-voltar">
        <button class="btn-icone" aria-label="Voltar para Mais" onClick={voltar}>
          <Icon nome="voltar" />
        </button>
        <h1>Categorias</h1>
        <span class="espaco-44" />
      </div>

      {(['despesa', 'receita'] as Kind[]).map((tipo) => {
        const doTipo = cats
          .filter((c) => c.tipo === tipo)
          .sort((a, b) => Number(a.arquivada) - Number(b.arquivada) || a.ordem - b.ordem)
        const novaAberta = editando && 'nova' in editando && editando.nova === tipo
        return (
          <section key={tipo}>
            <h2 class="rotulo-grupo">{tipo === 'despesa' ? 'Gastos' : 'Receitas'}</h2>
            <div class="grupo">
              {doTipo.map((c) =>
                editando && 'id' in editando && editando.id === c.id ? (
                  <Editor key={c.id} tipo={tipo} categoria={c} irmas={doTipo} aoFechar={() => setEditando(null)} />
                ) : (
                  <button key={c.id} class={`linha linha-cat ${c.arquivada ? 'arquivada' : ''}`} onClick={() => setEditando({ id: c.id })}>
                    <span class="linha-cat-nome">
                      <IconeCategoria icone={c.icone} cor={c.cor} />
                      {c.nome}
                    </span>
                    <span class="valor-lateral">{c.arquivada ? 'Arquivada' : tipo === 'despesa' && c.permitidaNoVoucher ? 'Voucher' : ''}</span>
                  </button>
                ),
              )}
              {novaAberta ? (
                <Editor tipo={tipo} irmas={doTipo} aoFechar={() => setEditando(null)} />
              ) : (
                <button class="linha linha-acao" onClick={() => setEditando({ nova: tipo })}>
                  {tipo === 'despesa' ? 'Nova categoria de gasto' : 'Nova categoria de receita'}
                </button>
              )}
            </div>
          </section>
        )
      })}
      <p class="apoio nota-grupo">
        Categorias com lançamentos não são apagadas: elas ficam arquivadas, saem das opções de lançamento e o histórico continua
        com o nome certo.
      </p>
    </main>
  )
}

function Editor({
  tipo,
  categoria,
  irmas,
  aoFechar,
}: {
  tipo: Kind
  categoria?: Category
  irmas: Category[]
  aoFechar: () => void
}) {
  const [nome, setNome] = useState(categoria?.nome ?? '')
  const [cor, setCor] = useState<CorCategoria>((categoria?.cor as CorCategoria) ?? sugerirCor(irmas.map((c) => c.cor ?? '')))
  const [icone, setIcone] = useState<NomeIcone>((categoria?.icone as NomeIcone) ?? 'pontos')
  const [voucher, setVoucher] = useState(categoria?.permitidaNoVoucher ?? false)

  async function salvar(e: Event) {
    e.preventDefault()
    if (!nome.trim()) return
    await salvarCategoria({ nome, tipo, cor, icone, permitidaNoVoucher: tipo === 'despesa' && voucher }, categoria?.id)
    avisar('Categoria salva')
    aoFechar()
  }

  async function apagar() {
    if (!categoria || !confirm(`Apagar a categoria "${categoria.nome}"?`)) return
    const resultado = await apagarCategoria(categoria.id)
    avisar(resultado === 'apagada' ? 'Categoria apagada' : 'Categoria arquivada (já tinha lançamentos)')
    aoFechar()
  }

  async function restaurar() {
    if (!categoria) return
    await restaurarCategoria(categoria.id)
    avisar('Categoria restaurada')
    aoFechar()
  }

  return (
    <form class="editor-cat" onSubmit={salvar}>
      <label class="editor-campo">
        <span class="apoio">Nome</span>
        <input class="campo-texto" value={nome} maxLength={30} autoFocus onInput={(e) => setNome(e.currentTarget.value)} />
      </label>

      <div class="editor-campo">
        <span class="apoio">Cor</span>
        <div class="escolha-cores" role="radiogroup" aria-label="Cor">
          {CORES_CATEGORIA.map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={cor === c}
              aria-label={NOMES_COR[c]}
              class="cor-cat"
              style={{ background: `var(--cat-${c})` }}
              onClick={() => setCor(c)}
            />
          ))}
        </div>
      </div>

      <div class="editor-campo">
        <span class="apoio">Ícone</span>
        <div class="escolha-icones" role="radiogroup" aria-label="Ícone">
          {ICONES_CATEGORIA.map((i) => (
            <button
              type="button"
              key={i}
              role="radio"
              aria-checked={icone === i}
              aria-label={i}
              class="icone-opcao"
              style={icone === i ? { background: `var(--cat-${cor})`, color: '#fff' } : undefined}
              onClick={() => setIcone(i)}
            >
              <Icon nome={i} />
            </button>
          ))}
        </div>
      </div>

      {tipo === 'despesa' && (
        <label class="editor-interruptor">
          <span>Pode ser paga com voucher</span>
          <input type="checkbox" role="switch" checked={voucher} onChange={(e) => setVoucher(e.currentTarget.checked)} />
        </label>
      )}

      <button type="submit" class="btn-principal" disabled={!nome.trim()}>
        Salvar categoria
      </button>
      <div class="editor-rodape">
        <button type="button" class="btn-texto" onClick={aoFechar}>
          Cancelar
        </button>
        {categoria &&
          (categoria.arquivada ? (
            <button type="button" class="btn-texto linha-acao" onClick={restaurar}>
              Restaurar categoria
            </button>
          ) : (
            <button type="button" class="btn-perigo" onClick={apagar}>
              Apagar categoria
            </button>
          ))}
      </div>
    </form>
  )
}
