/**
 * 前端應用程式入口點
 * 使用 React 19 StrictMode 包裝，掛載至 #root 元素
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'   // 全域樣式（CSS 變數、元件樣式）
import App from './App.jsx'  // 主應用程式元件

// 將 React 應用程式掛載至 HTML 中的 #root 元素
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
