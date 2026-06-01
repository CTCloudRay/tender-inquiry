/**
 * ===================================================
 * 政府標案查詢系統 — 排程服務（Scheduler Service）
 * ===================================================
 * 
 * 功能：
 *   管理定時排程任務，自動在指定時間執行標案搜尋，
 *   並將結果儲存至搜尋歷史。
 * 
 * 支援頻率：
 *   - daily  (每日)：搜尋當日 + 前一日公告
 *   - weekly (每週)：搜尋前 7 日公告
 * 
 * 排程資料持久化：
 *   排程設定儲存於 data/schedules.json，伺服器重啟後自動載入。
 */

const schedule = require('node-schedule'); // cron 排程套件
const fs = require('fs');
const path = require('path');
const scraperService = require('./scraper'); // 爬蟲服務

// 排程與歷史檔案路徑
const SCHEDULE_FILE = path.join(__dirname, '../data/schedules.json');
const HISTORY_FILE = path.join(__dirname, '../data/search_history.json');

// 記憶體內的排程物件：{ id: { id, keyword, frequency, hour, minute, dayOfWeek, createdAt, jobRef } }
let jobs = {};

// ========== 搜尋歷史讀寫工具（用於儲存排程搜尋結果） ==========

/**
 * 讀取搜尋歷史
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
 * 寫入搜尋歷史
 * @param {Array} data - 歷史記錄陣列
 */
function writeHistory(data) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save search history:', error);
    }
}

// ========== 排程持久化 ==========

/**
 * 將目前所有排程設定儲存至磁碟（schedules.json）
 * 注意：jobRef（node-schedule 實例）不會被序列化
 */
function saveSchedules() {
    try {
        const data = Object.values(jobs).map(j => ({
            id: j.id,
            keyword: j.keyword,
            frequency: j.frequency,
            hour: j.hour,
            minute: j.minute,
            dayOfWeek: j.dayOfWeek,
            createdAt: j.createdAt,
        }));
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
        console.log(`Saved ${data.length} schedules to disk.`);
    } catch (error) {
        console.error('Failed to save schedules:', error);
    }
}

// ========== 初始化（伺服器啟動時呼叫） ==========

/**
 * 載入已儲存的排程設定並啟動排程任務
 * 會自動遷移舊版欄位（缺少 hour/minute 的舊資料）
 */
function init() {
    if (fs.existsSync(SCHEDULE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
            data.forEach(jobData => {
                // 向下相容：舊版排程可能沒有 hour/minute 欄位
                if (jobData.hour === undefined) jobData.hour = 9;
                if (jobData.minute === undefined) jobData.minute = 0;
                if (jobData.frequency === 'weekly' && jobData.dayOfWeek === undefined) jobData.dayOfWeek = 1;
                scheduleJobFromData(jobData);
            });
            console.log(`Loaded ${data.length} schedules.`);
        } catch (e) {
            console.error('Failed to load schedules:', e);
        }
    }
}

// ========== 工具函式 ==========

/**
 * 日期格式化為 yyyy/MM/dd
 * @param {Date} d - 日期物件
 * @returns {string} 格式化後的日期字串
 */
function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
}

// ========== 排程建立核心邏輯 ==========

/**
 * 依據排程資料建立 node-schedule 任務
 * 
 * @param {Object} jobData - 排程資料物件
 * @param {string} jobData.id        - 排程 ID
 * @param {string} jobData.keyword   - 搜尋關鍵字
 * @param {string} jobData.frequency - 頻率：'daily' 或 'weekly'
 * @param {number} jobData.hour      - 執行時（0-23）
 * @param {number} jobData.minute    - 執行分（0-59）
 * @param {number} [jobData.dayOfWeek] - 週幾（0=週日, 1=週一, ...6=週六），僅 weekly 使用
 */
function scheduleJobFromData(jobData) {
    const hour = jobData.hour ?? 9;     // 預設 09 時
    const minute = jobData.minute ?? 0; // 預設 00 分

    // 建立 cron 規則字串
    let rule;
    if (jobData.frequency === 'daily') {
        // 每日排程：分 時 * * *（每天指定時間執行）
        rule = `${minute} ${hour} * * *`;
    } else if (jobData.frequency === 'weekly') {
        // 每週排程：分 時 * * 週幾（指定星期幾執行）
        const dow = jobData.dayOfWeek ?? 1; // 預設週一
        rule = `${minute} ${hour} * * ${dow}`;
    } else {
        // 備用：每 5 分鐘（用於測試）
        rule = '*/5 * * * *';
    }

    // 建立排程任務
    const job = schedule.scheduleJob(rule, async () => {
        console.log(`Running scheduled job: "${jobData.keyword}" (${jobData.frequency})`);
        const today = new Date();

        // 計算搜尋日期區間
        let startDate, endDate;
        endDate = formatDate(today);

        if (jobData.frequency === 'daily') {
            // 每日排程：搜尋「昨天 ~ 今天」
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = formatDate(yesterday);
        } else {
            // 每週排程：搜尋「7 天前 ~ 今天」
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            startDate = formatDate(weekAgo);
        }

        try {
            // 執行爬蟲搜尋
            const results = await scraperService.searchTenders(jobData.keyword, startDate, endDate);
            console.log(`Scheduled job "${jobData.keyword}" completed: ${results.length} results`);

            // 將排程搜尋結果儲存至搜尋歷史
            const historyEntry = {
                id: Date.now().toString(),
                type: 'scheduled',       // 標記為「排程搜尋」
                keyword: jobData.keyword,
                startDate,
                endDate,
                resultCount: results.length,
                results: results,
                createdAt: new Date().toISOString(),
            };
            const history = readHistory();
            history.unshift(historyEntry);
            if (history.length > 100) history.length = 100; // 最多保留 100 筆
            writeHistory(history);
        } catch (e) {
            console.error(`Scheduled job failed for ${jobData.keyword}:`, e);
        }
    });

    // 將排程資料與 job 實例存入記憶體
    jobs[jobData.id] = {
        ...jobData,
        hour,
        minute,
        dayOfWeek: jobData.dayOfWeek,
        jobRef: job, // node-schedule Job 實例（用於取消排程）
    };
}

// ========== 公開 API ==========

/**
 * 新增排程任務
 * 
 * @param {string} keyword   - 搜尋關鍵字
 * @param {string} frequency - 頻率：'daily' 或 'weekly'
 * @param {number} hour      - 執行時（0-23），預設 9
 * @param {number} minute    - 執行分（0-59），預設 0
 * @param {number} dayOfWeek - 週幾（0-6），僅 weekly 使用，預設 1（週一）
 * @returns {Object} 新建立的排程資料
 */
function addJob(keyword, frequency, hour = 9, minute = 0, dayOfWeek = 1) {
    const id = Date.now().toString(); // 以時間戳作為唯一 ID
    const jobData = {
        id,
        keyword,
        frequency,
        hour: parseInt(hour, 10),
        minute: parseInt(minute, 10),
        dayOfWeek: frequency === 'weekly' ? parseInt(dayOfWeek, 10) : undefined,
        createdAt: new Date().toISOString(),
    };

    scheduleJobFromData(jobData); // 建立排程
    saveSchedules();               // 持久化至磁碟
    return jobData;
}

/**
 * 移除排程任務
 * @param {string} id - 排程 ID
 * @throws {Error} 若排程不存在
 */
function removeJob(id) {
    console.log(`Attempting to remove job ${id}...`);
    if (jobs[id]) {
        if (jobs[id].jobRef) {
            jobs[id].jobRef.cancel(); // 取消 node-schedule 排程
        }
        delete jobs[id];
        saveSchedules(); // 更新磁碟
        console.log(`Job ${id} removed successfully.`);
    } else {
        console.warn(`Job ${id} not found.`);
        throw new Error('Job not found');
    }
}

/**
 * 取得所有排程任務清單
 * @returns {Array} 排程資料陣列（不含 jobRef）
 */
function getJobs() {
    return Object.values(jobs).map(j => ({
        id: j.id,
        keyword: j.keyword,
        frequency: j.frequency,
        hour: j.hour,
        minute: j.minute,
        dayOfWeek: j.dayOfWeek,
        createdAt: j.createdAt,
    }));
}

// 匯出公開介面
module.exports = {
    init,       // 初始化（載入已儲存排程）
    addJob,     // 新增排程
    removeJob,  // 移除排程
    getJobs,    // 取得排程清單
};
