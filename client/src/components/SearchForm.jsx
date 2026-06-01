/**
 * ===================================================
 * 搜尋表單元件（SearchForm）
 * ===================================================
 * 
 * 功能：
 *   - 提供關鍵字輸入框（含搜尋語法提示）
 *   - 提供日期區間選擇器（預設最近 7 天）
 *   - 透過 SSE (EventSource) 即時接收搜尋進度
 *   - 搜尋完成後將結果回傳給父元件 (onResults)
 *   - 顯示搜尋歷程日誌（LogViewer）
 */

import React, { useState } from 'react';
import { Search, HelpCircle, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { format, subDays } from 'date-fns'; // 日期工具函式
import LogViewer from './LogViewer';          // 日誌顯示元件

const SearchForm = ({ onResults }) => {
    // ========== 狀態定義 ==========
    const [keyword, setKeyword] = useState('');                                      // 搜尋關鍵字
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd')); // 起始日期（預設 7 天前）
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));         // 結束日期（預設今天）
    const [loading, setLoading] = useState(false);   // 是否正在搜尋中
    const [error, setError] = useState(null);        // 錯誤訊息
    const [logs, setLogs] = useState([]);            // 搜尋進度日誌陣列
    const [showTooltip, setShowTooltip] = useState(false); // 語法提示框顯示狀態
    const [showLogs, setShowLogs] = useState(false);       // 日誌面板展開狀態

    /**
     * 日期格式轉換：yyyy-MM-dd → yyyy/MM/dd
     * API 端需要斜線格式
     */
    const toApiDate = (d) => d.replace(/-/g, '/');

    /**
     * 處理搜尋提交
     * 使用 SSE (Server-Sent Events) 方式連接後端，即時接收搜尋進度
     */
    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setLogs([]);
        setShowLogs(true);
        onResults([]); // 清空先前的結果

        // 組裝查詢參數並建立 SSE 連線
        const queryParams = new URLSearchParams({
            keyword,
            startDate: toApiDate(startDate),
            endDate: toApiDate(endDate),
        }).toString();
        const eventSource = new EventSource(`/api/search-stream?${queryParams}`);

        // SSE 連線建立
        eventSource.onopen = () => {
            setLogs(prev => [...prev, '⚡ 連線建立，搜尋啟動中...']);
        };

        // SSE 接收訊息
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'log') {
                    // 進度日誌
                    setLogs(prev => [...prev, data.message]);
                } else if (data.type === 'complete') {
                    // 搜尋完成：回傳結果並關閉連線
                    onResults(data.results);
                    setLogs(prev => [...prev, `✅ 搜尋完成！共 ${data.results.length} 筆資料`]);
                    setLoading(false);
                    eventSource.close();
                } else if (data.type === 'error') {
                    // 搜尋錯誤
                    setError(data.message);
                    setLogs(prev => [...prev, `❌ 錯誤: ${data.message}`]);
                    setLoading(false);
                    eventSource.close();
                }
            } catch (err) {
                console.error('Parse error', err);
            }
        };

        // SSE 連線錯誤處理
        eventSource.onerror = () => {
            if (loading) {
                setError('串流連線中斷');
                setLoading(false);
                eventSource.close();
            }
        };
    };

    return (
        <div className="space-y-4">
            <div className="card">
                <form onSubmit={handleSearch} className="space-y-6">

                    {/* ========== 關鍵字輸入區 ========== */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <label htmlFor="keyword-input" className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                搜尋關鍵字
                            </label>
                            {/* 語法說明提示按鈕 */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowTooltip(!showTooltip)}
                                    className="hover:text-blue-400 transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <HelpCircle className="w-4 h-4" />
                                </button>
                                {/* 語法說明彈出框 */}
                                {showTooltip && (
                                    <div className="absolute left-0 top-full mt-2 w-80 p-4 rounded-xl text-sm z-50 shadow-2xl"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', color: 'var(--text-secondary)' }}>
                                        <p className="font-semibold text-blue-400 mb-2 text-sm">搜尋語法說明</p>
                                        <div className="space-y-2 font-mono text-sm">
                                            <p><span className="text-emerald-400 font-bold">OR</span> → 聯集：<span style={{ color: 'var(--text-muted)' }}>AI OR 資安</span></p>
                                            <p><span className="text-amber-400 font-bold">AND</span> → 交集：<span style={{ color: 'var(--text-muted)' }}>AI AND 系統</span></p>
                                            <p><span className="text-red-400 font-bold">NOT</span> → 排除：<span style={{ color: 'var(--text-muted)' }}>AI NOT 醫療</span></p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <input
                            id="keyword-input"
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="輸入關鍵字，例如：AI AND 系統 OR 資安"
                            className="input-field w-full"
                        />
                    </div>

                    {/* ========== 日期範圍 + 搜尋按鈕 ========== */}
                    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                公告日期範圍
                            </label>
                            <div className="flex items-center gap-3 flex-nowrap w-full">
                                {/* 起始日期 */}
                                <input
                                    id="start-date-input"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="input-field text-center font-mono flex-1 min-w-0"
                                    style={{ width: 'auto' }}
                                />
                                <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                {/* 結束日期 */}
                                <input
                                    id="end-date-input"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="input-field text-center font-mono flex-1 min-w-0"
                                    style={{ width: 'auto' }}
                                />
                            </div>
                        </div>

                        {/* 搜尋按鈕 */}
                        <button
                            id="search-button"
                            type="submit"
                            disabled={loading || !keyword.trim()}
                            className="btn-primary sm:min-w-[160px]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    搜尋中...
                                </>
                            ) : (
                                <>
                                    <Search className="w-5 h-5" />
                                    開始搜尋
                                </>
                            )}
                        </button>
                    </div>

                    {/* ========== 錯誤提示 ========== */}
                    {error && (
                        <div className="flex items-center gap-3 text-base rounded-xl p-4"
                            style={{
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                color: '#f87171',
                            }}>
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                </form>
            </div>

            {/* ========== 搜尋歷程日誌 ========== */}
            {logs.length > 0 && (
                <LogViewer logs={logs} showLogs={showLogs} onToggle={() => setShowLogs(!showLogs)} />
            )}
        </div>
    );
};

export default SearchForm;
