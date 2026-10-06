/* ==========================================================================
   校园失物招领 · 首页视图 (views/home.js)
   说明：品牌头部 + 搜索入口 + 全部/寻物/招领筛选 + 最新信息列表。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;

  function render() {
    const filter = { type: 'all' };
    const container = LF.$('#view');
    container.innerHTML =
      '<div class="page page-home">' +
        '<div class="home-hero">' +
          '<div class="home-hero__logo"><img src="images/logo.svg" alt="校园失物招领 Logo"></div>' +
          '<div>' +
            '<div class="home-hero__title">校园失物招领</div>' +
            '<div class="home-hero__sub">让每一件遗失的物品都回家</div>' +
          '</div>' +
        '</div>' +
        '<div class="searchbar" data-go-search>' +
          LF.icon('search') +
          '<span class="searchbar__placeholder">搜索物品名称、地点或描述…</span>' +
        '</div>' +
        '<div class="home-filter">' +
          '<div class="segment" id="homeSegment">' +
            '<button class="segment__item active" data-filter="all">全部</button>' +
            '<button class="segment__item" data-filter="lost"><span class="segment__dot"></span>寻物</button>' +
            '<button class="segment__item" data-filter="found"><span class="segment__dot"></span>招领</button>' +
          '</div>' +
        '</div>' +
        '<div class="home-section-head">' +
          '<span class="home-section-head__title">最新信息</span>' +
          '<span class="home-section-head__count" id="homeCount"></span>' +
        '</div>' +
        '<div id="homeList"></div>' +
      '</div>';

    const listEl = LF.$('#homeList');

    function apply() {
      const items = LF.store.getItems()
        .filter(function (it) { return filter.type === 'all' || it.type === filter.type; })
        .sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
      listEl.innerHTML = LF.ui.listHTML(items);
      LF.$('#homeCount').textContent = '共 ' + items.length + ' 条';
      LF.ui.bindCards(listEl);
    }

    LF.$('#homeSegment').addEventListener('click', function (e) {
      const btn = e.target.closest('.segment__item');
      if (!btn) return;
      filter.type = btn.getAttribute('data-filter');
      const all = LF.$$('#homeSegment .segment__item');
      for (let i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
      apply();
    });

    LF.$('[data-go-search]').addEventListener('click', function () {
      location.hash = '#/search';
    });

    apply();
  }

  LF.views = LF.views || {};
  LF.views.home = { render: render };
})();
