/**
 * Vite 設定檔
 * 
 * - 使用 React 外掛（支援 JSX 與 Fast Refresh）
 * - 使用 Tailwind CSS Vite 外掛
 * - 設定 @ 路徑別名指向 src/
 * - 開發模式下代理 /api 請求至後端（localhost:3001）
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // 路徑別名：@ → src/
    },
  },
  server: {
    proxy: {
      // 開發模式下，將 /api 開頭的請求代理至後端伺服器
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    }
  }
})
