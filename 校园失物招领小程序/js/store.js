/* ==========================================================================
   校园失物招领 · 数据层 (store.js)
   说明：使用浏览器 localStorage 持久化数据，无后端。
         - 数据统一存放在键 lf_items_v1 下（JSON 数组）。
         - 每台设备一个 deviceId，用于区分“我的发布”。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;
  const KEY = 'lf_items_v1';
  const DEVICE_KEY = 'lf_device_id_v1';

  /* 读写 localStorage，带 try/catch 容错（隐私模式 / file:// 受限等） */
  function safeGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function safeSet(key, val) {
    try {
      localStorage.setItem(key, val);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 物品列表读写 ---------- */
  function getItems() {
    try {
      const arr = JSON.parse(safeGet(KEY, '[]'));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function saveItems(items) {
    return safeSet(KEY, JSON.stringify(items));
  }

  /* ---------- 设备标识（用于“我的发布”） ---------- */
  function getDeviceId() {
    let id = safeGet(DEVICE_KEY, '');
    if (!id) {
      id = 'dev-' + LF.uid();
      safeSet(DEVICE_KEY, id);
    }
    return id;
  }

  /* ---------- 增删改查 ---------- */
  function addItem(item) {
    const items = getItems();
    items.unshift(item);
    saveItems(items);
    return item;
  }

  function updateItem(id, patch) {
    const items = getItems();
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i] = Object.assign({}, items[i], patch, { id: id });
        saveItems(items);
        return items[i];
      }
    }
    return null;
  }

  function deleteItem(id) {
    const items = getItems().filter(function (it) { return it.id !== id; });
    saveItems(items);
  }

  function getItem(id) {
    const items = getItems();
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  LF.store = {
    getItems: getItems,
    saveItems: saveItems,
    getDeviceId: getDeviceId,
    addItem: addItem,
    updateItem: updateItem,
    deleteItem: deleteItem,
    getItem: getItem,
    KEY: KEY,
    DEVICE_KEY: DEVICE_KEY
  };
})();
