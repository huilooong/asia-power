(function () {
  const toastEl = document.getElementById('toast');
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(window.__t);
    window.__t = setTimeout(() => toastEl.classList.remove('on'), 2800);
  }

  const profilePanel = document.getElementById('profile-panel');
  const dash = document.getElementById('dash');
  const editPanel = document.getElementById('edit-panel');
  const rows = document.getElementById('upload-rows');
  const loginCta = document.querySelector('.hero-mini .actions');
  let currentUser = null;
  let profileMode = 'complete'; // complete | edit

  function badge(status) {
    if (status === 'approved') return '<span class="badge badge-green">已上线</span>';
    if (status === 'pending') return '<span class="badge badge-gold">待审</span>';
    if (status === 'rejected') return '<span class="badge badge-red">已拒</span>';
    return `<span class="badge badge-gray">${status || '—'}</span>`;
  }

  function showLoginPrompt() {
    if (loginCta) loginCta.hidden = false;
    if (profilePanel) profilePanel.hidden = true;
    if (dash) dash.hidden = true;
    if (editPanel) editPanel.hidden = true;
  }

  function fillProfileForm(user) {
    document.getElementById('prof-company').value = user.supplierName || '';
    document.getElementById('prof-business').value = user.businessType || '';
    document.getElementById('prof-contact').value = user.contactPerson || '';
    document.getElementById('prof-country').value = user.country || '';
    document.getElementById('prof-email').value = user.email || '';
    document.getElementById('prof-address').value = user.address || '';
    document.getElementById('prof-spec').value = user.specialization || '';
    document.getElementById('prof-brands').value = user.brands || '';
    document.getElementById('prof-wechat').value = user.wechat || '';
    document.getElementById('prof-city').value = user.city || '';
  }

  function showProfile(user, mode = 'complete') {
    profileMode = mode;
    currentUser = user;
    if (loginCta) loginCta.hidden = true;
    dash.hidden = true;
    editPanel.hidden = true;
    profilePanel.hidden = false;
    const missing = (user.missingFields || []).map((f) => f.label).join('、');
    document.getElementById('profile-sub').textContent = mode === 'edit'
      ? '修改公司资料后保存'
      : (missing ? `还缺：${missing}` : '请确认并保存资料');
    document.getElementById('save-profile').textContent = mode === 'edit' ? '保存公司资料' : '保存并进入工作台';
    fillProfileForm(user);
  }

  function showDash() {
    if (loginCta) loginCta.hidden = true;
    profilePanel.hidden = true;
    editPanel.hidden = true;
    dash.hidden = false;
  }

  function showEdit(item) {
    dash.hidden = true;
    profilePanel.hidden = true;
    editPanel.hidden = false;
    document.getElementById('edit-id').value = item.stockId || item.submissionId || item.id;
    document.getElementById('edit-sub').textContent =
      `${item.stockId || item.submissionId || item.id} · ${item.reviewStatus || ''} · 只能改自己的货`;
    document.getElementById('edit-brand').value = item.brand || '';
    document.getElementById('edit-model').value = item.model || '';
    document.getElementById('edit-year').value = item.year || '';
    document.getElementById('edit-price').value = item.priceUsd ?? '';
    document.getElementById('edit-engine').value = item.engineCode || '';
    document.getElementById('edit-trans').value = item.transmissionCode || '';
    document.getElementById('edit-drive').value = item.drivetrain || '';
    document.getElementById('edit-mileage').value = item.mileage ?? '';
    document.getElementById('edit-status').value = item.inventoryStatus || 'Available';
    document.getElementById('edit-desc').value = item.shortDescription || '';
    document.getElementById('edit-notes').value = item.notes || '';
  }

  function renderUploads(payload) {
    const items = payload.items || [];
    const counts = payload.counts || {};
    document.getElementById('c-pending').textContent = counts.pending || 0;
    document.getElementById('c-live').textContent = counts.approved || 0;
    document.getElementById('c-rej').textContent = counts.rejected || 0;
    const s = payload.supplier || {};
    document.getElementById('sup-name').textContent = s.supplierName || '供应商';
    document.getElementById('sup-meta').textContent = `${s.phoneNormalized || s.phone || ''} · ${s.id || ''}`;
    rows.innerHTML = items.length
      ? items.map((u) => {
        const id = u.stockId || u.submissionId || u.id;
        return `<tr>
          <td class="stock">${id}</td>
          <td>${u.title || [u.brand, u.model].filter(Boolean).join(' ')}<div class="muted">${u.inventoryStatus || ''}</div></td>
          <td class="price">${u.priceUsd != null ? '$' + Number(u.priceUsd).toLocaleString() : '—'}</td>
          <td>${badge(u.reviewStatus)}</td>
          <td class="muted">${(u.updatedAt || u.createdAt || '').slice(0, 10)}</td>
          <td><button class="btn btn-ghost" type="button" data-edit="${id}">编辑</button></td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="6" class="muted">暂无上传记录。历史货需手机号匹配或运行归并脚本。</td></tr>';

    rows.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(btn.getAttribute('data-edit')));
    });
  }

  async function loadUploads() {
    const data = await fetch('/api/half-cuts/my-uploads', { credentials: 'include' }).then((r) => r.json());
    if (data.error) throw new Error(data.error);
    renderUploads(data);
  }

  async function openEdit(id) {
    const data = await fetch(`/api/half-cuts/my-uploads/${encodeURIComponent(id)}`, {
      credentials: 'include',
    }).then((r) => r.json());
    if (data.error) return toast(data.error);
    showEdit(data.item);
  }

  async function refreshMe() {
    const me = await fetch('/api/me', { credentials: 'include' }).then((r) => r.json());
    const user = me.user;
    currentUser = user;
    if (!user || (user.role !== 'supplier' && user.role !== 'admin')) {
      showLoginPrompt();
      return false;
    }
    if (user.role === 'admin') {
      showDash();
      await loadUploads();
      return true;
    }
    if (me.needsProfile || user.profileComplete === false) {
      showProfile(user, 'complete');
      return true;
    }
    showDash();
    await loadUploads();
    return true;
  }

  document.getElementById('save-profile').addEventListener('click', async () => {
    const body = {
      supplierName: document.getElementById('prof-company').value.trim(),
      businessType: document.getElementById('prof-business').value,
      contactPerson: document.getElementById('prof-contact').value.trim(),
      country: document.getElementById('prof-country').value,
      email: document.getElementById('prof-email').value.trim(),
      address: document.getElementById('prof-address').value.trim(),
      specialization: document.getElementById('prof-spec').value,
      brands: document.getElementById('prof-brands').value.trim(),
      wechat: document.getElementById('prof-wechat').value.trim(),
      city: document.getElementById('prof-city').value.trim(),
    };
    const res = await fetch('/api/supplier/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    if (res.error) return toast(res.error);
    toast('公司资料已保存');
    await refreshMe();
  });

  document.getElementById('edit-company-btn').addEventListener('click', () => {
    if (!currentUser) return;
    showProfile(currentUser, 'edit');
  });

  document.getElementById('edit-cancel').addEventListener('click', async () => {
    showDash();
    await loadUploads();
  });

  document.getElementById('edit-save').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    const body = {
      brand: document.getElementById('edit-brand').value.trim(),
      model: document.getElementById('edit-model').value.trim(),
      year: document.getElementById('edit-year').value,
      priceUsd: document.getElementById('edit-price').value,
      engineCode: document.getElementById('edit-engine').value.trim(),
      transmissionCode: document.getElementById('edit-trans').value.trim(),
      drivetrain: document.getElementById('edit-drive').value.trim(),
      mileage: document.getElementById('edit-mileage').value,
      inventoryStatus: document.getElementById('edit-status').value,
      shortDescription: document.getElementById('edit-desc').value.trim(),
      notes: document.getElementById('edit-notes').value.trim(),
    };
    const res = await fetch(`/api/half-cuts/my-uploads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    if (res.error) return toast(res.error);
    toast('商品详情已保存');
    showDash();
    await loadUploads();
  });

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    location.href = '/login/?role=supplier';
  }

  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('profile-logout').addEventListener('click', logout);

  refreshMe().catch(() => showLoginPrompt());
})();
