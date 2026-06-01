/**
 * ===================================================
 * 政府標案查詢系統 — 前端主應用程式
 * ===================================================
 * 
 * 功能：
 *   - 頂部導覽列：包含 Logo 與分頁切換（搜尋 / 管理 / 排程）
 *   - 依照 activeTab 狀態切換顯示對應的元件
 *   - 使用 lucide-react 圖示庫
 */

import React, { useState } from 'react';
import SearchForm from './components/SearchForm';         // 搜尋表單元件
import ResultsTable from './components/ResultsTable';     // 搜尋結果卡片元件
import ScheduleManager from './components/ScheduleManager'; // 排程管理元件
import HistoryManager from './components/HistoryManager';   // 搜尋記錄管理元件
import { Search, Calendar, Database, FolderOpen } from 'lucide-react'; // 圖示

function App() {
  // ========== 狀態管理 ==========
  const [activeTab, setActiveTab] = useState('search'); // 當前分頁：'search' | 'history' | 'schedule'
  const [results, setResults] = useState([]);           // 搜尋結果資料

  // 分頁設定：key（識別碼）、label（顯示文字）、icon（圖示元件）
  const tabs = [
    { key: 'search', label: '搜尋', icon: Search },
    { key: 'history', label: '管理', icon: FolderOpen },
    { key: 'schedule', label: '排程', icon: Calendar },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* ========== 頂部導覽列 ========== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl" style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(11, 17, 32, 0.9)', // 半透明暗色背景
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">

            {/* Logo 區塊 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-none">
                  標案查詢
                </h1>
                <p className="text-xs font-mono tracking-wider hidden sm:block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  TENDER.OS v3.0
                </p>
              </div>
            </div>

            {/* 分頁切換導覽 */}
            <nav className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--bg-card)' }}>
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm sm:text-[15px] font-medium transition-all duration-200 ${activeTab === tab.key
                    ? 'text-blue-400'
                    : 'text-slate-500 hover:text-slate-300'
                    }`}
                  style={activeTab === tab.key ? {
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.2)',
                  } : { border: '1px solid transparent' }}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>

          </div>
        </div>
      </header>

      {/* ========== 頁面主內容區 ========== */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 w-full">
        {/* 搜尋分頁：顯示搜尋表單 + 結果卡片 */}
        {activeTab === 'search' && (
          <div className="space-y-6 animate-fade-in">
            <SearchForm onResults={setResults} />
            <ResultsTable results={results} />
          </div>
        )}
        {/* 管理分頁：顯示搜尋記錄管理 */}
        {activeTab === 'history' && (
          <div className="animate-fade-in">
            <HistoryManager />
          </div>
        )}
        {/* 排程分頁：顯示排程管理 */}
        {activeTab === 'schedule' && (
          <div className="animate-fade-in">
            <ScheduleManager />
          </div>
        )}
      </main>

      {/* ========== 頁尾版權聲明 ========== */}
      <footer className="py-6 text-center border-t border-[var(--border)] relative z-10" style={{ background: 'var(--bg-card)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          &copy; {new Date().getFullYear()} TENDER.OS. Y.S Hao All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default App;
