/* ==========================================================================
   校园失物招领 · 发布视图 (views/publish.js)
   说明：发布寻物 / 招领信息；传入 editId 时进入编辑模式复用同一表单。
   ========================================================================== */
window.LF = window.LF || {};

(function () {
  const LF = window.LF;

  function toLocalInput(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) return toLocalInput();
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function render(editId) {
    const editing = editId ? LF.store.getItem(editId) : null;
    const isEdit = !!editing;
    const item = editing || {
      type: 'lost', name: '', category: '', time: '', location: '',
      description: '', image: '', contact: '', nickname: ''
    };

    const container = LF.$('#view');
    container.innerHTML =
      '<div class="page page-publish">' +
        LF.ui.headerHTML(isEdit ? '编辑信息' : '发布信息', true) +
        '<div class="form">' +
          '<div class="publish-tip"' + (isEdit ? ' style="display:none"' : '') + '>' +
            LF.icon('info') + '<span>请如实填写物品信息，方便失主或拾获者尽快联系到你。发布后可在「我的发布」中管理。</span>' +
          '</div>' +
          '<div class="form-card" style="margin-top:12px">' +
            '<div class="form-group">' +
              '<div class="form-label">信息类型 <span class="req">*</span></div>' +
              '<div class="type-switch">' +
                '<button class="type-switch__item lost' + (item.type === 'lost' ? ' active' : '') + '" data-type="lost"><span class="type-switch__icon">🔍</span>我要寻物</button>' +
                '<button class="type-switch__item found' + (item.type === 'found' ? ' active' : '') + '" data-type="found"><span class="type-switch__icon">🙌</span>我已拾获</button>' +
              '</div>' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">物品名称 <span class="req">*</span></div>' +
              '<input class="form-input" id="f-name" placeholder="例如：校园卡、蓝色雨伞…" value="' + LF.escapeHtml(item.name) + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">物品类别 <span class="req">*</span></div>' +
              '<div class="chips" id="f-cats">' +
                LF.CATEGORIES.map(function (c) {
                  return '<button class="chip' + (item.category === c.value ? ' active' : '') + '" data-cat="' + LF.escapeHtml(c.value) + '">' + c.emoji + ' ' + LF.escapeHtml(c.value) + '</button>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">时间 <span class="req">*</span></div>' +
              '<input class="form-input" id="f-time" type="datetime-local" value="' + LF.escapeHtml(toLocalInput(item.time)) + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">地点 <span class="req">*</span></div>' +
              '<input class="form-input" id="f-location" list="loc-list" placeholder="例如：图书馆二楼、三教 301…" value="' + LF.escapeHtml(item.location) + '">' +
              '<datalist id="loc-list">' + LF.LOCATIONS.map(function (l) { return '<option value="' + LF.escapeHtml(l) + '">'; }).join('') + '</datalist>' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">物品描述</div>' +
              '<textarea class="form-input" id="f-desc" placeholder="补充物品外观、特征、丢失/拾取经过等，方便辨认">' + LF.escapeHtml(item.description) + '</textarea>' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">物品图片</div>' +
              '<div class="uploader">' +
                '<div class="uploader__box" id="f-upload"' + (item.image ? ' style="display:none"' : '') + '>' + LF.icon('image') + '<span>上传图片</span></div>' +
                '<div class="uploader__preview" id="f-preview"' + (item.image ? '' : ' style="display:none"') + '>' +
                  '<img id="f-preview-img" src="' + LF.escapeHtml(item.image) + '" alt="预览">' +
                  '<button class="uploader__remove" id="f-remove" type="button">' + LF.icon('close') + '</button>' +
                '</div>' +
                '<div class="uploader__tip">支持 JPG/PNG，自动压缩后保存在本地浏览器</div>' +
              '</div>' +
              '<input type="file" id="f-file" accept="image/*" style="display:none">' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">联系方式 <span class="req">*</span></div>' +
              '<input class="form-input" id="f-contact" placeholder="手机号 / 微信号 / QQ号" value="' + LF.escapeHtml(item.contact) + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<div class="form-label">发布者昵称</div>' +
              '<input class="form-input" id="f-nickname" placeholder="默认：匿名同学" value="' + LF.escapeHtml(item.nickname) + '">' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="publish-submit">' +
          '<button class="btn btn--primary btn--block" id="f-submit">' + (isEdit ? '保存修改' : '发布') + '</button>' +
        '</div>' +
      '</div>';

    const state = { type: item.type, category: item.category, image: item.image };

    // 类型切换
    const typeBtns = LF.$$('.type-switch__item');
    typeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.type = btn.getAttribute('data-type');
        typeBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
      });
    });

    // 类别选择
    LF.$('#f-cats').addEventListener('click', function (e) {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      state.category = btn.getAttribute('data-cat');
      LF.$$('#f-cats .chip').forEach(function (b) { b.classList.toggle('active', b === btn); });
    });

    // 图片上传
    function setImage(dataUrl) {
      state.image = dataUrl;
      LF.$('#f-upload').style.display = dataUrl ? 'none' : '';
      LF.$('#f-preview').style.display = dataUrl ? '' : 'none';
      if (dataUrl) LF.$('#f-preview-img').src = dataUrl;
    }

    LF.$('#f-upload').addEventListener('click', function () { LF.$('#f-file').click(); });
    LF.$('#f-file').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      LF.ui.toast('正在处理图片…');
      LF.compressImage(file, 900, 0.72)
        .then(function (dataUrl) {
          setImage(dataUrl);
          LF.ui.toast('图片已添加', 'success');
        })
        .catch(function () {
          LF.ui.toast('图片处理失败，请重试', 'error');
        });
      e.target.value = '';
    });
    LF.$('#f-remove').addEventListener('click', function () { setImage(''); });

    // 提交
    LF.$('#f-submit').addEventListener('click', submit);

    async function submit() {
      const name = LF.$('#f-name').value.trim();
      const time = LF.$('#f-time').value;
      const locationText = LF.$('#f-location').value.trim();
      const description = LF.$('#f-desc').value.trim();
      const contact = LF.$('#f-contact').value.trim();
      const nickname = LF.$('#f-nickname').value.trim() || '匿名同学';

      if (!name) return LF.ui.toast('请填写物品名称', 'error');
      if (!state.category) return LF.ui.toast('请选择物品类别', 'error');
      if (!time) return LF.ui.toast('请选择时间', 'error');
      if (!locationText) return LF.ui.toast('请填写地点', 'error');
      if (!contact) return LF.ui.toast('请填写联系方式', 'error');

      const timeISO = new Date(time).toISOString();
      const btn = LF.$('#f-submit');
      btn.disabled = true;
      btn.textContent = isEdit ? '保存中…' : '发布中…';

      try {
        if (isEdit) {
          await LF.store.updateItem(editId, {
            type: state.type, name: name, category: state.category, time: timeISO,
            location: locationText, description: description, image: state.image,
            contact: contact, nickname: nickname
          });
          LF.ui.toast('修改成功', 'success');
          setTimeout(function () { location.hash = '#/detail/' + editId; }, 450);
        } else {
          const newItem = await LF.store.addItem({
            id: LF.uid(), type: state.type, name: name, category: state.category, time: timeISO,
            location: locationText, description: description, image: state.image,
            contact: contact, nickname: nickname,
            status: 'open', deviceId: LF.store.getDeviceId(), createdAt: Date.now()
          });
          LF.ui.modal({
            icon: '🎉',
            title: '发布成功',
            text: '你的信息已发布，其他同学可以在首页看到它。',
            okText: '查看详情',
            cancelText: '返回首页'
          }).then(function (ok) {
            if (ok) location.hash = '#/detail/' + newItem.id;
            else location.hash = '#/';
          });
        }
      } catch (e) {
        LF.ui.toast(e.message || '操作失败，请重试', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? '保存修改' : '发布';
      }
    }
  }

  LF.views = LF.views || {};
  LF.views.publish = { render: render };
})();
