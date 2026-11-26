(() => {
  'use strict';
  const pending = new Map();
  const listeners = new Set();
  let serial = 0;
  const session = Date.now().toString(36);
  function platform() {
    if (typeof window.callNative?.evaluateJsToNative === 'function') return 'android';
    if (typeof window.webkit?.messageHandlers?.evaluateJsToNative?.postMessage === 'function') return 'ios';
    return 'browser';
  }
  function transport(message) {
    const json = JSON.stringify(message);
    if (platform() === 'android') window.callNative.evaluateJsToNative(json);
    else if (platform() === 'ios') window.webkit.messageHandlers.evaluateJsToNative.postMessage(json);
    else throw new Error('请在喵喵记账客户端中读取本地账单');
  }
  function parse(raw) {
    try {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return message && typeof message.action === 'string' && typeof message.requestId === 'string' ? message : null;
    } catch { return null; }
  }
  function complete(raw, success) {
    const message = parse(raw);
    if (!message) return;
    const key = message.action + ':' + message.requestId;
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    clearTimeout(entry.timer);
    if (success) entry.resolve(message.data);
    else {
      const error = new Error(message.data?.msg || '客户端处理失败');
      error.code = message.data?.code;
      entry.reject(error);
    }
  }
  // Must be registered before the page begins requesting native actions.
  window.onSuccessCallback = raw => complete(raw, true);
  window.onFailCallback = raw => complete(raw, false);
  window.evaluateNativeToJSUnCallback = raw => {
    const message = parse(raw);
    if (message) listeners.forEach(fn => fn(message));
  };
  function request(action, data, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const requestId = session + '-' + (++serial);
      const key = action + ':' + requestId;
      const timer = setTimeout(() => {
        pending.delete(key);
        const error = new Error('客户端未响应，请确认已接入 ' + action);
        error.code = 'TIMEOUT';
        reject(error);
      }, timeoutMs);
      pending.set(key, { resolve, reject, timer });
      try { transport({ action, requestId, data }); }
      catch (error) {
        clearTimeout(timer);
        pending.delete(key);
        reject(error);
      }
    });
  }
  function send(action, data) {
    if (platform() === 'browser') return;
    try { transport({ action, requestId: session + '-' + (++serial), data }); }
    catch { /* Fire-and-forget native lifecycle controls have no response. */ }
  }
  async function getLocalBills() {
    const data = await request('getLocalBills', { scope: 'all', limit: 200, type: 'expense' });
    if (data?.code !== undefined && data.code !== 200) throw new Error(data.msg || '读取账单失败');
    if (!data || !Array.isArray(data.items) || data.items.length > 200) throw new Error('账单接口返回格式错误：最多 200 条');
    const ids = new Set();
    const types = new Set(['home', 'food', 'car', 'coffee', 'receipt']);
    let total = 0;
    const items = data.items.map(item => {
      if (!item || typeof item.id !== 'string' || !item.id ||
          typeof item.bookId !== 'string' || !item.bookId ||
          typeof item.bookName !== 'string' || !item.bookName.trim() ||
          typeof item.name !== 'string' || !item.name.trim() ||
          !Number.isSafeInteger(item.amount) || item.amount <= 0 ||
          typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
          typeof item.category !== 'string') throw new Error('账单接口返回了无效或重复记录');
      const id = 'bill:' + encodeURIComponent(item.bookId) + ':' + encodeURIComponent(item.id);
      if (ids.has(id)) throw new Error('账单接口返回了重复记录');
      ids.add(id);
      total += item.amount;
      if (!Number.isSafeInteger(total)) throw new Error('账单金额超出计算范围');
      return {
        id, sourceId: item.id, bookId: item.bookId, bookName: item.bookName.trim(),
        name: item.name.trim(), amount: item.amount, date: item.date,
        category: item.category, type: types.has(item.icon) ? item.icon : 'receipt'
      };
    });
    // Keep native ordering. No network request, pagination or second query.
    return { items };
  }
  function canShareImage() {
    return platform() === 'android' || (platform() === 'ios' && window.BILL_SPLIT_CONFIG?.iosShareImg === true);
  }
  function setBackIntercept(intercept) {
    if (platform() === 'ios' || (platform() === 'android' && window.BILL_SPLIT_CONFIG?.androidBackIntercept === true)) {
      send('backIntercept', { intercept });
    }
  }
  async function shareImage(base64, target) {
    if (!canShareImage()) throw new Error('此客户端暂未接入图片分享，请长按预览图保存或发送');
    if (![0, 1, 2, 3].includes(target)) throw new Error('分享目标无效');
    // A timeout must not trigger a retry: the first native operation may still be running.
    const data = await request('shareImg', { platform: target, base64 }, 60000);
    if (data?.code !== 200) {
      const error = new Error(data?.msg || '分享或保存未完成');
      error.code = data?.code;
      throw error;
    }
    return data;
  }
  window.BillSplitNative = Object.freeze({
    platform, request, send, getLocalBills, canShareImage, shareImage, setBackIntercept,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  });
})();
