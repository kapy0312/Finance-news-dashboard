import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  // 🔴 非常重要：一定要對應 GitHub Pages 的專案路徑
  base: '/FinancialNews/',
})