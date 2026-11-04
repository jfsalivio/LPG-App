import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    watch: { ignored: ['**/.source/**', '**/.gradle-user-home/**', '**/android/**', '**/Backend/**', '**/ML/**'] },
    host: '::',
    port: 5173,
    strictPort: true,
  },
})
