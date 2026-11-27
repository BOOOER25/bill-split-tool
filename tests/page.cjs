const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.BILL_SPLIT_TEST_URL || 'http://127.0.0.1:8787';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      window.testMessages = [];
      window.callNative = { evaluateJsToNative(raw) {
        const message = JSON.parse(raw);
        window.testMessages.push(message);
        if (message.action === 'getLocalBills') {
          const items = Array.from({ length: 200 }, (_, i) => ({
            id: 'id-' + i, bookId: i % 2 ? 'book-b' : 'book-a', bookName: i % 2 ? '旅行账本' : '日常账本',
            name: i === 0 ? '<img src=x onerror=alert(1)>晚餐' : '消费 ' + i,
            date: '2026-11-25', category: '<b>餐饮</b>', icon: 'food', amount: 10001 + i
          }));
          setTimeout(() => window.onSuccessCallback(JSON.stringify({ ...message, data: { items } })), 20);
        }
        if (message.action === 'shareImg') {
          setTimeout(() => window.onSuccessCallback(JSON.stringify({ ...message, data: { code: 200, msg: '完成' } })), 20);
        }
      } };
    });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }));
    await page.goto(base + '/');
    assert.equal(await page.locator('#reset-demo').isVisible(), false);
    assert.equal(await page.locator('#empty-create').count(), 1);
    await page.locator('[data-select]').first().waitFor();
    assert.equal(await page.locator('#modal-title').innerText(), '新建分摊');
    assert.equal(await page.locator('[data-select]').count(), 200);
    assert.equal(await page.locator('.bill-select img').count(), 0);
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport);
      const before = await page.locator('.create-foot').boundingBox();
      assert.ok(before.y >= 0 && before.y + before.height <= viewport.height);
      await page.locator('.create-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const after = await page.locator('.create-foot').boundingBox();
      assert.ok(Math.abs(before.y - after.y) < 1);
      assert.equal(await page.locator('#draft-next').isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.create-body').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: path.join(__dirname, 'create-first-mobile.png'), fullPage: true });
    assert.match(await page.locator('.source-caption').innerText(), /所有账本/);
    assert.match(await page.locator('[data-select="bill:book-a:id-0"]').locator('..').innerText(), /日常账本/);
    assert.match(await page.locator('[data-select="bill:book-b:id-1"]').locator('..').innerText(), /旅行账本/);
    await page.locator('[data-select="bill:book-a:id-0"]').check();
    await page.locator('[data-select="bill:book-b:id-1"]').check();
    await page.locator('#draft-next').click();
    await page.locator('[data-mode="percent"]').click();
    await page.locator('[data-percent="0"]').fill('50');
    assert.equal(await page.locator('#draft-next').isDisabled(), true);
    await page.locator('#equal-percent').click();
    assert.deepEqual(await page.locator('[data-percent]').evaluateAll(items => items.map(i => i.value)), ['33.34', '33.33', '33.33']);
    await page.locator('#draft-title').fill('最近200条测试');
    await page.locator('#draft-next').click();
    await page.locator('#draft-next').click();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('miaomiao-bill-split-v1')));
    assert.equal(saved.groups.length, 1);
    assert.equal(saved.groups[0].bills[0].sourceId, 'id-0');
    assert.equal(saved.groups[0].sourceScope, 'all');
    assert.equal(saved.groups[0].bills[0].bookId, 'book-a');
    assert.equal(saved.groups[0].bills[1].bookId, 'book-b');
    assert.equal(saved.groups[0].bills[0].amount, 10001);
    await page.locator('[data-person="m1"]').click();
    await page.locator('[data-check="bill:book-a:id-0"]').check();
    await page.reload();
    await page.locator('[data-select]').first().waitFor();
    await page.locator('#draft-back').click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('miaomiao-bill-split-v1')));
    assert.equal(saved.groups[0].payments.length, 1);
    await page.locator('#export-open').click();
    await page.locator('#export-preview img').waitFor();
    const png = await page.locator('#export-preview img').getAttribute('src');
    assert.ok(png.startsWith('data:image/png;base64,'));
    await page.locator('[data-export-mode="text"]').click();
    const receipt = await page.locator('#export-preview textarea').inputValue();
    assert.match(receipt, /日常账本/);
    assert.match(receipt, /旅行账本/);
    await page.locator('[data-export-mode="image"]').click();
    await page.locator('#export-download').click();
    await page.waitForFunction(() => window.testMessages.some(m => m.action === 'shareImg'));
    assert.equal(await page.evaluate(() => window.testMessages.find(m => m.action === 'shareImg').data.platform), 3);
    await page.locator('[data-close]').click();
    await page.locator('#new-group').click();
    await page.locator('[data-select="bill:book-b:id-1"]').check();
    await page.locator('#draft-next').click();
    await page.locator('#draft-title').fill('第二份分摊');
    await page.locator('#draft-next').click();
    await page.locator('#draft-next').click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('miaomiao-bill-split-v1')));
    assert.equal(saved.groups.length, 2);
    await page.locator('#history-open').click();
    await page.locator('[data-history]').filter({ hasText: '最近200条测试' }).click();
    assert.equal(await page.locator('#group-title').innerText(), '最近200条测试');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(__dirname, 'production-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.equal(requests.filter(r => ['fetch', 'xhr', 'websocket'].includes(r.type)).length, 0);
    const plain = await browser.newPage();
    await plain.goto(base + '/');
    await plain.locator('#retry-bills').waitFor();
    assert.match(await plain.locator('#modal').innerText(), /客户端/);
    await plain.goto(base + '/demo/');
    await plain.locator('[data-select]').first().waitFor();
    assert.equal(await plain.locator('[data-select]').count(), 200);
    assert.equal(await plain.getByText('模拟预览', { exact: true }).count(), 0);
    assert.equal(await plain.locator('#group-title').innerText(), '分摊算账');
    await plain.locator('#draft-back').click();
    assert.equal(await plain.locator('#reset-demo').isVisible(), true);
    await plain.locator('#reset-demo').click();
    await plain.locator('[data-select]').first().waitFor();
    assert.equal(await plain.locator('[data-select]').count(), 200);
    assert.equal(await plain.evaluate(() => JSON.parse(localStorage.getItem('miaomiao-bill-split-demo-v1')).groups.length), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({
      pass: true, scope: 'all', selectedBookCount: 2, returnedBills: 200, historyGroups: 2, businessRequests: 0,
      checked: ['create on entry', 'pinned footer at 320/390/1280 widths', 'no preview banner', 'no seeded split', '200 demo bills retained', 'HTML escaping', '100% validation', 'settlement persistence', 'PNG export', 'history', 'demo isolation']
    }, null, 2));
    console.log('PASS: 200 bills, percentage split, local persistence/history, image export/native save, isolated demo, no business requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
