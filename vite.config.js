import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento, as rotas do servidor vão para `npm run server` (porta 3001).
const backend = 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backend,
      '/conta': backend,
      '/painel': backend,
    },
  },
})
