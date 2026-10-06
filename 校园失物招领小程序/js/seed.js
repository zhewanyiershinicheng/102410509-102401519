/* ==========================================================================
   校园失物招领 · 示例数据 (seed.js)
   说明：首次打开时向空数据中写入若干示例信息，便于直接体验浏览/搜索/详情。
         示例数据的 deviceId 为 'demo'，不会出现在“我的发布”中。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;
  const SEED_KEY = 'lf_seeded_v1';

  function hasSeeded() {
    try { return localStorage.getItem(SEED_KEY) === '1'; } catch (e) { return false; }
  }

  function seedIfEmpty() {
    if (hasSeeded()) return;

    if (LF.store.getItems().length === 0) {
      const now = Date.now();
      const hour = 60 * 60 * 1000;
      const day = 24 * hour;
      const at = function (ms) { return new Date(now - ms).toISOString(); };

      const demo = [
        {
          id: 'demo-1', type: 'found', name: '校园卡（李同学）', category: '校园卡',
          time: at(2 * hour), location: '图书馆 二楼自习区',
          description: '在图书馆二楼自习区靠窗座位旁捡到一张校园卡，卡面姓名“李同学”，请失主看到后联系我认领。',
          image: '', contact: '13800001234', nickname: '拾金不昧的小王',
          status: 'open', deviceId: 'demo', createdAt: now - 2 * hour
        },
        {
          id: 'demo-2', type: 'lost', name: '蓝色折叠雨伞', category: '雨伞',
          time: at(5 * hour), location: '第三教学楼 301 教室',
          description: '今天上午在 301 教室上课后忘记拿走，蓝色格纹折叠伞，伞把上有一个黄色挂绳，捡到的同学麻烦联系我，谢谢！',
          image: '', contact: 'wxid_lan_yu', nickname: '丢了伞的小张',
          status: 'open', deviceId: 'demo', createdAt: now - 5 * hour
        },
        {
          id: 'demo-3', type: 'found', name: '白色 AirPods 耳机', category: '耳机',
          time: at(1 * day), location: '运动场 跑道旁',
          description: '晚上跑步时在跑道旁捡到一只白色无线耳机，已放在运动场值班室，请失主带购买凭证前往认领。',
          image: '', contact: '15600001111', nickname: '夜跑的同学',
          status: 'resolved', deviceId: 'demo', createdAt: now - 1 * day
        },
        {
          id: 'demo-4', type: 'lost', name: '《高等数学》教材', category: '书籍',
          time: at(2 * day), location: '第一食堂 一楼',
          description: '封面写着“计科 2203 班”，书里夹着几页课堂笔记，对我很重要，麻烦捡到的同学联系我，非常感谢！',
          image: '', contact: 'QQ: 123456789', nickname: '爱学习的小李',
          status: 'open', deviceId: 'demo', createdAt: now - 2 * day
        },
        {
          id: 'demo-5', type: 'found', name: '一串钥匙', category: '钥匙',
          time: at(3 * day), location: '宿舍区 3 号楼门口',
          description: '宿舍区 3 号楼门口捡到一串钥匙，共有三把，钥匙扣是一个小熊造型，请失主联系认领。',
          image: '', contact: '13866667777', nickname: '热心宿管阿姨',
          status: 'closed', deviceId: 'demo', createdAt: now - 3 * day
        },
        {
          id: 'demo-6', type: 'lost', name: '黑色保温水杯', category: '水杯',
          time: at(4 * day), location: '篮球场 东侧看台',
          description: '黑色磨砂保温杯，杯身有轻微划痕，看台观赛时落下，捡到的同学请联系我，谢谢！',
          image: '', contact: '13855556666', nickname: '打球的小赵',
          status: 'resolved', deviceId: 'demo', createdAt: now - 4 * day
        },
        {
          id: 'demo-7', type: 'found', name: '红米手机', category: '电子设备',
          time: at(5 * day), location: '图书馆 一楼大厅',
          description: '在图书馆一楼大厅座椅上捡到一部红米手机，已交到图书馆服务台，请失主前往服务台认领。',
          image: '', contact: '图书馆服务台', nickname: '图书馆管理员',
          status: 'open', deviceId: 'demo', createdAt: now - 5 * day
        },
        {
          id: 'demo-8', type: 'lost', name: '学生卡套（含门禁卡）', category: '其他',
          time: at(6 * day), location: '第二食堂 二楼',
          description: '深蓝色卡套，里面有门禁卡和一张公交卡，对我日常出行很重要，捡到的同学麻烦尽快联系我，必有感谢！',
          image: '', contact: '13844445555', nickname: '着急的小陈',
          status: 'open', deviceId: 'demo', createdAt: now - 6 * day
        }
      ];

      const items = LF.store.getItems().concat(demo);
      LF.store.saveItems(items);
    }

    try { localStorage.setItem(SEED_KEY, '1'); } catch (e) { /* 忽略 */ }
  }

  LF.seed = { seedIfEmpty: seedIfEmpty };
})();
