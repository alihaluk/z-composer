import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/z-composer/',
  resolve: {
    // The BWIPP encoders without the bwip-js entry point, which bundles every symbology.
    alias: { '@bwipp': fileURLToPath(new URL('./node_modules/bwip-js/dist/bwipp.mjs', import.meta.url)) },
  },
})
