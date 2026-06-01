/*
 ===================================================
 搜尋記錄管理元件（HistoryManager）
 ===================================================
 功能：
 1. 列出所有搜尋歷史（含即時搜尋 + 排程搜尋）
 2. 展開查看單筆記錄的完整結果（前 20 筆預覽）
 3. 單筆下載 CSV
 4. 單筆刪除 / 清除全部
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FolderOpen, Trash2, Eye, Download, Clock, Search,
    ChevronDown, ChevronUp, X, AlertCircle, Loader2, Calendar
} from 'lucide-react';

const HistoryManager = () => {
    // ========== 狀態定義 ==========
    const [history, setHistory] = useState([]);       // 歷史摘要清單
    const [loading, setLoading] = useState(true);     // 載入中狀態
    const [viewingEntry, setViewingEntry] = useState(null);  // 目前展開查看中的記錄
    const [viewLoading, setViewLoading] = useState(false);   // 單筆詳細載入中

    // 元件載入時自動取得歷史記錄
    useEffect(() => { fetchHistory(); }, []);

    /**
     * 取得搜尋歷史摘要清單
     */
    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/history');
            setHistory(response.data);
        } catch (error) {
            console.error('Failed to fetch history', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * 展開或收合單筆歷史詳細資料
     */
    const handleView = async (id) => {
        if (viewingEntry?.id === id) {
            setViewingEntry(null);
            return;
        }
        setViewLoading(true);
        try {
            const response = await axios.get(`/api/history/${id}`);
            setViewingEntry(response.data);
        } catch (error) {
            console.error('Failed to view history entry', error);
        } finally {
            setViewLoading(false);
        }
    };

    /**
     * 刪除單筆歷史記錄
     */
    const handleDelete = async (id) => {
        if (!window.confirm('確定刪除此搜尋記錄？')) return;
        try {
            await axios.delete(`/api/history/${id}`);
            if (viewingEntry?.id === id) setViewingEntry(null); 
            fetchHistory(); 
        } catch (error) {
            console.error('Failed to delete history entry', error);
        }
    };

    /**
     * 清除所有歷史記錄
     */
    const handleClearAll = async () => {
        if (!window.confirm('確定清除所有搜尋記錄？此操作無法復原。')) return;
        try {
            await axios.delete('/api/history');
            setViewingEntry(null);
            fetchHistory();
        } catch (error) {
            console.error('Failed to clear history', error);
        }
    };

    /**
     * 下載單筆歷史記錄為 CSV
     */
    const handleDownloadEntry = (entry) => {
        if (!entry?.results?.length) return;
        
        // 1. 嚴格對齊欄位順序
        const headers = [
            '管理部查詢時間', '地區', '機關窗口', '機關名稱', '標案案號', 
            '標案名稱', '預算金額', '本採購是否屬中央政府計畫型案件', 
            '招標方式', '公告日期', '截止日期', '詳細連結'
        ];

        const defaultQueryTime = entry.createdAt 
            ? formatDate(entry.createdAt) 
            : new Date().toLocaleString('zh-TW', { hour12: false });

        const csvContent = [
            headers.join(','),
            ...entry.results.map(row => {
                const values = [
                    row.queryTime || defaultQueryTime,                 // 1. 管理部查詢時間
                    row.region || '其他',                              // 2. 地區 (北部/中部/南部)
                    row.contact || '未提供',                            // 3. 機關窗口 (聯絡人與電話組合)
                    row.agencyName || '',                              // 4. 機關名稱
                    row.tenderId || '',                                // 5. 標案案號/標案名稱 (合併欄位)
                    row.tenderName || '',                              // 6. 標案名稱 (單獨欄位)
                    row.budget || '',                                  // 7. 預算金額
                    row.isCentralPlan,                                 // 8. 本採購是否屬中央政府計畫型案件
                    row.method || '',                                  // 9. 招標方式
                    row.publishDate || '',                             // 10. 公告日期
                    row.deadline || '',                                // 11. 截止日期
                    row.detailLink || ''                               // 12. 詳細連結
                    
                ];
                return values.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
            })
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${entry.keyword}_${entry.createdAt.slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleDateString('zh-TW', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <FolderOpen className="w-6 h-6 text-blue-400" />
                    搜尋記錄管理
                </h2>
                {history.length > 0 && (
                    <button onClick={handleClearAll} className="btn-danger">
                        <Trash2 className="w-4 h-4" /> 清除全部
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-16">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-400 mb-3" />
                    <p className="text-base" style={{ color: 'var(--text-muted)' }}>載入搜尋記錄...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="card text-center py-16" style={{ color: 'var(--text-muted)', borderStyle: 'dashed' }}>
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base">尚無搜尋記錄</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map((entry) => (
                        <div key={entry.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <span className="text-base font-semibold text-white truncate">{entry.keyword}</span>
                                        <span className={`badge ${entry.type === 'scheduled' ? 'badge-green' : 'badge-blue'}`}>{entry.type === 'scheduled' ? '排程' : '即時'}</span>
                                        <span className="badge badge-blue">{entry.resultCount} 筆</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatDate(entry.createdAt)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => handleView(entry.id)} className="btn-ghost">
                                        {viewingEntry?.id === entry.id ? <><ChevronUp className="w-4 h-4" /> 收合</> : <><Eye className="w-4 h-4" /> 查看</>}
                                    </button>
                                    <button onClick={() => handleDelete(entry.id)} className="btn-danger">
                                        <Trash2 className="w-4 h-4" /> 刪除
                                    </button>
                                </div>
                            </div>

                            {viewingEntry?.id === entry.id && (
                                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                                    {viewLoading ? (
                                        <div className="text-center py-8"><Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-400" /></div>
                                    ) : viewingEntry?.results?.length > 0 ? (
                                        <div className="p-5 space-y-4">
                                            <div className="flex justify-end">
                                                <button onClick={() => handleDownloadEntry(viewingEntry)} className="btn-success"><Download className="w-4 h-4" /> 下載 CSV</button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {viewingEntry.results.slice(0, 20).map((item, idx) => (
                                                    <div key={idx} className="card p-3 flex flex-col justify-between">
                                                        <div className="text-xs text-gray-400 truncate mb-1">{item.agencyName}</div>
                                                        <div className="font-mono text-xs text-blue-400 mb-1">{item.tenderId}</div>
                                                        <div className="text-sm font-medium text-white line-clamp-2 mb-2">{item.tenderName}</div>
                                                        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                                                            <div className="flex gap-2">
                                                                {item.method && <span className="tag text-[10px]">{item.method}</span>}
                                                                {item.budget && <span className="font-mono text-xs text-green-400">${item.budget}</span>}
                                                            </div>
                                                            {item.detailLink && <a href={item.detailLink} target="_blank" className="text-blue-400 text-xs">查看</a>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-sm text-gray-500">無結果</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HistoryManager;