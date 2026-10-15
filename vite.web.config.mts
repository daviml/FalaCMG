import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Versão web do app (mesmo código do renderer do Electron), servida em /app/ pelo site.
export default defineConfig({
  root: 'src/renderer',
  base: '/app/',
  plugins: [react()],
  build: {
    outDir: '../../web-dist/app',
    emptyOutDir: true
  }
})
