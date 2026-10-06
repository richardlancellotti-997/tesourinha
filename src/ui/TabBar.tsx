import { href } from '../router'
import { Icon } from './Icon'

const ABAS = [
  { chave: 'inicio', caminho: '/', rotulo: 'Início', icone: 'inicio' },
  { chave: 'cartao', caminho: '/cartao', rotulo: 'Cartão', icone: 'cartao' },
  null, // botão de lançar no meio
  { chave: 'voucher', caminho: '/voucher', rotulo: 'Voucher', icone: 'voucher' },
  { chave: 'mais', caminho: '/mais', rotulo: 'Mais', icone: 'mais' },
]

export function TabBar({ ativa }: { ativa: string }) {
  return (
    <nav class="tabbar" aria-label="Navegação principal">
      <div class="tabbar-itens">
        {ABAS.map((aba) =>
          aba ? (
            <a key={aba.chave} class="aba" href={href(aba.caminho)} aria-current={aba.chave === ativa ? 'page' : undefined}>
              <Icon nome={aba.icone} />
              {aba.rotulo}
            </a>
          ) : (
            <a key="lancar" class="aba-lancar" href={href('/lancar')} aria-label="Lançar gasto ou receita">
              <Icon nome="somar" />
            </a>
          ),
        )}
      </div>
    </nav>
  )
}
