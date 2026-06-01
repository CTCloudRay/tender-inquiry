/**
 * ===================================================
 * 排程管理元件（ScheduleManager）
 * ===================================================
 * 
 * 功能：
 *   - 新增排程：設定關鍵字、頻率（每日/每週）、執行時間、星期幾
 *   - 查看目前所有排程任務
 *   - 刪除排程任務
 *   - 顯示排程的搜尋日期範圍提示
 * 
 * API 端點：
 *   GET    /api/schedules     → 取得所有排程
 *   POST   /api/schedules     → 新增排程
 *   DELETE /api/schedules/:id → 刪除排程
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Calendar, Clock, Loader2 } from 'lucide-react';

// ========== 常數定義 ==========

/** 星期選項（配合 cron 的 0-6 格式，0=週日） */
const DAYS_OF_WEEK = [
    { value: 0, label: '週日' },
    { value: 1, label: '週一' },
    { value: 2, label: '週二' },
    { value: 3, label: '週三' },
    { value: 4, label: '週四' },
    { value: 5, label: '週五' },
    { value: 6, label: '週六' },
];

/** 小時選項：0 ~ 23 */
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ========== 工具函式 ==========

/**
 * 格式化時間顯示
 * @param {number} hour   - 小時 (0-23)
 * @param {number} minute - 分鐘 (0-59)
 * @returns {string} 例如 "09:00"
 */
const formatTime = (hour, minute) => {
    return `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`;
};

/**
 * 根據數值取得星期幾的中文標籤
 * @param {number} dow - 星期幾 (0-6)
 * @returns {string} 例如 "週三"
 */
const getDayLabel = (dow) => {
    const day = DAYS_OF_WEEK.find(d => d.value === dow);
    return day ? day.label : '';
};

// ========== 元件主體 ==========

const ScheduleManager = () => {
    // ========== 狀態定義 ==========
    const [jobs, setJobs] = useState([]);            // 目前排程清單
    const [loading, setLoading] = useState(true);    // 載入中狀態
    const [newKeyword, setNewKeyword] = useState('');  // 新增排程的關鍵字
    const [frequency, setFrequency] = useState('daily'); // 頻率：'daily' 或 'weekly'
    const [hour, setHour] = useState(9);             // 執行時（預設 9 時）
    const [minute, setMinute] = useState(0);         // 執行分（預設 0 分）
    const [dayOfWeek, setDayOfWeek] = useState(1);   // 星期幾（預設週一，僅 weekly 使用）
    const [adding, setAdding] = useState(false);     // 新增中狀態

    // 元件載入時取得排程列表
    useEffect(() => { fetchJobs(); }, []);

    /**
     * 取得所有排程任務
     */
    const fetchJobs = async () => {
        try {
            const response = await axios.get('/api/schedules');
            setJobs(response.data);
        } catch (error) {
            console.error('Failed to fetch jobs', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * 新增排程任務
     */
    const handleAddJob = async (e) => {
        e.preventDefault();
        if (!newKeyword.trim()) return;
        setAdding(true);
        try {
            await axios.post('/api/schedules', {
                keyword: newKeyword,
                frequency,
                hour,
                minute,
                dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined, // 僅每週才傳 dayOfWeek
            });
            setNewKeyword(''); // 清空輸入框
            fetchJobs();       // 重新載入列表
        } catch (error) {
            console.error('Failed to add job', error);
        } finally {
            setAdding(false);
        }
    };

    /**
     * 刪除排程任務
     * @param {string} id - 排程 ID
     */
    const handleDeleteJob = async (id) => {
        if (!window.confirm('確定刪除此排程？')) return;
        try {
            await axios.delete(`/api/schedules/${id}`);
            fetchJobs();
        } catch (error) {
            console.error('Failed to delete job', error);
        }
    };

    /**
     * 產生排程描述文字
     * @param {Object} job - 排程物件
     * @returns {string} 例如 "每天 09:00 執行（搜尋當日+前一日公告）"
     */
    const getScheduleDescription = (job) => {
        const time = formatTime(job.hour, job.minute);
        if (job.frequency === 'daily') {
            return `每天 ${time} 執行（搜尋當日+前一日公告）`;
        } else {
            return `每${getDayLabel(job.dayOfWeek)} ${time} 執行（搜尋前7日公告）`;
        }
    };

    return (
        <div className="space-y-6">
            {/* ========== 新增排程表單 ========== */}
            <div className="card">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-400" />
                    新增排程
                </h3>
                <form onSubmit={handleAddJob} className="space-y-5">
                    {/* 第一列：關鍵字輸入 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>關鍵字</label>
                        <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="例如: AI AND 系統"
                            className="input-field w-full"
                        />
                    </div>

                    {/* 第二列：頻率 + 時間設定 */}
                    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                        {/* 頻率選擇 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>頻率</label>
                            <select
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value)}
                                className="input-field appearance-none"
                                style={{ width: 'auto', minWidth: '140px' }}
                            >
                                <option value="daily">每天</option>
                                <option value="weekly">每週</option>
                            </select>
                        </div>

                        {/* 星期幾（僅每週排程顯示） */}
                        {frequency === 'weekly' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>星期幾</label>
                                <select
                                    value={dayOfWeek}
                                    onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                                    className="input-field appearance-none"
                                    style={{ width: 'auto', minWidth: '120px' }}
                                >
                                    {DAYS_OF_WEEK.map(d => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* 執行時間選擇（時:分） */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>執行時間</label>
                            <div className="flex items-center gap-2">
                                {/* 小時選擇 */}
                                <select
                                    value={hour}
                                    onChange={(e) => setHour(parseInt(e.target.value, 10))}
                                    className="input-field appearance-none text-center font-mono"
                                    style={{ width: '80px' }}
                                >
                                    {HOURS.map(h => (
                                        <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                                    ))}
                                </select>
                                <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>:</span>
                                {/* 分鐘選擇（每 5 分鐘為間隔） */}
                                <select
                                    value={minute}
                                    onChange={(e) => setMinute(parseInt(e.target.value, 10))}
                                    className="input-field appearance-none text-center font-mono"
                                    style={{ width: '80px' }}
                                >
                                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 提交按鈕 */}
                        <button type="submit" disabled={adding || !newKeyword.trim()} className="btn-primary sm:self-end">
                            {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : '新增排程'}
                        </button>
                    </div>

                    {/* 搜尋範圍提示 */}
                    <div className="text-sm rounded-xl px-4 py-3" style={{
                        background: 'rgba(59,130,246,0.06)',
                        border: '1px solid rgba(59,130,246,0.12)',
                        color: 'var(--text-secondary)',
                    }}>
                        {frequency === 'daily' ? (
                            <>💡 每日排程將自動搜尋<strong style={{ color: '#60a5fa' }}>當日與前一日</strong>公告的標案</>
                        ) : (
                            <>💡 每週排程將自動搜尋<strong style={{ color: '#60a5fa' }}>前 7 日</strong>公告的標案</>
                        )}
                    </div>
                </form>
            </div>

            {/* ========== 目前排程列表 ========== */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    目前排程
                </h3>

                {loading ? (
                    /* 載入中 */
                    <div className="text-center py-10 text-base" style={{ color: 'var(--text-muted)' }}>載入排程中...</div>
                ) : jobs.length === 0 ? (
                    /* 空狀態 */
                    <div className="card text-center py-12 text-base" style={{ color: 'var(--text-muted)', borderStyle: 'dashed' }}>
                        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        尚無排程
                    </div>
                ) : (
                    /* 排程卡片列表 */
                    <div className="space-y-3">
                        {jobs.map((job) => (
                            <div key={job.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                                <div className="flex-1 min-w-0">
                                    {/* 關鍵字 + 頻率標籤 */}
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <span className="text-base font-semibold text-white">{job.keyword}</span>
                                        <span className={`badge ${job.frequency === 'daily' ? 'badge-blue' : 'badge-green'}`}>
                                            {job.frequency === 'daily' ? '每日' : '每週'}
                                        </span>
                                    </div>
                                    {/* 執行時間與搜尋範圍描述 */}
                                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>{getScheduleDescription(job)}</span>
                                    </div>
                                    {/* 建立日期 */}
                                    <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>建立於 {new Date(job.createdAt).toLocaleDateString('zh-TW')}</span>
                                    </div>
                                </div>
                                {/* 刪除按鈕 */}
                                <button
                                    onClick={() => handleDeleteJob(job.id)}
                                    className="btn-danger opacity-60 group-hover:opacity-100 flex-shrink-0"
                                    title="刪除排程"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    刪除
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScheduleManager;
