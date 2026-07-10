(function () {
  const M = window.AP_PORTAL_MOCK;
  const authGrid = document.getElementById('auth-grid');
  const profilePanel = document.getElementById('profile-panel');
  const dash = document.getElementById('dash');
  const rows = document.getElementById('upload-rows');
  const steps = ['step-auth', 'step-profile', 'step-dash'].map((id) => document.getElementById(id));

  function setStep(n) {
    steps.forEach((el, i) => el.classList.toggle('on', i < n));
  }

  function badge(status) {
    if (status === 'approved') return '<span class="badge badge-green">已上线</span>';
    if (status === 'pending') return '<span class="badge badge-gold">待审</span>';
    return '<span class="badge badge-red">已拒</span>';
  }

  function renderDash() {
    const list = M.uploads;
    document.getElementById('c-pending').textContent = list.filter((x) => x.status === 'pending').length;
    document.getElementById('c-live').textContent = list.filter((x) => x.status === 'approved').length;
    document.getElementById('c-rej').textContent = list.filter((x) => x.status === 'rejected').length;
    document.getElementById('sup-name').textContent = document.getElementById('company').value || M.supplier.name;
    rows.innerHTML = list.map((u) => `<tr>
      <td class="stock">${u.id}</td>
      <td>${u.title}</td>
      <td class="price">$${u.priceUsd.toLocaleString()}</td>
      <td>${badge(u.status)}</td>
      <td class="muted">${u.at}</td>
    </tr>`).join('');
  }

  document.getElementById('supplier-login').addEventListener('click', () => {
    const phone = String(document.getElementById('phone').value || '').replace(/\D/g, '');
    const otp = String(document.getElementById('otp').value || '').trim();
    if (phone !== M.supplier.phone) {
      window.AP_toast('演示请用手机号 16638801930');
      return;
    }
    if (otp !== M.demoOtpSupplier) {
      window.AP_toast('验证码错误（演示请用 888888）');
      return;
    }
    authGrid.hidden = true;
    profilePanel.hidden = false;
    setStep(2);
    window.AP_toast('老账号：请先补全资料');
  });

  document.getElementById('save-profile').addEventListener('click', () => {
    const required = ['company', 'business', 'contact', 'country', 'email', 'address', 'spec'];
    for (const id of required) {
      if (!String(document.getElementById(id).value || '').trim()) {
        window.AP_toast('请填完所有必填项');
        return;
      }
    }
    profilePanel.hidden = true;
    dash.hidden = false;
    setStep(3);
    renderDash();
    window.AP_toast('资料已保存 · 进入我的上传');
  });
})();
