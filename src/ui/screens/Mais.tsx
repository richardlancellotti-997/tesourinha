import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'preact/hooks'
import { BackupInvalido, gerarBackup, lerBackup, nomeArquivoBackup, restaurarBackup } from '../../db/backup'
import { db, nowISO } from '../../db/db'
import { cartaoPrincipal, PERFIL_ID, salvarPerfil, VOUCHER_ID } from '../../db/repo'
import { formatValor } from '../../domain/money'
import { valorNaData } from '../../domain/recurrence'
import type { Theme } from '../../db/types'
import { diffDays, today } from '../../domain/dates'
import { href } from '../../router'
import { avisar } from '../aviso'
import { CoresDestaque } from '../CoresDestaque'
import { Icon } from '../Icon'

const TEMAS: { id: Theme; nome: string }[] = [
  { id: 'auto', nome: 'Automático' },
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
]

export function Mais() {
  const perfil = useLiveQuery(() => db.profile.get(PERFIL_ID), [])
  const totalCategorias = useLiveQuery(() => db.categories.filter((c) => !c.arquivada).count(), [], 0)
  const cartao = useLiveQuery(() => cartaoPrincipal(), [])
  const voucher = useLiveQuery(() => db.voucherConfig.get(VOUCHER_ID), [])
  const recs = useLiveQuery(() => db.recurrences.toArray(), [], [])
  const previstas = useLiveQuery(() => db.incomeExpected.where('status').equals('prevista').toArray(), [], [])
  const totalFixo = recs.filter((r) => r.ativa && r.tipo === 'despesa').reduce((s, r) => s + valorNaData(r, today()), 0)
  const totalAReceber = previstas.reduce((s, p) => s + p.valor, 0)
  const [nome, setNome] = useState('')
  const arquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (perfil) setNome(perfil.nome)
  }, [perfil?.nome])

  if (!perfil) return null

  function salvarNome() {
    const limpo = nome.trim()
    if (limpo && limpo !== perfil!.nome) salvarPerfil({ nome: limpo })
    else setNome(perfil!.nome)
  }

  async function exportar() {
    const texto = JSON.stringify(await gerarBackup(), null, 2)
    const nomeArquivo = nomeArquivoBackup()
    const file = new File([texto], nomeArquivo, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        // No iPhone abre a folha de compartilhamento: "Salvar em Arquivos" leva à pasta de backups.
        await navigator.share({ files: [file], title: nomeArquivo })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = nomeArquivo
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
      avisar('O backup não foi exportado. Tente de novo.')
      return
    }
    await salvarPerfil({ ultimoBackupEm: nowISO() })
    avisar('Backup exportado')
  }

  async function importar(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const escolhido = input.files?.[0]
    input.value = ''
    if (!escolhido) return
    try {
      const backup = lerBackup(await escolhido.text())
      const qtd = backup.dados.transactions?.length ?? 0
      const quando = new Date(backup.exportadoEm).toLocaleDateString('pt-BR')
      const ok = confirm(
        `Restaurar o backup de ${quando}, com ${qtd} lançamentos? Ele substitui todos os dados deste aparelho.`,
      )
      if (!ok) return
      await restaurarBackup(backup)
      avisar('Backup restaurado')
    } catch (err) {
      alert(err instanceof BackupInvalido ? err.message : 'Não foi possível ler o arquivo. Confira se é um backup do Tesourinha.')
    }
  }

  const diasSemBackup = perfil.ultimoBackupEm ? diffDays(perfil.ultimoBackupEm.slice(0, 10), today()) : null

  return (
    <main class="tela">
      <h1 class="titulo-grande">Mais</h1>

      <div class="grupo">
        <a class="linha" href={href('/assinaturas')}>
          <span>Assinaturas e contas fixas</span>
          <span class="valor-lateral">
            {totalFixo ? formatValor(totalFixo) : ''} <Icon nome="avancar" size={18} />
          </span>
        </a>
        <a class="linha" href={href('/receitas')}>
          <span>Receitas</span>
          <span class="valor-lateral">
            {totalAReceber ? `${formatValor(totalAReceber)} a receber` : ''} <Icon nome="avancar" size={18} />
          </span>
        </a>
        <a class="linha" href={href('/categorias')}>
          <span>Categorias</span>
          <span class="valor-lateral">
            {totalCategorias} <Icon nome="avancar" size={18} />
          </span>
        </a>
        <a class="linha" href={href('/cartao/ajustes')}>
          <span>Cartão de crédito</span>
          <span class="valor-lateral">
            {cartao ? `${cartao.nome}, fecha dia ${cartao.diaFechamento}` : 'Cadastrar'} <Icon nome="avancar" size={18} />
          </span>
        </a>
        <a class="linha" href={href('/voucher/ajustes')}>
          <span>Voucher</span>
          <span class="valor-lateral">
            {voucher ? `${formatValor(voucher.valorMensal)}, dia ${voucher.diaCredito}` : 'Configurar'}{' '}
            <Icon nome="avancar" size={18} />
          </span>
        </a>
      </div>

      <section>
        <h2 class="rotulo-grupo">Perfil</h2>
        <div class="grupo">
          <label class="linha">
            <span>Nome</span>
            <input
              class="campo-linha"
              value={nome}
              maxLength={40}
              autoComplete="given-name"
              enterKeyHint="done"
              onInput={(e) => setNome(e.currentTarget.value)}
              onBlur={salvarNome}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
          <div class="linha linha-coluna">
            <span>Cor de destaque</span>
            <CoresDestaque valor={perfil.corDestaque} aoEscolher={(hex) => salvarPerfil({ corDestaque: hex })} />
          </div>
          <div class="linha linha-coluna">
            <span>Tema</span>
            <div class="alternador" role="radiogroup" aria-label="Tema">
              {TEMAS.map((t) => (
                <button key={t.id} role="radio" aria-checked={perfil.tema === t.id} onClick={() => salvarPerfil({ tema: t.id })}>
                  {t.nome}
                </button>
              ))}
            </div>
            <span class="apoio">No automático, o app segue o modo claro ou escuro do iPhone.</span>
          </div>
        </div>
      </section>

      <section>
        <h2 class="rotulo-grupo">Backup</h2>
        <div class="grupo">
          <button class="linha linha-acao" onClick={exportar}>
            Exportar backup
          </button>
          <button class="linha linha-acao" onClick={() => arquivo.current?.click()}>
            Importar backup
          </button>
        </div>
        <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={importar} />
        <p class="apoio nota-grupo">
          {diasSemBackup === null
            ? 'Você ainda não exportou nenhum backup. '
            : diasSemBackup === 0
              ? 'Último backup hoje. '
              : `Último backup há ${diasSemBackup} ${diasSemBackup === 1 ? 'dia' : 'dias'}. `}
          Seus dados ficam só neste aparelho; o arquivo de backup é a cópia de segurança.
        </p>
      </section>

    </main>
  )
}
