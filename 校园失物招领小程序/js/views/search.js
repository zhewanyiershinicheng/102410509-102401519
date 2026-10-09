/* ==========================================================================
   校园失物招领 · 搜索视图 (views/search.js)
   说明：关键词输入（防抖实时搜索）+ 类型、类别和时间范围筛选 + 搜索结果列表。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;

  function localDate(value, endOfDay) {
    const parts = value.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2],
      endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  function render() {
    const state = { kw: '', type: 'all', cat: 'all', from: '', to: '' };
    const container = LF.$('#view');
    container.innerHTML =
      '<div class="page page-search">' +
        LF.ui.headerHTML('搜索', true) +
        '<div class="search-head">' +
          '<div class="search-input">' +
            LF.icon('search') +
            '<input id="searchKw" type="search" placeholder="输入物品名称、地点或描述…" autocomplete="off">' +
          '</div>' +
        '</div>' +
        '<div class="search-filter">' +
          '<div class="segment" id="searchType">' +
            '<button class="segment__item active" data-filter="all">全部</button>' +
            '<button class="segment__item" data-filter="lost"><span class="segment__dot"></span>寻物</button>' +
            '<button class="segment__item" data-filter="found"><span class="segment__dot"></span>招领</button>' +
          '</div>' +
          '<div class="search-filter__row" id="searchCats">' +
            '<button class="chip active" data-cat="all">全部</button>' +
            LF.CATEGORIES.map(function (c) {
              return '<button class="chip" data-cat="' + LF.escapeHtml(c.value) + '">' + c.emoji + ' ' + LF.escapeHtml(c.value) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="search-filter__label">时间范围</div>' +
          '<div class="search-date">' +
            '<label class="search-date__field"><span>开始日期</span><input id="searchFrom" type="date"></label>' +
            '<span class="search-date__separator">至</span>' +
            '<label class="search-date__field"><span>结束日期</span><input id="searchTo" type="date"></label>' +
            '<button class="icon-btn search-date__clear" id="searchDateClear" type="button" title="清除时间筛选" aria-label="清除时间筛选" disabled>' + LF.icon('close') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="search-result-count" id="searchCount"></div>' +
        '<div id="searchList"></div>' +
      '</div>';

    const listEl = LF.$('#searchList');

    function apply() {
      const kw = state.kw.trim().toLowerCase();
      const invalidRange = state.from && state.to && state.from > state.to;
      const fromTime = state.from ? localDate(state.from, false).getTime() : -Infinity;
      const toTime = state.to ? localDate(state.to, true).getTime() : Infinity;
      const items = LF.store.getItems()
        .filter(function (it) { return it.closed !== true; })
        .filter(function (it) { return state.type === 'all' || it.type === state.type; })
        .filter(function (it) { return state.cat === 'all' || it.category === state.cat; })
        .filter(function (it) {
          if (invalidRange) return false;
          const time = new Date(it.time).getTime();
          return time >= fromTime && time <= toTime;
        })
        .filter(function (it) {
          if (!kw) return true;
          const hay = (it.name + ' ' + it.description + ' ' + it.location + ' ' + it.category).toLowerCase();
          return hay.indexOf(kw) !== -1;
        })
        .sort(function (a, b) { return new Date(b.time) - new Date(a.time); });

      listEl.innerHTML = LF.ui.listHTML(items);
      if (invalidRange) {
        LF.$('#searchCount').textContent = '开始日期不能晚于结束日期';
      } else {
        LF.$('#searchCount').innerHTML = kw
          ? '找到 <b>' + items.length + '</b> 条与“' + LF.escapeHtml(state.kw) + '”相关的结果'
          : '共 <b>' + items.length + '</b> 条信息';
      }
      LF.ui.bindCards(listEl);
    }

    function updateDateRange() {
      state.from = LF.$('#searchFrom').value;
      state.to = LF.$('#searchTo').value;
      LF.$('#searchFrom').max = state.to;
      LF.$('#searchTo').min = state.from;
      LF.$('#searchDateClear').disabled = !state.from && !state.to;
      apply();
    }

    LF.$('#searchKw').addEventListener('input', LF.debounce(function (e) {
      state.kw = e.target.value;
      apply();
    }, 200));

    LF.$('#searchType').addEventListener('click', function (e) {
      const btn = e.target.closest('.segment__item');
      if (!btn) return;
      state.type = btn.getAttribute('data-filter');
      const all = LF.$$('#searchType .segment__item');
      for (let i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
      apply();
    });

    LF.$('#searchCats').addEventListener('click', function (e) {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      state.cat = btn.getAttribute('data-cat');
      const all = LF.$$('#searchCats .chip');
      for (let i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
      apply();
    });

    LF.$('#searchFrom').addEventListener('change', updateDateRange);
    LF.$('#searchTo').addEventListener('change', updateDateRange);
    LF.$('#searchDateClear').addEventListener('click', function () {
      LF.$('#searchFrom').value = '';
      LF.$('#searchTo').value = '';
      updateDateRange();
    });

    apply();
    setTimeout(function () {
      const input = LF.$('#searchKw');
      if (input) input.focus();
    }, 80);
  }

  LF.views = LF.views || {};
  LF.views.search = { render: render };
})();
