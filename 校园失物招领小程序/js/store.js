/* ==========================================================================
   校园失物招领 · 数据层 (store.js)
   说明：调用同源 REST API，并维护页面渲染所需的内存缓存。
         发布者令牌只保存在当前浏览器，用于保护编辑和删除权限。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;
  const API = '/api/items';
  const OWNER_KEY = 'lf_owner_token_v2';

  let cache = [];
  let mineCache = [];
  let online = true;

  function randomToken() {
    const bytes = new Uint8Array(32);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.prototype.map.call(bytes, function (n) {
      return n.toString(16).padStart(2, '0');
    }).join('');
  }

  function getOwnerToken() {
    let token = null;
    try { token = localStorage.getItem(OWNER_KEY); } catch (e) { /* 隐私模式下退化为临时令牌 */ }
    if (!token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
      token = randomToken();
      try { localStorage.setItem(OWNER_KEY, token); } catch (e) { /* 忽略 */ }
    }
    return token;
  }

  function requestOptions(options) {
    const result = Object.assign({}, options || {});
    result.headers = Object.assign({
      'Accept': 'application/json',
      'X-Owner-Token': getOwnerToken()
    }, result.headers || {});
    return result;
  }

  async function request(url, options) {
    const res = await fetch(url, requestOptions(options));
    let data = null;
    try { data = await res.json(); } catch (e) { /* 保留状态码错误 */ }
    if (!res.ok) {
      throw new Error((data && data.error) || '请求失败 (' + res.status + ')');
    }
    return data;
  }

  async function init() {
    try {
      const results = await Promise.all([
        request(API),
        request(API + '?mine=1')
      ]);
      cache = Array.isArray(results[0]) ? results[0] : [];
      mineCache = Array.isArray(results[1]) ? results[1] : [];
      online = true;
    } catch (e) {
      cache = [];
      mineCache = [];
      online = false;
      throw e;
    }
    return cache;
  }

  function getItems() {
    return cache.slice();
  }

  function getMyItems() {
    return mineCache.slice();
  }

  function getItem(id) {
    return cache.find(function (item) { return item.id === id; }) ||
      mineCache.find(function (item) { return item.id === id; }) || null;
  }

  async function addItem(item) {
    const created = await request(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (created.closed !== true) cache.unshift(created);
    if (created.isMine === true) mineCache.unshift(created);
    return created;
  }

  async function updateItem(id, patch) {
    const updated = await request(API + '/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    cache = cache.filter(function (item) { return item.id !== id; });
    if (updated.closed !== true) cache.unshift(updated);

    const mineIndex = mineCache.findIndex(function (item) { return item.id === id; });
    if (mineIndex !== -1) mineCache[mineIndex] = updated;
    else if (updated.isMine === true) mineCache.unshift(updated);
    return updated;
  }

  async function deleteItem(id) {
    await request(API + '/' + encodeURIComponent(id), { method: 'DELETE' });
    cache = cache.filter(function (item) { return item.id !== id; });
    mineCache = mineCache.filter(function (item) { return item.id !== id; });
  }

  LF.store = {
    init: init,
    getItems: getItems,
    getMyItems: getMyItems,
    getItem: getItem,
    addItem: addItem,
    updateItem: updateItem,
    deleteItem: deleteItem,
    getOwnerToken: getOwnerToken,
    isOnline: function () { return online; },
    API: API,
    OWNER_KEY: OWNER_KEY
  };
})();
