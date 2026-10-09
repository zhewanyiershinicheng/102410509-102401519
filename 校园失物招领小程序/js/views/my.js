/* ==========================================================================
   校园失物招领 · 我的发布视图 (views/my.js)
   说明：统计本人发布数量，列出本人发布的信息并提供编辑/标记状态/关闭/删除。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;

  function render() {
    const container = LF.$('#view');
    container.innerHTML =
      '<div class="page page-my">' +
        LF.ui.headerHTML('我的发布', false) +
        '<div class="my-stat" id="myStat"></div>' +
        '<div id="myList" class="card-list"></div>' +
      '</div>';

    apply();
  }

  function apply() {
    const mine = LF.store.getMyItems();
    const listEl = LF.$('#myList');

    const foundCount = mine.filter(function (it) { return it.found === true; }).length;
    const closedCount = mine.filter(function (it) { return it.closed === true; }).length;

    LF.$('#myStat').innerHTML =
      '<div class="my-stat__item"><div class="my-stat__num">' + mine.length + '</div><div class="my-stat__label">全部发布</div></div>' +
      '<div class="my-stat__item"><div class="my-stat__num">' + foundCount + '</div><div class="my-stat__label">已找到/归还</div></div>' +
      '<div class="my-stat__item"><div class="my-stat__num">' + closedCount + '</div><div class="my-stat__label">已关闭</div></div>';

    if (!mine.length) {
      listEl.innerHTML = LF.ui.emptyHTML('还没有发布记录', '发布一条寻物或招领信息，帮助物品早日回家', '去发布');
      const btn = listEl.querySelector('[data-empty-action]');
      if (btn) btn.addEventListener('click', function () { location.hash = '#/publish'; });
      return;
    }

    const sorted = mine.slice().sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
    listEl.innerHTML = sorted.map(myItemHTML).join('');
    bind(listEl, sorted);
  }

  function myItemHTML(item) {
    const tm = LF.typeMeta(item.type);
    const img = LF.itemImages(item)[0] || LF.placeholderFor(item.category);
    return '' +
      '<div class="my-item" data-id="' + LF.escapeHtml(item.id) + '">' +
        '<div class="my-item__thumb"><img src="' + LF.escapeHtml(img) + '" alt=""></div>' +
        '<div class="my-item__body">' +
          '<div class="my-item__name">' +
            LF.ui.badgeHTML(tm.badge, tm.label) +
            LF.ui.stateBadgesHTML(item) +
            '<span class="ellipsis">' + LF.escapeHtml(item.name) + '</span>' +
          '</div>' +
          '<div class="my-item__meta">' + LF.escapeHtml(item.location || '未填写地点') + ' · ' + LF.escapeHtml(LF.formatTime(item.time)) + '</div>' +
          '<div class="my-item__actions">' +
            '<button class="btn btn--outline" data-act="edit">编辑</button>' +
            (item.found !== true
              ? '<button class="btn btn--ghost" data-act="find">标记' + LF.resolutionLabel(item) + '</button>'
              : '<button class="btn btn--ghost" data-act="unfind">撤销' + LF.resolutionLabel(item) + '</button>') +
            (item.closed !== true
              ? '<button class="btn btn--ghost" data-act="close">关闭</button>'
              : '<button class="btn btn--ghost" data-act="reopen">重新打开</button>') +
            '<button class="btn btn--danger" data-act="delete">删除</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function bind(listEl, items) {
    const els = listEl.querySelectorAll('.my-item');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const id = el.getAttribute('data-id');
      const item = items.find(function (it) { return it.id === id; });

      el.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        location.hash = '#/detail/' + id;
      });

      const btns = el.querySelectorAll('[data-act]');
      for (let j = 0; j < btns.length; j++) {
        btns[j].addEventListener('click', function () {
          const act = btns[j].getAttribute('data-act');
          if (act === 'edit') {
            location.hash = '#/publish/edit/' + id;
          } else if (act === 'find') {
            applyPatch(id, { found: true }, '已标记为「' + LF.resolutionLabel(item) + '」');
          } else if (act === 'unfind') {
            applyPatch(id, { found: false }, '已撤销「' + LF.resolutionLabel(item) + '」');
          } else if (act === 'reopen') {
            applyPatch(id, { closed: false }, '已重新打开');
          } else if (act === 'close') {
            LF.ui.modal({
              title: '关闭信息',
              text: '关闭后不再公开展示，但不影响是否找到或归还，可随时重新打开。',
              okText: '确认关闭',
              danger: true
            }).then(function (ok) {
              if (ok) applyPatch(id, { closed: true }, '已关闭');
            });
          } else if (act === 'delete') {
            LF.ui.modal({
              title: '删除信息',
              text: '删除后不可恢复，确定删除吗？',
              okText: '确认删除',
              danger: true
            }).then(function (ok) {
              if (ok) applyDelete(id);
            });
          }
        });
      }
    }
  }

  async function applyPatch(id, patch, msg) {
    try {
      await LF.store.updateItem(id, patch);
      LF.ui.toast(msg, 'success');
      apply();
    } catch (e) {
      LF.ui.toast(e.message || '操作失败，请重试', 'error');
    }
  }

  async function applyDelete(id) {
    try {
      await LF.store.deleteItem(id);
      LF.ui.toast('已删除', 'success');
      apply();
    } catch (e) {
      LF.ui.toast(e.message || '操作失败，请重试', 'error');
    }
  }

  LF.views = LF.views || {};
  LF.views.my = { render: render };
})();
