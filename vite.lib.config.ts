import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Builds the embeddable package (dist-lib); `npm run build` still builds the standalone app.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // The BWIPP encoders without the bwip-js entry point, which bundles every symbology.
    alias: { '@bwipp': fileURLToPath(new URL('./node_modules/bwip-js/dist/bwipp.mjs', import.meta.url)) },
  },
  css: {
    postcss: { plugins: [tailwindcss({ config: './tailwind.lib.config.js' }), autoprefixer()] },
  },
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'z-composer', cssFileName: 'style' },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'] },
  },
})
