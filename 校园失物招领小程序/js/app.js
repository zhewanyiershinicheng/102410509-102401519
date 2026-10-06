/* ==========================================================================
   校园失物招领 · 应用入口 (app.js)
   说明：基于 location.hash 的轻量路由，负责页面调度、底部导航、
         返回按钮与首次初始化（写入示例数据）。
   ========================================================================== */
(function () {
  const LF = window.LF;

  /* 解析路由：形如 #/ 、#/search 、#/publish 、#/publish/edit/xxx 、#/detail/xxx 、#/my */
  function parseRoute() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { path: parts[0] || '', params: parts.slice(1) };
  }

  function render() {
    const route = parseRoute();
    let tab = '';

    switch (route.path) {
      case 'search':
        LF.views.search.render();
        break;
      case 'publish':
        tab = 'publish';
        if (route.params[0] === 'edit') LF.views.publish.render(route.params[1]);
        else LF.views.publish.render();
        break;
      case 'detail':
        LF.views.detail.render(route.params[0]);
        break;
      case 'my':
        tab = 'my';
        LF.views.my.render();
        break;
      case '':
      case 'home':
      default:
        tab = 'home';
        LF.views.home.render();
        break;
    }

    LF.ui.setTabbar(tab);
    window.scrollTo(0, 0);
  }

  function buildTabbar() {
    const tabbar = document.getElementById('tabbar');
    tabbar.innerHTML =
      '<button class="tabbar__item active" data-tab="home">' + LF.icon('home') + '<span>首页</span></button>' +
      '<div class="tabbar__publish"><button class="tabbar__publish-btn" data-tab="publish" aria-label="发布">' + LF.icon('plus') + '</button></div>' +
      '<button class="tabbar__item" data-tab="my">' + LF.icon('user') + '<span>我的</span></button>';
  }

  function init() {
    LF.seed.seedIfEmpty();
    buildTabbar();

    window.addEventListener('hashchange', render);

    document.getElementById('tabbar').addEventListener('click', function (e) {
      const node = e.target.closest('[data-tab]');
      if (!node) return;
      const tab = node.getAttribute('data-tab');
      if (tab === 'home') location.hash = '#/';
      else if (tab === 'publish') location.hash = '#/publish';
      else if (tab === 'my') location.hash = '#/my';
    });

    // 返回按钮（事件委托，视图内 [data-back] 触发）
    document.getElementById('view').addEventListener('click', function (e) {
      const back = e.target.closest('[data-back]');
      if (back) {
        if (history.length > 1) history.back();
        else location.hash = '#/';
      }
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  LF.app = { render: render, parseRoute: parseRoute };
})();
