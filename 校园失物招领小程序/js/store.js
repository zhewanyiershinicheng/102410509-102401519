/* ==========================================================================
   校园失物招领 · 数据层 (store.js)
   说明：与后端 REST API 通信。
         - 启动时 init() 拉取全部数据并缓存到内存，读操作（getItems/getItem）
           直接读缓存、保持同步，便于视图层同步渲染。
         - 写操作（addItem/updateItem/deleteItem）为异步，调用后端接口成功后
           同步更新缓存。
         - deviceId 仅用于本机标识“我的发布”，存于 localStorage。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;
  const API = '/api/items';
  const DEVICE_KEY = 'lf_device_id_v1';

  /* 内存缓存 */
  let cache = [];
  let online = true;

  /* ---------- 设备标识 ---------- */
  function getDeviceId() {
    let id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) { /* 忽略 */ }
    if (!id) {
      id = 'dev-' + LF.uid();
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) { /* 忽略 */ }
    }
    return id;
  }

  /* ---------- 请求封装 ---------- */
  async function request(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      let msg = '请求失败 (' + res.status + ')';
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch (e) { /* 忽略 */ }
      throw new Error(msg);
    }
    return res.json();
  }

  /* ---------- 初始化：拉取全部数据 ---------- */
  async function init() {
    try {
      cache = await request(API);
      online = true;
    } catch (e) {
      cache = [];
      online = false;
      throw e;
    }
    return cache;
  }

  /* ---------- 读（同步，基于缓存） ---------- */
  function getItems() {
    return cache.slice();
  }

  function getItem(id) {
    for (let i = 0; i < cache.length; i++) {
      if (cache[i].id === id) return cache[i];
    }
    return null;
  }

  /* ---------- 写（异步，成功后更新缓存） ---------- */
  async function addItem(item) {
    const created = await request(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    cache.unshift(created);
    return created;
  }

  async function updateItem(id, patch) {
    const updated = await request(API + '/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    for (let i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        cache[i] = updated;
        break;
      }
    }
    return updated;
  }

  async function deleteItem(id) {
    await request(API + '/' + encodeURIComponent(id), { method: 'DELETE' });
    cache = cache.filter(function (it) { return it.id !== id; });
  }

  LF.store = {
    init: init,
    getItems: getItems,
    getItem: getItem,
    addItem: addItem,
    updateItem: updateItem,
    deleteItem: deleteItem,
    getDeviceId: getDeviceId,
    isOnline: function () { return online; },
    API: API,
    DEVICE_KEY: DEVICE_KEY
  };
})();
