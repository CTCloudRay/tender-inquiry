/**
 * ===================================================
 * 政府標案查詢系統 — 爬蟲服務（Scraper Service）
 * ===================================================
 */

const puppeteer = require('puppeteer');           // 無頭瀏覽器驅動
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');                          // 檔案系統
const path = require('path');                      // 路徑工具
const { createObjectCsvWriter } = require('csv-writer'); // CSV 寫入器

// CSV 結果儲存路徑
const RESULTS_DIR = path.join(__dirname, '../data/results');

// 清理文字格式的輔助函式
function clean(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
}

// 根據地址判斷地區的輔助函式
function getRegion(address) {
    const addr = clean(address);
    if (['臺北市', '新北市', '基隆市', '桃園市', '宜蘭縣', '花蓮縣', '台東縣'].some(c => addr.includes(c))) return '北部';
    if (['新竹市', '新竹縣', '苗栗縣', '台中市', '臺中市', '彰化縣'].some(c => addr.includes(c))) return '中部';
    if (['雲林縣', '嘉義市', '嘉義縣', '台南市', '臺南市', '澎湖縣', '高雄市', '屏東縣', '金門縣', '連江縣'].some(c => addr.includes(c))) return '南部';
    return '其他';
}

/**
 * 搜尋標案主函式
 */
async function searchTenders(keyword, startDate, endDate, onProgress = () => { }) {
    const log = (message) => {
        console.log(message);
        onProgress(message);
    };

    log(`🚀 Starting search for: ${keyword}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const orGroups = keyword.split(/\s+OR\s+/i).map(g => g.trim()).filter(g => g);
        let allResults = [];       
        const seenKeys = new Set(); 

        log(`📋 Parsed OR groups: ${JSON.stringify(orGroups)}`);

        // ==========================================
        // 單一關鍵字搜尋函式
        // ==========================================
        const searchSingleKeyword = async (searchKeyword, label) => {
            const results = [];
            log(`   🔎 [${label}] Searching for: "${searchKeyword}"...`);

            try {
                const encodedKeyword = encodeURIComponent(searchKeyword);
                const encodedStart = encodeURIComponent(startDate);
                const encodedEnd = encodeURIComponent(endDate);

                const searchUrl = `https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic?pageSize=100&firstSearch=true&searchType=basic&isBinding=N&isLogIn=N&level_1=on&orgName=&orgId=&tenderName=${encodedKeyword}&tenderId=&tenderType=TENDER_DECLARATION&tenderWay=TENDER_WAY_ALL_DECLARATION&dateType=isDate&tenderStartDate=${encodedStart}&tenderEndDate=${encodedEnd}&radProctrgCate=&policyAdvocacy=`;

                await page.setExtraHTTPHeaders({
                    'Referer': 'https://web.pcc.gov.tw/prkms/tender/common/basic/indexTenderBasic'
                });

                try {
                    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                    try {
                        await page.waitForSelector('tr.tb_b2, tr.tb_b3', { timeout: 15000 });
                    } catch (e) {
                        log(`      ⚠️ No result rows found within timeout.`);
                    }
                } catch (navError) {
                    log(`      ❌ Navigation Error: ${navError.message}`);
                    return results;
                }

                let hasNextPage = true;
                let pageCount = 1;

                while (hasNextPage) {
                    log(`      📄 Page ${pageCount}...`);

                    // 1. 從列表頁擷取項目，並順便把 colTexts 的完整歷史結構傳遞到外層
                    const { items: tenderItems, rawDebugLists, debugInfo } = await page.evaluate(() => {
                        let dataRows = Array.from(document.querySelectorAll('tr.tb_b2, tr.tb_b3'));

                        if (dataRows.length === 0) {
                            const allLinks = Array.from(document.querySelectorAll('a[href*="urlSelector"]'));
                            const rowSet = new Set();
                            allLinks.forEach(a => { const tr = a.closest('tr'); if (tr) rowSet.add(tr); });
                            dataRows = Array.from(rowSet);
                        }

                        const items = [];
                        const rawDebugLists = []; // 💡 建立偵錯用的外層陣列

                        dataRows.forEach((row, rowIndex) => {
                            const cols = row.querySelectorAll('td');
                            if (cols.length >= 1) {
                                const linkEl = row.querySelector('a[href*="urlSelector"], a[href*="tenderDetail"], a[href*="pk="]');
                                if (linkEl) {
                                    const colTexts = Array.from(cols).map(c => c.innerText.trim());
                                    
                                    // 💡 把這一列抓到的陣列結構推送到 rawDebugLists，這樣外層才能看到它
                                    rawDebugLists.push({
                                        rowNumber: rowIndex + 1,
                                        arrayLength: colTexts.length,
                                        contentSnapshot: colTexts
                                    });
                                    
                                    const agencyName = colTexts[1] || '';
                                    const tenderCell = colTexts[2] || '';
                                    const tenderParts = tenderCell.split('\n');
                                    const tenderId = (tenderParts[0] || '').trim();
                                    const tenderName = (tenderParts.slice(1).join(' ') || '').trim();
                                    const method = colTexts[4] || '';
                                    const publishDate = colTexts[6] || '';
                                    const deadline = colTexts[7] || '';
                                    const budget = colTexts[8] || '';

                                    items.push({ link: linkEl.href, agencyName, tenderId, tenderName, method, publishDate, deadline, budget });
                                }
                            }
                        });

                        return { items, rawDebugLists, debugInfo: `Extracted: ${items.length}` };
                    });

                    // 💡 這裡是【關鍵偵錯點】，直接把 items 陣列完整印出來
                    log(`\n📦 ===== [最終 Items 擷取結果] =====`);
                    if (tenderItems.length === 0) {
                        log(`⚠️ 注意：tenderItems 是空的！`);
                    } else {
                        tenderItems.forEach((item, index) => {
                            log(`\n📌 標案項目 #${index + 1}:`);
                            log(`   - 標案名稱: ${item.tenderName}`);
                            log(`   - 標案案號: ${item.tenderId}`);
                            log(`   - 機關名稱: ${item.agencyName}`);
                            log(`   - 預算: ${item.budget}`);
                            log(`   - 連結: ${item.link}`);
                        });
                    }
                    log(`====================================\n`);
                    // 💡 【重要偵錯核心】：在 Node.js 的命令列中百分之百印出你需要的欄位陣列結構！
                    log(`\n⚙️ ===== [F12 欄位陣列偵錯結構] 第 ${pageCount} 頁 =====`);
                    rawDebugLists.forEach(debugRow => {
                        log(`📍 資料列 #${debugRow.rowNumber} (共有 ${debugRow.arrayLength} 個欄位):`);
                        debugRow.contentSnapshot.forEach((text, idx) => {
                            log(`   欄位 [${idx}] → "${text}"`);
                        });
                    });
                    log(`====================================================\n`);

                    log(`      🔍 ${debugInfo}`);
                
                    // 2. 深入核心：逐一開啟分頁抓取詳細資料
                    let detailPage = await browser.newPage(); // 只開一次

                    async function parseTenderDetail(url) {
                        const headers = {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                            'Referer': 'https://web.pcc.gov.tw/prkms/tender/common/basic/indexTenderBasic'
                        };

                        try {
                            const response = await axios.get(url, { headers });
                            const $ = cheerio.load(response.data);

                            const getVal = (tableSummary, keyword) => {
                                const table = $(`table[summary="${tableSummary}"]`);
                                if (table.length === 0) return null;

                                let foundVal = null;
                                table.find('tr').each((i, row) => {
                                    if ($(row).text().includes(keyword)) {
                                        const tds = $(row).find('td');
                                        if (tds.length >= 2) {
                                            // 取最後一個 td 的內容
                                            foundVal = $(tds[tds.length - 1]).text().trim().replace(/\n/g, ' ');
                                        }
                                    }
                                });
                                return foundVal;
                            };

                            // 提取資料
                            const data = {
                                // 機關資料
                                "機關代碼": clean(getVal('機關資料', '機關代碼')),
                                "機關名稱": clean(getVal('機關資料', '機關名稱')),
                                "單位名稱": clean(getVal('機關資料', '單位名稱')),
                                "地區": getRegion(clean(getVal('機關資料', '機關地址'))),
                                "聯絡人": clean(getVal('機關資料', '聯絡人')),
                                "聯絡電話": clean(getVal('機關資料', '聯絡電話')),
                                "傳真號碼": clean(getVal('機關資料', '傳真號碼')),
                                "電子郵件信箱": clean(getVal('機關資料', '電子郵件信箱')),
                                // 採購資料
                                "標案案號": clean(getVal('採購資料', '標案案號')),
                                "標案名稱": clean(getVal('採購資料', '標案名稱')),
                                "標的分類": clean(getVal('採購資料', '標的分類')),
                                "本採購是否屬中央政府計畫型案件": clean(getVal('採購資料', '本採購是否屬中央政府計畫型案件')),
                                // 招標資料
                                "公告日": clean(getVal('招標資料', '公告日')),
                                // 領投開標
                                "開標時間": clean(getVal('領投開標', '開標時間')),
                                "開標地點": clean(getVal('領投開標', '開標地點'))
                            };

                            return data;
                        } catch (error) {
                            console.error("抓取失敗:", error.message);
                            return null;
                        }
                    }

                    for (const item of tenderItems) {
                        try {
                            const url = item.link;
                            await new Promise(resolve => setTimeout(resolve, 360000));
                            // 1. 使用 await 等待資料抓取完成，並將結果存入變數 data
                            const data = await parseTenderDetail(url);
                            
                            // 2. 檢查資料是否真的抓到了（防禦性檢查）
                            if (!data) {
                                log(` ⚠️ 讀取失敗，資料為空 (${item.tenderId})`);
                                continue; // 跳過此筆
                            }

                            // 💡 成功讀取後印出詳細 LOG
                            log(`✅ [案號: ${item.tenderId}] 提取成功：`);
                            log(` 📍 地區: ${data["地區"]}`);
                            log(` 📍 機關名稱: ${data["機關名稱"]} - ${data["單位名稱"]}`);
                            log(` 📍 聯絡窗口: ${data["聯絡人"]} | 電話: ${data["聯絡電話"]}`);
                            log(` 📍 標案: ${data["標案名稱"]} (${data["標案案號"]})`);
                            log(` 📍 中央計畫: ${data["本採購是否屬中央政府計畫型案件"]}`);
                            log(` 📍 開標時間: ${data["開標時間"]}`);

                            // 3. 確保這裡使用的是上面拿到的 data
                            results.push({
                                // 管理部查詢時間
                                queryTime: new Date().toLocaleString('zh-TW'), 
                                // 地區
                                region: data["地區"],
                                // 機關窗口 
                                contact: `${data["單位名稱"] || ''} ${data["聯絡人"] || ''} ${data["聯絡電話"] || ''}`.trim(),
                                // 機關名稱
                                agencyName: data["機關名稱"] || item.agencyName,
                                // 標案案號
                                tenderId: item.tenderId,
                                // 標案名稱
                                tenderName: item.tenderName,
                                // 預算金額
                                budget: item.budget,
                                // 本採購是否屬中央政府
                                isCentralPlan: data["本採購是否屬中央政府計畫型案件"],
                                
                                method: item.method,
                                publishDate: item.publishDate,
                                deadline: item.deadline,
                                detailLink: item.link
                            });

                        } catch (err) {
                            log(` ⚠️ 讀取失敗 (${item.tenderId}): ${err.message}`);
                        }
                    }

                    // 翻頁邏輯
                    const nextPageInfo = await page.evaluate(() => {
                        const allLinks = Array.from(document.querySelectorAll('a'));
                        const nextLink = allLinks.find(el => el.innerText.trim() === '下一頁' || el.innerText.trim().includes('下一頁'));
                        if (nextLink && nextLink.href && !nextLink.className.includes('disabled')) {
                            return { found: true, href: nextLink.href };
                        }
                        return { found: false, href: null };
                    });

                    if (nextPageInfo.found && nextPageInfo.href) {
                        try {
                            log(`      → Next page...`);
                            await page.goto(nextPageInfo.href, { waitUntil: 'networkidle2', timeout: 60000 });
                            try { await page.waitForSelector('tr.tb_b2, tr.tb_b3', { timeout: 15000 }); } catch (e) { }
                            pageCount++;
                            if (pageCount > 20) { hasNextPage = false; }
                        } catch (e) {
                            log(`      ⚠️ Failed to go to next page: ${e.message}`);
                            hasNextPage = false;
                        }
                    } else {
                        hasNextPage = false;
                    }
                }
                log(`   ✅ "${searchKeyword}" → ${results.length} results`);
            } catch (err) {
                log(`   ❌ Error searching "${searchKeyword}": ${err.message}`);
                try { await page.goto('https://web.pcc.gov.tw/prkms/tender/common/basic/indexTenderBasic'); } catch (e) { }
            }

            return results;
        };

        for (const [gi, group] of orGroups.entries()) {
            log(`\n📦 Processing OR group ${gi + 1}/${orGroups.length}: "${group}"`);

            const notParts = group.split(/\s+NOT\s+/i);
            const positivePart = notParts[0].trim();
            const negativeTerms = notParts.slice(1).map(n => n.trim()).filter(n => n);
            const andTerms = positivePart.split(/\s+AND\s+/i).map(t => t.trim()).filter(t => t);

            if (andTerms.length === 0) continue;

            let groupResults;

            if (andTerms.length === 1) {
                groupResults = await searchSingleKeyword(andTerms[0], `Group ${gi + 1}`);
            } else {
                const termResultSets = [];
                for (const [ti, term] of andTerms.entries()) {
                    const termResults = await searchSingleKeyword(term, `G${gi + 1} AND-${ti + 1}/${andTerms.length}`);
                    termResultSets.push(termResults);
                }

                if (termResultSets.length > 0) {
                    const firstSet = termResultSets[0];
                    groupResults = firstSet.filter(item => {
                        const key = item.detailLink || `${item.tenderId}_${item.agencyName}`;
                        return termResultSets.every(set => set.some(r => (r.detailLink || `${r.tenderId}_${r.agencyName}`) === key));
                    });
                } else {
                    groupResults = [];
                }
            }

            if (negativeTerms.length > 0 && groupResults.length > 0) {
                groupResults = groupResults.filter(item => {
                    const fullText = `${item.agencyName} ${item.tenderId} ${item.tenderName}`.toLowerCase();
                    return !negativeTerms.some(neg => fullText.includes(neg.toLowerCase()));
                });
            }

            for (const detail of groupResults) {
                const uniqueKey = detail.detailLink || `${detail.tenderId}_${detail.agencyName}`;
                if (uniqueKey && !seenKeys.has(uniqueKey)) {
                    seenKeys.add(uniqueKey);
                    allResults.push(detail);
                }
            }
        }

        log(`🎉 Search complete! Total unique results: ${allResults.length}`);

        const currentQueryTime = new Date().toLocaleString('zh-TW', { 
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false 
        });

        const finalMappedResults = allResults.map(item => ({
            ...item,
            queryTime: currentQueryTime
        }));

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `tenders-combined-${timestamp}.csv`;
        const csvPath = path.join(RESULTS_DIR, filename);

        const csvWriter = createObjectCsvWriter({
            path: csvPath,
            header: [
                { id: 'queryTime', title: '管理部查詢時間' },
                { id: 'region', title: '地區' },
                { id: 'contact', title: '機關窗口' },
                { id: 'agencyName', title: '機關名稱' },
                { id: 'tenderId', title: '標案案號' },
                { id: 'tenderName', title: '標案名稱' },
                { id: 'budget', title: '預算金額' },
                { id: 'isCentralPlan', title: '本採購是否屬中央政府計畫型案件' },
                { id: 'planName', title: '計劃案名稱' },
                { id: 'method', title: '招標方式' },
                { id: 'publishDate', title: '公告日期' },
                { id: 'deadline', title: '截止日期' },
                { id: 'detailLink', title: '詳細連結' }
            ],
            encoding: 'utf8'
        });

        await csvWriter.writeRecords(finalMappedResults);
        log(`Saved results to ${csvPath}`);

        return finalMappedResults;

    } catch (error) {
        console.error('Puppeteer fatal error:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { searchTenders };