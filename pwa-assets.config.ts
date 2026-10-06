import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones (PWA + apple-touch-icon) a partir de um único SVG.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  // Sem margem extra: o SVG já tem fundo e respeita a área segura.
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#2442C9' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#2442C9' } },
  },
  images: ['public/icon.svg'],
})
