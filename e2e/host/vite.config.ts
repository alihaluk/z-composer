import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const lib = (file: string) => fileURLToPath(new URL(`../../dist-lib/${file}`, import.meta.url));

// Serves the host page with the built package under its published name.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^z-composer\/style\.css$/, replacement: lib('style.css') },
      { find: /^z-composer$/, replacement: lib('z-composer.js') },
    ],
  },
  // The package's stylesheet is already built; the host adds no PostCSS processing.
  css: { postcss: {} },
  server: { port: 4174, strictPort: true },
});
