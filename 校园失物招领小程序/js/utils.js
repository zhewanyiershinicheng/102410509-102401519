/* ==========================================================================
   校园失物招领 · 工具函数 (utils.js)
   说明：全局命名空间 LF，提供常量、图标、格式化、防抖、剪贴板、
        图片压缩等纯工具方法（不直接渲染页面）。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;

  /* ---------- 常量 ---------- */

  // 物品类别（value / emoji / 占位图路径）
  const CATEGORIES = [
    { value: '校园卡', emoji: '💳', img: 'images/placeholder-card.svg' },
    { value: '钥匙',   emoji: '🔑', img: 'images/placeholder-key.svg' },
    { value: '水杯',   emoji: '🥤', img: 'images/placeholder-cup.svg' },
    { value: '雨伞',   emoji: '🌂', img: 'images/placeholder-umbrella.svg' },
    { value: '耳机',   emoji: '🎧', img: 'images/placeholder-headphone.svg' },
    { value: '书籍',   emoji: '📚', img: 'images/placeholder-book.svg' },
    { value: '电子设备', emoji: '📱', img: 'images/placeholder-device.svg' },
    { value: '其他',   emoji: '🎒', img: 'images/placeholder-other.svg' }
  ];

  // 校园常见地点（发布页的输入建议）
  const LOCATIONS = ['教学楼', '图书馆', '食堂', '宿舍区', '运动场', '校门口', '行政楼', '其他'];

  // 内联 SVG 图标（24x24，描边风格）
  const ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  };

  LF.CATEGORIES = CATEGORIES;
  LF.LOCATIONS = LOCATIONS;

  /* ---------- 图标 ---------- */
  function icon(name) {
    return ICONS[name] || '';
  }
  LF.icon = icon;

  /* ---------- DOM 选择器 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  LF.$ = $;
  LF.$$ = $$;

  /* ---------- HTML 转义（防 XSS） ---------- */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  LF.escapeHtml = escapeHtml;

  /* ---------- 唯一 ID ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  LF.uid = uid;

  /* ---------- 时间格式化 ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }

  function formatTime(input) {
    if (!input) return '';
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    const diff = Date.now() - d.getTime();
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;
    if (diff < min) return '刚刚';
    if (diff < hour) return Math.floor(diff / min) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  LF.formatTime = formatTime;

  function formatDateTime(input) {
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input || '');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  LF.formatDateTime = formatDateTime;

  /* ---------- 防抖 ---------- */
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }
  LF.debounce = debounce;

  /* ---------- 类别辅助 ---------- */
  function getCategory(cat) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].value === cat) return CATEGORIES[i];
    }
    return CATEGORIES[CATEGORIES.length - 1];
  }
  LF.getCategory = getCategory;

  function placeholderFor(cat) {
    return getCategory(cat).img;
  }
  LF.placeholderFor = placeholderFor;

  function itemImages(item) {
    const images = item && Array.isArray(item.images) ? item.images : [];
    return images.filter(function (image) {
      return typeof image === 'string' && image;
    }).slice(0, 6);
  }
  LF.itemImages = itemImages;

  function resolutionLabel(item) {
    return item && item.type === 'found' ? '已归还' : '已找到';
  }
  LF.resolutionLabel = resolutionLabel;

  /* ---------- 剪贴板 ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }
  LF.copyText = copyText;

  /* ---------- 手机号判断 ---------- */
  function isPhone(str) {
    return /^1[3-9]\d{9}$/.test(String(str || '').replace(/[\s-]/g, ''));
  }
  LF.isPhone = isPhone;

  /* ---------- 图片压缩（canvas -> dataURL，避免超出 localStorage 容量） ---------- */
  function compressImage(file, maxSide, quality) {
    maxSide = maxSide || 900;
    quality = quality || 0.72;
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const img = new Image();
        img.onload = function () {
          let w = img.width;
          let h = img.height;
          if (w > maxSide || h > maxSide) {
            const scale = Math.min(maxSide / w, maxSide / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  LF.compressImage = compressImage;
})();
