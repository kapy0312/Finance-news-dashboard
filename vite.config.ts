import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ghPages } from 'vite-plugin-gh-pages'   // ✅ 用 named import

// https://vite.dev/config/
export default defineConfig({
  base: '/Finance-news-dashboard/',   // ✅ 建議用「repo 名稱」，之後網址就是 /Finance-news-dashboard/
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    ghPages(),   // ✅ 只要在這裡加上去就好
  ],
})