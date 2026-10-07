/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// O app é publicado em https://<usuario>.github.io/tesourinha/
const base = '/tesourinha/'

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: {
        config: true,
        // A cor da barra de status fica em metas fixas no index.html (claro/escuro).
        // Trocá-la em tempo de execução desloca a barra de navegação no iOS instalado.
        injectThemeColor: false,
      },
      manifest: {
        name: 'Tesourinha',
        short_name: 'Tesourinha',
        description: 'Seus gastos, assinaturas e receitas do dia a dia.',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        // Papel (fundo claro do app); no escuro a cor é trocada em tempo de execução
        background_color: '#F6F7F4',
        theme_color: '#F6F7F4',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
