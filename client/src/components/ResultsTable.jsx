/**
 * ===================================================
 * 搜尋結果卡片元件（ResultsTable）
 * ===================================================
 * * 功能：
 * - 以三欄卡片 Grid 顯示搜尋結果
 * - 支援文字篩選（即時過濾）
 * - 分頁功能（每頁 12 筆）
 * - CSV 匯出下載（前端產生，含 BOM 支援中文）
 * - 每張卡片顯示：機關、標案案號/名稱、招標方式、金額、日期、詳細連結
 */

import React, { useState } from 'react';
import { Download, ExternalLink, ChevronLeft, ChevronRight, Search, DollarSign, Building2, Clock } from 'lucide-react';

const ITEMS_PER_PAGE = 12; // 每頁顯示筆數

const ResultsTable = ({ results }) => {
    const [currentPage, setCurrentPage] = useState(1);   // 目前頁碼
    const [filterText, setFilterText] = useState('');      // 篩選文字

    // ========== 空狀態 ==========
    if (!results || results.length === 0) {
        return (
            <div className="card text-center py-16" style={{ color: 'var(--text-muted)', borderStyle: 'dashed' }}>
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-base">尚無資料，請先執行搜尋</p>
            </div>
        );
    }

    // ========== 文字篩選 ==========
    // 篩選範圍：機關名稱、標案案號、標案名稱
    const filtered = filterText
        ? results.filter(r =>
            `${r.agencyName} ${r.tenderId} ${r.tenderName}`.toLowerCase().includes(filterText.toLowerCase())
        )
        : results;

    // ========== 分頁計算 ==========
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const safeCurrentPage = Math.min(currentPage, totalPages || 1);
    const startIdx = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    /**
     * CSV 下載處理
     * 在前端組裝 CSV 字串，加上 BOM（\ufeff）確保 Excel 正確顯示中文
     * 🚀 嚴格對齊最新 13 欄獨立欄位規格
     */
    const handleDownload = () => {
        // 1. 嚴格對齊管理部要求的 13 個獨立中文表頭順序
        const headers = [
            '管理部查詢時間', 
            '地區', 
            '機關窗口', 
            '機關名稱', 
            '標案案號/標案名稱', 
            '標案名稱', 
            '預算金額', 
            '本採購是否屬中央政府計畫型案件',  
            '招標方式', 
            '公告日期', 
            '截止日期', 
            '詳細連結'
        ];

        // 2. 補上點擊下載當下的即時時間打底（防範異步未就緒狀態）
        const currentQueryTime = new Date().toLocaleString('zh-TW', { 
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false 
        });

        // 3. 嚴格依照對齊後的順序，手動進行數據映射與清洗
        const csvContent = [
            headers.join(','),
            ...results.map(row => {
                const values = [
                    row.queryTime || currentQueryTime,                  // 1. 管理部查詢時間
                    row.region || '其他',                              // 2. 地區 (北部/中部/南部)
                    row.contact || '未提供',                            // 3. 機關窗口 (聯絡人與電話組合)
                    row.agencyName || '',                              // 4. 機關名稱
                    row.tenderId || '',                                   // 5. 標案案號/標案名稱 (合併欄位)
                    row.tenderName || '',                              // 6. 標案名稱 (單獨欄位)
                    row.budget || '',                                  // 7. 預算金額
                    row.isCentralPlan,                                 // 8. 本採購是否屬中央政府計畫型案件
                    row.method || '',                                  // 9. 招標方式
                    row.publishDate || '',                             // 10. 公告日期
                    row.deadline || '',                                // 11. 截止日期
                    row.detailLink || ''                               // 12. 詳細連結
                ];

                // 將欄位值轉為字串並跳脫雙引號，防範格式跑掉
                return values.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
            })
        ].join('\n');

        // 4. 加上 BOM 確保 Windows Excel 開啟時中文正常不亂碼
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `標案查詢_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4">
            {/* ========== 工具列：結果數量 + 篩選框 + CSV 下載 ========== */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">搜尋結果</h2>
                    <span className="badge badge-blue">{filtered.length} 筆</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* 即時篩選輸入框 */}
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            value={filterText}
                            onChange={(e) => { setFilterText(e.target.value); setCurrentPage(1); }}
                            placeholder="篩選結果..."
                            className="input-field pl-10 sm:w-56"
                        />
                    </div>
                    {/* CSV 下載按鈕 */}
                    <button
                        id="export-csv-button"
                        onClick={handleDownload}
                        className="btn-success flex-shrink-0"
                    >
                        <Download className="w-4 h-4" />
                        下載 CSV
                    </button>
                </div>
            </div>

            {/* ========== 結果卡片 Grid ========== */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pageItems.map((item, index) => (
                    <div key={index} className="card group hover:border-blue-500/20 transition-all duration-200 flex flex-col">
                        {/* 機關名稱 */}
                        <div className="flex items-start gap-2 mb-3">
                            <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                                {item.agencyName}
                            </span>
                        </div>

                        {/* 標案案號 + 名稱 */}
                        <div className="mb-3 flex-1">
                            <div className="font-mono text-xs text-blue-400 font-medium mb-1">{item.tenderId}</div>
                            <div className="text-base font-medium line-clamp-2 leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                {item.tenderName}
                            </div>
                        </div>

                        {/* 招標方式 + 預算金額 */}
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                            {item.method && <span className="tag">{item.method}</span>}
                            {item.budget && (
                                <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold" style={{ color: '#4ade80' }}>
                                    <DollarSign className="w-3.5 h-3.5" />
                                    {item.budget}
                                </span>
                            )}
                        </div>

                        {/* 日期 + 查看連結 */}
                        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-4 text-sm font-mono">
                                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                    <Clock className="w-3.5 h-3.5" />
                                    {item.publishDate || '—'}
                                </div>
                                {item.deadline && (
                                    <span style={{ color: '#f59e0b' }}>
                                        截止 {item.deadline}
                                    </span>
                                )}
                            </div>
                            {/* 外部連結：前往政府電子採購網 */}
                            {item.detailLink && (
                                <a
                                    href={item.detailLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                    style={{
                                        border: '1px solid rgba(59,130,246,0.15)',
                                    }}
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    查看
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ========== 分頁導覽 ========== */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    {/* 頁碼資訊 */}
                    <div className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                        第 {safeCurrentPage}/{totalPages} 頁
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* 上一頁按鈕 */}
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={safeCurrentPage === 1}
                            className="p-2 rounded-lg transition-all disabled:opacity-30"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        {/* 頁碼按鈕（最多顯示 5 個） */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let page;
                            if (totalPages <= 5) page = i + 1;
                            else if (safeCurrentPage <= 3) page = i + 1;
                            else if (safeCurrentPage >= totalPages - 2) page = totalPages - 4 + i;
                            else page = safeCurrentPage - 2 + i;
                            return (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className="w-9 h-9 rounded-lg text-sm font-medium transition-all"
                                    style={{
                                        background: page === safeCurrentPage ? 'rgba(59,130,246,0.12)' : 'transparent',
                                        border: page === safeCurrentPage ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                                        color: page === safeCurrentPage ? '#60a5fa' : 'var(--text-muted)',
                                    }}
                                >
                                    {page}
                                </button>
                            );
                        })}
                        {/* 下一頁按鈕 */}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={safeCurrentPage === totalPages}
                            className="p-2 rounded-lg transition-all disabled:opacity-30"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultsTable;