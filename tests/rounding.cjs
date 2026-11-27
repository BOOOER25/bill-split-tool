const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(require('node:path').join(__dirname, '../src/prototype.html'), 'utf8');
const code = html.slice(html.indexOf('function equalAllocations('), html.indexOf('function openCreate(){'));
const math = vm.createContext({ sum: a => a.reduce((a, b) => a + b, 0) });
vm.runInContext(code, math);
const equal = (amounts, count) => JSON.parse(JSON.stringify(math.equalAllocations(amounts.map(amount => ({ amount })), count)));
assert.deepEqual(equal([10000], 3), [[3333, 3333, 3333]]);
assert.deepEqual(equal([1], 3), [[0, 0, 0]]);
assert.deepEqual(equal([1, 1, 1], 3), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
let seed = 17;
for (let trial = 0; trial < 300; trial++) {
  const count = 2 + trial % 11;
  const amounts = Array.from({ length: 1 + trial % 200 }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % 100000;
  });
  const rows = equal(amounts, count), total = amounts.reduce((a, b) => a + b, 0);
  rows.forEach((row, i) => {
    assert.ok(row.every(v => Number.isSafeInteger(v) && v >= 0));
    assert.ok(row.reduce((a, b) => a + b, 0) <= amounts[i]);
  });
  for (let i = 0; i < count; i++) assert.equal(rows.reduce((a, row) => a + row[i], 0), Math.floor(total / count));
  assert.equal(total - rows.flat().reduce((a, b) => a + b, 0), total % count);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      window.callNative = { evaluateJsToNative(raw) {
        const m = JSON.parse(raw);
        if (m.action === 'getLocalBills') setTimeout(() => window.onSuccessCallback(JSON.stringify({
          ...m, data: { items: [{ id: 'one', bookId: 'a', bookName: '日常', name: '聚餐', amount: 10000, date: '2026-11-27', category: '餐饮' }] }
        })), 10);
      } };
      const original = CanvasRenderingContext2D.prototype.fillText;
      window.receiptText = [];
      CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
        window.receiptText.push(String(text)); return original.call(this, text, ...args);
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const base = process.env.BILL_SPLIT_TEST_URL || 'http://127.0.0.1:8792';
    await page.goto(base);
    async function create(percent, custom = false) {
      await page.locator('[data-select]').first().check();
      await page.locator('#draft-next').click();
      if (percent) {
        await page.locator('[data-mode="percent"]').click();
        if (custom) {
          for (const [i, value] of ['50', '30', '20'].entries()) await page.locator(`[data-percent="${i}"]`).fill(value);
        } else {
          await page.locator('[data-percent="0"]').fill('50');
          assert.equal(await page.locator('#draft-next').isDisabled(), true);
          await page.locator('#equal-percent').click();
          assert.match(await page.locator('#percent-total').innerText(), /按人数均分/);
        }
      }
      await page.locator('#draft-next').click();
      assert.deepEqual(await page.locator('.allocation > span:last-child').allTextContents(), custom ? ['¥50.00', '¥30.00', '¥20.00'] : ['¥33.33', '¥33.33', '¥33.33']);
      await page.locator('#draft-next').click();
      assert.deepEqual(await page.locator('.total-member .grow small').allTextContents(), custom ? ['应付 ¥30.00', '应付 ¥20.00', '应付 ¥50.00'] : ['应付 ¥33.33', '应付 ¥33.33', '应付 ¥33.33']);
    }
    await create(true);
    assert.match(await page.locator('.ledger-summary-info').innerText(), /尾差减免/);
    await page.locator('#export-open').click();
    await page.locator('#export-preview img').waitFor();
    assert.ok((await page.evaluate(() => receiptText)).includes('尾差减免：'));
    await page.locator('[data-export-mode="text"]').click();
    assert.match(await page.locator('#export-preview textarea').inputValue(), /尾差减免：¥0.01/);
    await page.locator('[data-close]').click();
    await page.locator('[data-person="m1"]').click();
    await page.locator('[data-check]').check();
    assert.match(await page.locator('.hero-money').innerText(), /0.00/);
    await page.locator('#add-person-bill').click();
    // Close the independently added bill dialog; equal allocation is unchanged.
    await page.locator('[data-close]').click();
    await page.locator('#new-group').click();
    await create(false);
    await page.locator('#new-group').click();
    await create(true, true);
    // Legacy AA groups retain their original cent distribution, including payments.
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('miaomiao-bill-split-v1'));
      const g = saved.groups[0]; g.mode = 'aa'; delete g.rounding;
      g.payments = [{ id: 'legacy', member: 'm1', allocations: { [g.bills[0].id]: 3333 }, amount: 3333, date: '2026-11-27' }];
      localStorage.setItem('miaomiao-bill-split-v1', JSON.stringify(saved));
    });
    await page.reload();
    await page.locator('[data-select]').first().waitFor();
    await page.locator('#draft-back').click();
    assert.deepEqual(await page.locator('.total-member .grow small').allTextContents(), ['应付 ¥33.33', '应付 ¥33.33', '应付 ¥33.34']);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('miaomiao-bill-split-v1')).groups[0].payments.length), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: 300 money invariants, equal/AA/manual creation, exports, row settlement, historical allocations.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
