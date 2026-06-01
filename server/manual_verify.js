const puppeteer = require('puppeteer');

(async () => {
    console.log('🚀 Starting Local Verification Test...');

    // Launch browser
    const browser = await puppeteer.launch({
        headless: "new", // Use new headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        // 1. Define Search Parameters
        const keyword = 'AI';
        const startDate = '2026/01/15'; // Keep user's format
        const endDate = '2026/02/16';

        // 2. Direct Navigation Logic (Exact copy of scraper.js)
        const encodedKeyword = encodeURIComponent(keyword);
        const encodedStart = encodeURIComponent(startDate);
        const encodedEnd = encodeURIComponent(endDate);
        const searchUrl = `https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic?pageSize=&firstSearch=true&searchType=basic&isBinding=N&isLogIn=N&level_1=on&orgName=&orgId=&tenderName=${encodedKeyword}&tenderId=&tenderType=TENDER_DECLARATION&tenderWay=TENDER_WAY_ALL_DECLARATION&dateType=isDate&tenderStartDate=${encodedStart}&tenderEndDate=${encodedEnd}&radProctrgCate=&policyAdvocacy=`;

        console.log(`→ Navigating to: ${searchUrl}`);

        // Emulate headers
        await page.setExtraHTTPHeaders({
            'Referer': 'https://web.pcc.gov.tw/prkms/tender/common/basic/indexTenderBasic',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for results table strictly
        try {
            await page.waitForSelector('table.tb_03c', { timeout: 20000 });
        } catch (e) {
            console.log("   ⚠️ Table tb_03c wait timeout. Dumping body text...");
            const text = await page.evaluate(() => document.body.innerText);
            console.log(text.substring(0, 200));
        }

        // 3. Extract Links (Logic from scraper.js)
        const links = await page.evaluate(() => {
            // Find the results table by checking headers
            const tables = Array.from(document.querySelectorAll('table'));
            const resultsTable = tables.find(t => {
                const tx = t.innerText;
                return tx.includes('機關名稱') && tx.includes('標案名稱');
            });

            if (!resultsTable) return [];

            const rows = Array.from(resultsTable.querySelectorAll('tbody tr'));
            const results = [];
            rows.forEach(row => {
                if (row.querySelector('input') || row.querySelector('select')) return;

                // Try multiple selectors
                let link = row.querySelector('a[title="檢視標案詳細內容"]');
                if (!link) link = row.querySelector('a[href*="tender/common/unit/tenderDetail"]');

                if (link) {
                    const urlObj = new URL(link.href);
                    const pk = urlObj.searchParams.get('pk');
                    if (pk) results.push({ original: link.href, pk });
                }
            });
            return results;
        });

        console.log(`Found ${links.length} potential items.`);

        if (links.length === 0) {
            console.log('❌ No links found. Dumping HTML...');
            const html = await page.content();
            console.log(html.substring(0, 500));
        }

        // 4. Test Detail Extraction for First 3 Items (New Direct URL Logic)
        for (let i = 0; i < Math.min(3, links.length); i++) {
            const item = links[i];
            const directLink = `https://web.pcc.gov.tw/tps/QueryTender/query/searchTenderDetail?pkPmsMain=${item.pk}`;
            console.log(`\nProcessing Item ${i + 1}: PK=${item.pk} -> ${directLink}`);

            const newPage = await browser.newPage();
            // Enable scripts
            await newPage.setRequestInterception(true);
            newPage.on('request', (req) => {
                if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
                else req.continue();
            });

            await newPage.setExtraHTTPHeaders({
                'Referer': 'https://web.pcc.gov.tw/prkms/tender/common/basic/indexTenderBasic',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            try {
                await newPage.goto(directLink, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for content
                await newPage.waitForFunction(() => {
                    return document.body.innerText.includes('機關名稱') || document.body.innerText.includes('標案名稱');
                }, { timeout: 15000 }).catch(() => console.log("   ⚠️ Content wait timeout"));

                const detail = await newPage.evaluate(() => {
                    const getText = (label) => {
                        const ths = Array.from(document.querySelectorAll('th'));
                        const targetTh = ths.find(th => th.innerText.trim().includes(label));
                        if (targetTh && targetTh.nextElementSibling) {
                            return targetTh.nextElementSibling.innerText.trim();
                        }
                        return '';
                    };
                    return {
                        agencyName: getText('機關名稱'),
                        tenderName: getText('標案名稱'),
                        id: getText('標案案號')
                    };
                });
                console.log('   ✅ Extracted:', JSON.stringify(detail));

            } catch (e) {
                console.log('   ❌ Error:', e.message);
            } finally {
                await newPage.close();
            }
        }

    } catch (error) {
        console.error('Test Error:', error);
    } finally {
        await browser.close();
        console.log('Done.');
    }
})();
