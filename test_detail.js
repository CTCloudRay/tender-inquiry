const puppeteer = require('puppeteer');

(async () => {
    const url = 'https://web.pcc.gov.tw/prkms/urlSelector/common/tpam?pk=NzExNTE1Mjk=';
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const details = await page.evaluate(() => {
            const getTdValue = (labelText) => {
                const ths = Array.from(document.querySelectorAll('th'));
                let labelElem = ths.find(th => th.innerText.trim() === labelText);
                if (labelElem) {
                    const valueTd = labelElem.nextElementSibling;
                    return valueTd ? valueTd.innerText.trim() : '';
                }
                
                const tds = Array.from(document.querySelectorAll('td'));
                labelElem = tds.find(td => td.innerText.trim() === labelText);
                if (labelElem) {
                    const valueTd = labelElem.nextElementSibling;
                    return valueTd ? valueTd.innerText.trim() : '';
                }
                return null;
            };

            const contactName = getTdValue('聯絡人');
            const contactTel = getTdValue('聯絡電話');
            const contactEmail = getTdValue('電子郵件信箱');
            const centralGov = getTdValue('本採購是否屬中央政府計畫型案件');
            
            // Try specific elements or another way
            return { 
                contactName, contactTel, contactEmail, centralGov, 
                allTh: Array.from(document.querySelectorAll('th')).map(th => th.innerText.trim()).filter(Boolean),
                locationById: document.querySelector('#fkPmsExecuteLocation')?.innerText.trim() || ''
            };
        });
        console.log(JSON.stringify(details, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
