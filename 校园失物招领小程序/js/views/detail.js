/* ==========================================================================
   校园失物招领 · 详情视图 (views/detail.js)
   说明：展示图片、描述、时间、地点、发布者与联系方式；支持复制/拨号；
         若是本人发布，额外提供编辑、标记已找到、关闭、删除等操作。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;

  function render(id) {
    const item = LF.store.getItem(id);
    const container = LF.$('#view');

    if (!item) {
      container.innerHTML =
        '<div class="page">' +
          LF.ui.headerHTML('详情', true) +
          LF.ui.emptyHTML('信息不存在', '该信息可能已被删除', '返回首页') +
        '</div>';
      const btn = container.querySelector('[data-empty-action]');
      if (btn) btn.addEventListener('click', function () { location.hash = '#/'; });
      return;
    }

    const isMine = item.deviceId === LF.store.getDeviceId();
    const tm = LF.typeMeta(item.type);
    const sm = LF.statusMeta(item.status);
    const cat = LF.getCategory(item.category);
    const img = item.image || LF.placeholderFor(item.category);
    const phone = LF.isPhone(item.contact);
    const avatar = (item.nickname || '匿').charAt(0);

    container.innerHTML =
      '<div class="page page-detail">' +
        LF.ui.headerHTML(tm.label + '详情', true) +
        '<div class="detail-hero">' +
          '<img src="' + LF.escapeHtml(img) + '" alt="' + LF.escapeHtml(item.name) + '">' +
          '<div class="detail-hero__badges">' +
            LF.ui.badgeHTML(tm.badge, tm.label) +
            LF.ui.badgeHTML(sm.badge, sm.label) +
          '</div>' +
        '</div>' +
        '<div class="detail-body">' +
          '<div class="detail-title-row"><h1 class="detail-title">' + LF.escapeHtml(item.name) + '</h1></div>' +
          '<div class="detail-tags"><span class="chip chip--static">' + cat.emoji + ' ' + LF.escapeHtml(item.category) + '</span></div>' +
          '<div class="detail-meta">' +
            '<div class="detail-meta__row">' +
              '<div class="detail-meta__icon">' + LF.icon('clock') + '</div>' +
              '<div><div class="detail-meta__label">时间</div><div class="detail-meta__value">' + LF.escapeHtml(LF.formatDateTime(item.time)) + '</div></div>' +
            '</div>' +
            '<div class="detail-meta__row">' +
              '<div class="detail-meta__icon">' + LF.icon('location') + '</div>' +
              '<div><div class="detail-meta__label">地点</div><div class="detail-meta__value">' + LF.escapeHtml(item.location || '未填写') + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="detail-desc-title">物品描述</div>' +
          '<div class="detail-desc">' + LF.escapeHtml(item.description || '发布者暂未补充描述。') + '</div>' +
          '<div class="detail-desc-title">发布者</div>' +
          '<div class="detail-publisher">' +
            '<div class="detail-publisher__avatar">' + LF.escapeHtml(avatar) + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="detail-publisher__name">' + LF.escapeHtml(item.nickname || '匿名同学') + '</div>' +
              '<div class="detail-publisher__contact ellipsis">' + LF.escapeHtml(item.contact) + '</div>' +
            '</div>' +
            '<button class="detail-contact-btn" data-copy>' + LF.icon('copy') + '复制</button>' +
          '</div>' +
          '<div class="detail-actions">' +
            (phone ? '<button class="btn btn--primary btn--block" data-call>' + LF.icon('phone') + '拨打 ' + LF.escapeHtml(item.contact) + '</button>' : '') +
            (isMine ? mineActions(item) : '') +
          '</div>' +
        '</div>' +
      '</div>';

    container.querySelector('[data-copy]').addEventListener('click', function () {
      LF.copyText(item.contact).then(function (ok) {
        LF.ui.toast(ok ? '联系方式已复制' : '复制失败，请手动复制', ok ? 'success' : 'error');
      });
    });

    const callBtn = container.querySelector('[data-call]');
    if (callBtn) {
      callBtn.addEventListener('click', function () {
        window.location.href = 'tel:' + item.contact.replace(/[\s-]/g, '');
      });
    }

    if (isMine) bindMineActions(container, item);
  }

  function mineActions(item) {
    return '' +
      '<div class="detail-actions__row">' +
        '<button class="btn btn--outline" data-mine="edit">' + LF.icon('edit') + '编辑</button>' +
        (item.status !== 'resolved'
          ? '<button class="btn btn--ghost" data-mine="resolve">' + LF.icon('check') + '标记已找到</button>'
          : '<button class="btn btn--ghost" data-mine="reopen">' + LF.icon('check') + '撤销已找到</button>') +
      '</div>' +
      '<div class="detail-actions__row">' +
        (item.status !== 'closed'
          ? '<button class="btn btn--danger" data-mine="close">' + LF.icon('close') + '关闭信息</button>'
          : '<button class="btn btn--outline" data-mine="reopen">' + LF.icon('check') + '重新打开</button>') +
        '<button class="btn btn--danger" data-mine="delete">' + LF.icon('trash') + '删除</button>' +
      '</div>';
  }

  function bindMineActions(container, item) {
    const btns = container.querySelectorAll('[data-mine]');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-mine');
        if (act === 'edit') {
          location.hash = '#/publish/edit/' + item.id;
        } else if (act === 'resolve') {
          LF.store.updateItem(item.id, { status: 'resolved' });
          LF.ui.toast('已标记为「已找到」', 'success');
          setTimeout(function () { render(item.id); }, 250);
        } else if (act === 'reopen') {
          LF.store.updateItem(item.id, { status: 'open' });
          LF.ui.toast('已重新打开', 'success');
          setTimeout(function () { render(item.id); }, 250);
        } else if (act === 'close') {
          LF.ui.modal({
            title: '关闭信息',
            text: '关闭后该信息将不再显示在首页列表，可随时重新打开。',
            okText: '确认关闭',
            danger: true
          }).then(function (ok) {
            if (ok) {
              LF.store.updateItem(item.id, { status: 'closed' });
              LF.ui.toast('已关闭', 'success');
              setTimeout(function () { render(item.id); }, 250);
            }
          });
        } else if (act === 'delete') {
          LF.ui.modal({
            title: '删除信息',
            text: '删除后不可恢复，确定删除这条信息吗？',
            okText: '确认删除',
            danger: true
          }).then(function (ok) {
            if (ok) {
              LF.store.deleteItem(item.id);
              LF.ui.toast('已删除', 'success');
              setTimeout(function () { location.hash = '#/my'; }, 250);
            }
          });
        }
      });
    });
  }

  LF.views = LF.views || {};
  LF.views.detail = { render: render };
})();
