import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
  // Default output dir is dist/assets/ — the CLI server serves the bundle's own
  // evidence images from /assets/*, so the built UI's own JS/CSS must live elsewhere
  // or a browser's plain (unprefixed) request for one would collide with the other.
  build: {
    assetsDir: '_app',
  },
  plugins: [
    vue(),
    ui({
      ui: {
        colors: {
          primary: 'emerald',
          neutral: 'slate',
        },
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
