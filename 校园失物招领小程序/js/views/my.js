/* ==========================================================================
   校园失物招领 · 我的发布视图 (views/my.js)
   说明：统计本人发布数量，列出本人发布的信息并提供编辑/已找到/关闭/删除。
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
    const mine = LF.store.getItems().filter(function (it) {
      return it.deviceId === LF.store.getDeviceId();
    });
    const listEl = LF.$('#myList');

    const openCount = mine.filter(function (it) { return it.status === 'open'; }).length;
    const resolvedCount = mine.filter(function (it) { return it.status === 'resolved'; }).length;

    LF.$('#myStat').innerHTML =
      '<div class="my-stat__item"><div class="my-stat__num">' + mine.length + '</div><div class="my-stat__label">全部发布</div></div>' +
      '<div class="my-stat__item"><div class="my-stat__num">' + openCount + '</div><div class="my-stat__label">进行中</div></div>' +
      '<div class="my-stat__item"><div class="my-stat__num">' + resolvedCount + '</div><div class="my-stat__label">已找到</div></div>';

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
    const sm = LF.statusMeta(item.status);
    const img = item.image || LF.placeholderFor(item.category);
    return '' +
      '<div class="my-item" data-id="' + LF.escapeHtml(item.id) + '">' +
        '<div class="my-item__thumb"><img src="' + LF.escapeHtml(img) + '" alt=""></div>' +
        '<div class="my-item__body">' +
          '<div class="my-item__name">' +
            LF.ui.badgeHTML(tm.badge, tm.label) +
            LF.ui.badgeHTML(sm.badge, sm.label) +
            '<span class="ellipsis">' + LF.escapeHtml(item.name) + '</span>' +
          '</div>' +
          '<div class="my-item__meta">' + LF.escapeHtml(item.location || '未填写地点') + ' · ' + LF.escapeHtml(LF.formatTime(item.time)) + '</div>' +
          '<div class="my-item__actions">' +
            '<button class="btn btn--outline" data-act="edit">编辑</button>' +
            (item.status !== 'resolved' ? '<button class="btn btn--ghost" data-act="resolve">标记已找到</button>' : '') +
            (item.status !== 'closed'
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
          } else if (act === 'resolve') {
            LF.store.updateItem(id, { status: 'resolved' });
            LF.ui.toast('已标记为「已找到」', 'success');
            apply();
          } else if (act === 'reopen') {
            LF.store.updateItem(id, { status: 'open' });
            LF.ui.toast('已重新打开', 'success');
            apply();
          } else if (act === 'close') {
            LF.ui.modal({
              title: '关闭信息',
              text: '关闭后不再展示，可随时重新打开。',
              okText: '确认关闭',
              danger: true
            }).then(function (ok) {
              if (ok) {
                LF.store.updateItem(id, { status: 'closed' });
                LF.ui.toast('已关闭', 'success');
                apply();
              }
            });
          } else if (act === 'delete') {
            LF.ui.modal({
              title: '删除信息',
              text: '删除后不可恢复，确定删除吗？',
              okText: '确认删除',
              danger: true
            }).then(function (ok) {
              if (ok) {
                LF.store.deleteItem(id);
                LF.ui.toast('已删除', 'success');
                apply();
              }
            });
          }
        });
      }
    }
  }

  LF.views = LF.views || {};
  LF.views.my = { render: render };
})();
