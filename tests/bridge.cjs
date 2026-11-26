const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../dist/native-bridge.js'), 'utf8');
function host(platform) {
  const messages = [];
  const window = { BILL_SPLIT_CONFIG: { iosShareImg: false } };
  const receive = raw => { assert.equal(typeof raw, 'string'); messages.push(JSON.parse(raw)); };
  if (platform === 'android') window.callNative = { evaluateJsToNative: receive };
  if (platform === 'ios') window.webkit = { messageHandlers: { evaluateJsToNative: { postMessage: receive } } };
  vm.runInNewContext(source, { window, setTimeout, clearTimeout });
  return { window, bridge: window.BillSplitNative, messages };
}
const bill = { id: '__proto__', bookId: 'book-a', bookName: '日常账本', name: '晚餐 "<b>喵</b>"', date: '2026-11-25', amount: 10001, category: '餐饮', icon: 'food' };
async function main() {
  for (const platform of ['android', 'ios']) {
    const h = host(platform);
    const promise = h.bridge.getLocalBills();
    const message = h.messages[0];
    assert.equal(message.action, 'getLocalBills');
    assert.deepEqual(JSON.parse(JSON.stringify(message.data)), { scope: 'all', limit: 200, type: 'expense' });
    h.window.onSuccessCallback(JSON.stringify({ ...message, action: 'unrelated', data: {} }));
    h.window.onSuccessCallback(JSON.stringify({ ...message, data: { items: [bill, { ...bill, bookId: 'book-b', bookName: '旅行账本' }] } }));
    const result = await promise;
    assert.equal(result.items[0].amount, 10001);
    assert.equal(result.items[0].id, 'bill:book-a:__proto__');
    assert.equal(result.items[1].bookId, 'book-b');
    assert.notEqual(result.items[0].id, result.items[1].id);
    h.window.onSuccessCallback(JSON.stringify({ ...message, data: {} }));
    const invalid = h.bridge.getLocalBills();
    h.window.onSuccessCallback(JSON.stringify({ ...h.messages.at(-1), data: { items: Array(201).fill(bill) } }));
    await assert.rejects(invalid, /最多 200/);
    const duplicate = h.bridge.getLocalBills();
    h.window.onSuccessCallback(JSON.stringify({ ...h.messages.at(-1), data: { items: [bill, bill] } }));
    await assert.rejects(duplicate, /重复记录/);
    const fail = h.bridge.getLocalBills();
    h.window.onFailCallback(JSON.stringify({ ...h.messages.at(-1), data: { code: 'LOCAL_DB_ERROR', msg: '数据库失败' } }));
    await assert.rejects(fail, /数据库失败/);
    await assert.rejects(h.bridge.request('missing', {}, 5), /未响应/);
    if (platform === 'android') {
      const share = h.bridge.shareImage('data:image/png;base64,abc', 3);
      assert.equal(h.messages.at(-1).data.platform, 3);
      h.window.onSuccessCallback(JSON.stringify({ ...h.messages.at(-1), data: { code: -1000004, msg: '权限被拒绝' } }));
      await assert.rejects(share, /权限被拒绝/);
    } else {
      assert.equal(h.bridge.canShareImage(), false);
      await assert.rejects(h.bridge.shareImage('data:image/png;base64,abc', 0), /暂未接入/);
    }
  }
  await assert.rejects(host('browser').bridge.getLocalBills(), /客户端/);
  console.log('PASS: Android/iOS string transport, fixed 200, callbacks, validation, timeout, share errors.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
