import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    sourcemap: true,
    target: 'es2022',
    rolldownOptions: {
      input: {
        game: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        authCallback: resolve(import.meta.dirname, 'auth-callback.html'),
      },
    },
  },
  server: {
    strictPort: true,
  },
})
