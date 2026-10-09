/* ==========================================================================
   校园失物招领 · UI 组件 (ui.js)
   说明：与渲染相关的可复用组件：Toast、弹窗、徽章、卡片、列表、空状态、
        页面头部、底部导航高亮等。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;
  const esc = LF.escapeHtml;
  let activeLightboxClose = null;

  /* ---------- 类型 / 状态 元信息 ---------- */
  const TYPE_META = {
    lost:  { label: '寻物', badge: 'lost' },
    found: { label: '招领', badge: 'found' }
  };

  function typeMeta(t) { return TYPE_META[t] || TYPE_META.lost; }
  LF.typeMeta = typeMeta;

  /* ---------- 徽章 ---------- */
  function badgeHTML(cls, text) {
    return '<span class="badge badge--' + cls + '">' + esc(text) + '</span>';
  }

  function stateBadgesHTML(item) {
    return (item.found === true ? badgeHTML('resolved', LF.resolutionLabel(item)) : '') +
      (item.closed === true ? badgeHTML('closed', '已关闭') : '');
  }

  function openLightbox(images, startIndex) {
    const safeImages = Array.isArray(images) ? images.filter(function (image) {
      return typeof image === 'string' && image;
    }) : [];
    if (!safeImages.length) return;

    if (activeLightboxClose) activeLightboxClose();

    let index = Math.max(0, Math.min(Number(startIndex) || 0, safeImages.length - 1));
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.innerHTML = '' +
      '<button class="lightbox__close icon-btn" type="button" aria-label="关闭大图">' + LF.icon('close') + '</button>' +
      '<img class="lightbox__image" alt="放大的物品图片">' +
      (safeImages.length > 1 ? '<div class="lightbox__count"></div>' : '');

    function update() {
      overlay.querySelector('.lightbox__image').src = safeImages[index];
      const count = overlay.querySelector('.lightbox__count');
      if (count) count.textContent = (index + 1) + ' / ' + safeImages.length;
    }

    function close() {
      document.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = '';
      overlay.remove();
      if (activeLightboxClose === close) activeLightboxClose = null;
    }

    function onKeydown(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') {
        index = (index - 1 + safeImages.length) % safeImages.length;
        update();
      }
      if (e.key === 'ArrowRight') {
        index = (index + 1) % safeImages.length;
        update();
      }
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector('.lightbox__close').addEventListener('click', close);
    overlay.querySelector('.lightbox__image').addEventListener('click', function () {
      if (safeImages.length < 2) return;
      index = (index + 1) % safeImages.length;
      update();
    });
    document.addEventListener('keydown', onKeydown);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    activeLightboxClose = close;
    update();
  }
  LF.openLightbox = openLightbox;

  /* ---------- 信息卡片 ---------- */
  function cardHTML(item) {
    const tm = typeMeta(item.type);
    const cat = LF.getCategory(item.category);
    const img = LF.itemImages(item)[0] || LF.placeholderFor(item.category);
    return '' +
      '<div class="item-card" data-id="' + esc(item.id) + '">' +
        (item.found === true || item.closed === true
          ? '<div class="item-card__status">' + stateBadgesHTML(item) + '</div>'
          : '') +
        '<div class="item-card__thumb"><img src="' + esc(img) + '" alt="' + esc(item.name) + '" loading="lazy"></div>' +
        '<div class="item-card__body">' +
          '<div class="item-card__top">' +
            '<span class="badge badge--' + tm.badge + '">' + esc(tm.label) + '</span>' +
            '<span class="item-card__name ellipsis">' + esc(item.name) + '</span>' +
          '</div>' +
          '<div class="item-card__meta">' + LF.icon('tag') + '<span>' + esc(cat.emoji + ' ' + item.category) + '</span></div>' +
          '<div class="item-card__meta">' + LF.icon('location') + '<span class="ellipsis">' + esc(item.location || '未填写地点') + '</span></div>' +
          (item.description ? '<div class="item-card__desc">' + esc(item.description) + '</div>' : '') +
          '<div class="item-card__foot"><span class="item-card__time">' + esc(LF.formatTime(item.time)) + '</span></div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 列表（含空状态） ---------- */
  function listHTML(items, emptyTitle, emptyDesc) {
    if (!items.length) {
      return emptyHTML(emptyTitle || '暂无相关信息', emptyDesc || '换个关键词或筛选条件试试吧');
    }
    return '<div class="card-list">' + items.map(cardHTML).join('') + '</div>';
  }

  /* ---------- 空状态 ---------- */
  function emptyHTML(title, desc, btnText) {
    return '' +
      '<div class="empty">' +
        '<img src="images/empty.svg" alt="空状态">' +
        '<div class="empty__title">' + esc(title) + '</div>' +
        '<div class="empty__desc">' + esc(desc) + '</div>' +
        (btnText ? '<button class="btn btn--primary" data-empty-action>' + esc(btnText) + '</button>' : '') +
      '</div>';
  }

  /* ---------- 页面头部 ---------- */
  function headerHTML(title, back) {
    return '' +
      '<header class="page-header">' +
        '<div class="page-header__side">' +
          (back ? '<button class="icon-btn" data-back aria-label="返回">' + LF.icon('back') + '</button>' : '') +
        '</div>' +
        '<div class="page-header__title">' + esc(title) + '</div>' +
        '<div class="page-header__side page-header__side--right"></div>' +
      '</header>';
  }

  /* ---------- 卡片点击绑定（跳转详情） ---------- */
  function bindCards(container) {
    const cards = container.querySelectorAll('.item-card');
    for (let i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () {
        location.hash = '#/detail/' + this.getAttribute('data-id');
      });
    }
  }

  /* ---------- 底部导航高亮 ---------- */
  function setTabbar(active) {
    const items = document.querySelectorAll('#tabbar .tabbar__item');
    for (let i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-tab') === active);
    }
  }

  /* ---------- Toast 轻提示 ---------- */
  function toast(message, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.className = type === 'error' ? 'error' : 'success';
    el.innerHTML = LF.icon(type === 'error' ? 'info' : 'check') + '<span></span>';
    el.querySelector('span').textContent = message;
    void el.offsetWidth; // 强制重排以重新触发动画
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------- 弹窗 ---------- */
  function modal(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML =
        '<div class="modal">' +
          (opts.icon ? '<div class="modal__icon">' + esc(opts.icon) + '</div>' : '') +
          '<div class="modal__title">' + esc(opts.title || '') + '</div>' +
          (opts.text ? '<div class="modal__text">' + esc(opts.text) + '</div>' : '') +
          '<div class="modal__actions">' +
            '<button class="btn btn--ghost" data-act="cancel">' + esc(opts.cancelText || '取消') + '</button>' +
            '<button class="btn ' + (opts.danger ? 'btn--danger' : 'btn--primary') + '" data-act="ok">' + esc(opts.okText || '确定') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(mask);

      function close(val) {
        mask.remove();
        resolve(val);
      }
      mask.addEventListener('click', function (e) {
        if (e.target === mask) close(false);
      });
      mask.querySelector('[data-act="cancel"]').addEventListener('click', function () { close(false); });
      mask.querySelector('[data-act="ok"]').addEventListener('click', function () { close(true); });
    });
  }

  LF.ui = {
    badgeHTML: badgeHTML,
    stateBadgesHTML: stateBadgesHTML,
    cardHTML: cardHTML,
    listHTML: listHTML,
    emptyHTML: emptyHTML,
    headerHTML: headerHTML,
    bindCards: bindCards,
    setTabbar: setTabbar,
    toast: toast,
    modal: modal
  };
})();
