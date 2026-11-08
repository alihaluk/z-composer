import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// GitHub Pages cannot send headers, so the policy travels in the page. Everything the app needs is
// its own files and embedded images; an imported template can make no request.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
  "connect-src 'self'", "base-uri 'none'", "form-action 'none'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' }],
  }],
  base: '/z-composer/',
  resolve: {
    // The BWIPP encoders without the bwip-js entry point, which bundles every symbology.
    alias: { '@bwipp': fileURLToPath(new URL('./node_modules/bwip-js/dist/bwipp.mjs', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change less often than the app, so they stay cached across releases. The
        // barcode encoders keep their own chunk, loaded with the first barcode.
        manualChunks: id => (id.includes('/node_modules/') && !id.includes('/bwip-js/') ? 'vendor' : undefined),
      },
    },
  },
})
