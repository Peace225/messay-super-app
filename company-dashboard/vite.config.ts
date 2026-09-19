import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- 1. Ajout de l'import

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- 2. Ajout du plugin ici
  ],
  server: { port: 5173 },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      '@supabase/supabase-js',
      'socket.io-client'
    ]
  }
})