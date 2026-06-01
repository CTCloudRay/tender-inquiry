/**
 * ===================================================
 * 即時日誌元件（LogViewer）
 * ===================================================
 * 
 * 功能：
 *   - 以終端機風格顯示搜尋爬蟲的即時進度日誌
 *   - 支援展開/收合開關
 *   - 自動捲動至最新日誌
 *   - 每行顯示序號與日誌內容
 * 
 * Props:
 *   @param {Array<string>} logs     - 日誌字串陣列
 *   @param {boolean}       showLogs - 是否展開顯示日誌
 *   @param {Function}      onToggle - 切換展開/收合的回呼
 */

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react'; // 終端機圖示

const LogViewer = ({ logs, showLogs, onToggle }) => {
    const bottomRef = useRef(null); // 用於自動捲動至底部的參考點

    // 當日誌更新且面板展開時，自動捲動至最新訊息
    useEffect(() => {
        if (showLogs) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, showLogs]);

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* ========== 標題列（可點擊切換展開/收合） ========== */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:opacity-80"
                style={{ borderBottom: showLogs ? '1px solid var(--border)' : 'none' }}
            >
                <div className="flex items-center gap-3">
                    <Terminal className="h-4.5 w-4.5 text-blue-400" />
                    <span className="text-sm font-semibold font-mono tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                        搜尋歷程
                    </span>
                    <span className="badge badge-blue">{logs.length}</span>
                </div>
                {/* 開關樣式（toggle switch） */}
                <div
                    className={`toggle-switch ${showLogs ? 'active' : ''}`}
                    role="switch"
                    aria-checked={showLogs}
                />
            </button>

            {/* ========== 日誌內容區（固定高度，可捲動） ========== */}
            {showLogs && (
                <div className="px-5 py-4 overflow-y-auto space-y-1" style={{ maxHeight: '240px' }}>
                    {logs.map((log, index) => (
                        <div key={index} className="flex gap-3 py-0.5 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                            {/* 行號（三位數補零） */}
                            <span className="flex-shrink-0 select-none tabular-nums" style={{ color: 'var(--text-muted)', minWidth: '2rem' }}>
                                {String(index + 1).padStart(3, '0')}
                            </span>
                            {/* 日誌文字 */}
                            <span className="break-all">{log}</span>
                        </div>
                    ))}
                    {/* 自動捲動錨點 */}
                    <div ref={bottomRef} />
                </div>
            )}
        </div>
    );
};

export default LogViewer;
