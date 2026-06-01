/**
 * ===================================================
 * 政府標案查詢系統 — 後端伺服器入口
 * ===================================================
 * 
 * 功能：
 *   1. 提供 REST API：搜尋標案、排程管理、搜尋歷史 CRUD
 *   2. SSE（Server-Sent Events）即時回傳搜尋進度
 *   3. 提供靜態檔案服務（前端 Production Build）
 *   4. 日誌擷取（Cloud Debug 用）
 * 
 * 技術：Express 5、Node.js 18+
 */

// ========== Polyfill ==========
// 部分 Node 18 環境（undici）缺少 File API，需手動補齊
if (typeof File === 'undefined') {
    class File extends Blob {
        constructor(fileBits, fileName, options) {
            super(fileBits, options);
            this.name = fileName;
            this.lastModified = options?.lastModified || Date.now();
        }
    }
    global.File = File;
}

// ========== 載入依賴套件 ==========
const express = require('express');    // Web 框架
const cors = require('cors');          // 跨來源資源共用
const path = require('path');          // 路徑處理
const fs = require('fs');              // 檔案系統操作
const schedule = require('node-schedule'); // 排程管理（此處僅引入但主要由 scheduler.js 使用）
const scraperService = require('./services/scraper');     // 爬蟲服務
const schedulerService = require('./services/scheduler'); // 排程服務

// ========== 初始化 Express ==========
const app = express();
const PORT = process.env.PORT || 3001;

// 中介軟體設定
app.use(cors());          // 啟用 CORS（允許前端跨域請求）
app.use(express.json());  // 解析 JSON 請求主體

// ========== 資料目錄初始化 ==========
// 確保 data/ 與 data/results/ 目錄存在，否則建立
const DATA_DIR = path.join(__dirname, 'data');
const RESULTS_DIR = path.join(DATA_DIR, 'results');
const HISTORY_FILE = path.join(DATA_DIR, 'search_history.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR);
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');

// ========== 搜尋歷史讀寫工具 ==========

/**
 * 讀取搜尋歷史（JSON 檔）
 * @returns {Array} 歷史記錄陣列
 */
function readHistory() {
    try {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch {
        return [];
    }
}

/**
 * 寫入搜尋歷史（覆寫整份 JSON 檔）
 * @param {Array} data - 歷史記錄陣列
 */
function writeHistory(data) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

// ========== 日誌擷取系統（Cloud Debug 用） ==========
const MAX_LOGS = 1000;       // 保留最多 1000 筆日誌
const systemLogs = [];       // 記憶體內日誌佇列

const originalLog = console.log;
const originalError = console.error;

/**
 * 攔截 console 輸出，同時存入 systemLogs 陣列
 * @param {string} type - 日誌類型（INFO / ERROR）
 * @param {Array} args - console 傳入的參數
 */
function captureLog(type, args) {
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
    const timestamp = new Date().toISOString();
    systemLogs.push(`[${timestamp}] [${type}] ${message}`);
    if (systemLogs.length > MAX_LOGS) systemLogs.shift(); // 超過上限時移除最舊的
}

// 覆寫 console.log / console.error，攔截後仍輸出至原始 stdout
console.log = (...args) => {
    captureLog('INFO', args);
    originalLog.apply(console, args);
};

console.error = (...args) => {
    captureLog('ERROR', args);
    originalError.apply(console, args);
};

// =============================================
//               API 路由定義
// =============================================

// ---------- 系統日誌端點 ----------
// GET /api/system-logs — 取得伺服器系統日誌（純文字）
app.get('/api/system-logs', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(systemLogs.join('\n'));
});

// ---------- 1. 搜尋端點（SSE 串流） ----------
// GET /api/search-stream?keyword=...&startDate=...&endDate=...
// 以 SSE 方式即時回傳爬蟲進度與最終結果
app.get('/api/search-stream', (req, res) => {
    // 設定 SSE 標頭
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const { keyword, startDate, endDate } = req.query;

    // 防呆：關鍵字為必填
    if (!keyword) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Keyword is required' })}\n\n`);
        res.end();
        return;
    }

    const { searchTenders } = require('./services/scraper');

    // 執行爬蟲搜尋；onProgress callback 會即時推送 log 訊息給前端
    searchTenders(keyword, startDate, endDate, (logMessage) => {
        res.write(`data: ${JSON.stringify({ type: 'log', message: logMessage })}\n\n`);
    })
        .then((results) => {
            // 搜尋完成：儲存至歷史記錄
            const historyEntry = {
                id: Date.now().toString(),
                type: 'immediate',      // 「即時搜尋」類型（對比 'scheduled' 排程搜尋）
                keyword,
                startDate: startDate || '',
                endDate: endDate || '',
                resultCount: results.length,
                results: results,
                createdAt: new Date().toISOString(),
            };
            const history = readHistory();
            history.unshift(historyEntry);       // 最新的放在最前面
            if (history.length > 100) history.length = 100; // 最多保留 100 筆
            writeHistory(history);

            // 推送完成事件與結果
            res.write(`data: ${JSON.stringify({ type: 'complete', results })}\n\n`);
            res.end();
        })
        .catch((err) => {
            // 推送錯誤事件
            res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
            res.end();
        });

    // 前端斷線時的處理
    req.on('close', () => {
        console.log('Client disconnected from stream');
    });
});

// ---------- 搜尋端點（POST，向下相容舊版） ----------
// POST /api/search — 傳統 JSON 請求，等待全部完成後一次回傳
app.post('/api/search', async (req, res) => {
    try {
        const { keyword, startDate, endDate } = req.body;
        console.log(`Received search request: ${keyword}, date: ${startDate}-${endDate}`);
        const results = await scraperService.searchTenders(keyword, startDate, endDate);

        // 儲存至歷史記錄
        const historyEntry = {
            id: Date.now().toString(),
            type: 'immediate',
            keyword,
            startDate: startDate || '',
            endDate: endDate || '',
            resultCount: results.length,
            results: results,
            createdAt: new Date().toISOString(),
        };
        const history = readHistory();
        history.unshift(historyEntry);
        if (history.length > 100) history.length = 100;
        writeHistory(history);

        res.json({ success: true, count: results.length, data: results });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---------- 2. 排程管理端點 ----------

// GET /api/schedules — 取得所有排程
app.get('/api/schedules', (req, res) => {
    const jobs = schedulerService.getJobs();
    res.json(jobs);
});

// POST /api/schedules — 新增排程
// body: { keyword, frequency, hour, minute, dayOfWeek }
app.post('/api/schedules', (req, res) => {
    try {
        const { keyword, frequency, hour, minute, dayOfWeek } = req.body;
        const job = schedulerService.addJob(keyword, frequency, hour, minute, dayOfWeek);
        res.json({ success: true, job });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/schedules/:id — 刪除指定排程
app.delete('/api/schedules/:id', (req, res) => {
    try {
        schedulerService.removeJob(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---------- 3. 搜尋歷史端點 ----------

// GET /api/history — 取得歷史摘要清單（不含完整 results，節省傳輸量）
app.get('/api/history', (req, res) => {
    const history = readHistory();
    const summaries = history.map(({ results, ...rest }) => ({
        ...rest,
    }));
    res.json(summaries);
});

// GET /api/history/:id — 取得單筆歷史詳細資料（含完整 results）
app.get('/api/history/:id', (req, res) => {
    const history = readHistory();
    const entry = history.find(h => h.id === req.params.id);
    if (entry) {
        res.json(entry);
    } else {
        res.status(404).json({ success: false, error: 'History entry not found' });
    }
});

// DELETE /api/history/:id — 刪除單筆歷史記錄
app.delete('/api/history/:id', (req, res) => {
    let history = readHistory();
    const idx = history.findIndex(h => h.id === req.params.id);
    if (idx !== -1) {
        history.splice(idx, 1);
        writeHistory(history);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, error: 'History entry not found' });
    }
});

// DELETE /api/history — 清除所有歷史記錄
app.delete('/api/history', (req, res) => {
    writeHistory([]);
    res.json({ success: true });
});

// ---------- 4. 檔案下載端點 ----------
// GET /api/results/:filename — 下載 CSV 結果檔案
app.get('/api/results/:filename', (req, res) => {
    const filepath = path.join(RESULTS_DIR, req.params.filename);
    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ success: false, error: 'File not found' });
    }
});

// ========== 靜態檔案服務（前端 Production Build） ==========
// 若 client/dist 資料夾存在，則直接由 Express 提供前端頁面
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // 所有未匹配的路由都回傳 index.html（支援前端路由）
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
} else {
    console.log('Client build not found. API mode only.');
}

// ========== 啟動伺服器 ==========
app.listen(PORT, () => {
    const msg = `Server running on http://localhost:${PORT}`;
    console.log(msg);
    schedulerService.init(); // 載入已儲存的排程任務
});
