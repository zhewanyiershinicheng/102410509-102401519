/* ==========================================================================
   校园失物招领 · 搜索视图 (views/search.js)
   说明：关键词输入（防抖实时搜索）+ 类型筛选 + 类别筛选 + 搜索结果列表。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;

  function render() {
    const state = { kw: '', type: 'all', cat: 'all' };
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
        '</div>' +
        '<div class="search-result-count" id="searchCount"></div>' +
        '<div id="searchList"></div>' +
      '</div>';

    const listEl = LF.$('#searchList');

    function apply() {
      const kw = state.kw.trim().toLowerCase();
      const items = LF.store.getItems()
        .filter(function (it) { return state.type === 'all' || it.type === state.type; })
        .filter(function (it) { return state.cat === 'all' || it.category === state.cat; })
        .filter(function (it) {
          if (!kw) return true;
          const hay = (it.name + ' ' + it.description + ' ' + it.location + ' ' + it.category).toLowerCase();
          return hay.indexOf(kw) !== -1;
        })
        .sort(function (a, b) { return new Date(b.time) - new Date(a.time); });

      listEl.innerHTML = LF.ui.listHTML(items);
      LF.$('#searchCount').innerHTML = kw
        ? '找到 <b>' + items.length + '</b> 条与“' + LF.escapeHtml(state.kw) + '”相关的结果'
        : '共 <b>' + items.length + '</b> 条信息';
      LF.ui.bindCards(listEl);
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

    apply();
    setTimeout(function () {
      const input = LF.$('#searchKw');
      if (input) input.focus();
    }, 80);
  }

  LF.views = LF.views || {};
  LF.views.search = { render: render };
})();
