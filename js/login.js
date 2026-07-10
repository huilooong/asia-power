(function () {
  const toastEl = document.getElementById('toast');
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(window.__loginToast);
    window.__loginToast = setTimeout(() => toastEl.classList.remove('on'), 3200);
  }

  const params = new URLSearchParams(location.search);
  const initialRole = params.get('role') === 'supplier' ? 'supplier' : 'buyer';
  const modeParam = params.get('mode') || '';
  // OTP modes redirected to password (SMS UI hidden)
  const initialBuyerMode = modeParam === 'register' ? 'register' : 'password';
  const initialSupplierMode = modeParam === 'register' ? 'register'
    : modeParam === 'set-password' || modeParam === 'set' ? 'set-password'
      : 'password';
  if (params.get('error')) toast(params.get('error'));

  let oauthDemo = true;

  function setRole(role) {
    document.querySelectorAll('.role-tab').forEach((btn) => {
      const on = btn.dataset.role === role;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('buyer-pane').classList.toggle('on', role === 'buyer');
    document.getElementById('supplier-pane').classList.toggle('on', role === 'supplier');
    const title = document.getElementById('login-title');
    const lead = document.getElementById('login-lead');
    if (title) title.textContent = role === 'supplier' ? '供应商登录 / 注册' : '采购商登录';
    if (lead) {
      lead.textContent = role === 'supplier'
        ? '可用手机号+密码登录或设密；新供应商须注册。历史上传按手机号带出，不丢车。短信验证码暂隐藏。'
        : (oauthDemo
          ? '可用 Google 测试登录或手机号+密码。短信验证码暂隐藏。Google 未配官方密钥时为站内测试。'
          : '采购商可用 Google 或手机号+密码。短信验证码暂隐藏。游客仍可浏览询价。');
    }
    const url = new URL(location.href);
    url.searchParams.set('role', role);
    history.replaceState({}, '', url);
  }

  function setBuyerMode(mode) {
    const safe = mode === 'register' ? 'register' : 'password';
    document.querySelectorAll('[data-buyer-mode]').forEach((b) => b.classList.toggle('on', b.dataset.buyerMode === safe));
    const pw = document.getElementById('buyer-password-box');
    const reg = document.getElementById('buyer-register-box');
    const otp = document.getElementById('buyer-otp-box');
    if (pw) pw.hidden = safe !== 'password';
    if (reg) reg.hidden = safe !== 'register';
    if (otp) otp.hidden = true;
    const url = new URL(location.href);
    if (safe === 'password') url.searchParams.delete('mode');
    else url.searchParams.set('mode', safe);
    history.replaceState({}, '', url);
  }

  function setSupplierMode(mode) {
    const allowed = new Set(['password', 'set-password', 'register']);
    const safe = allowed.has(mode) ? mode : 'password';
    document.querySelectorAll('#supplier-pane .mini-tab[data-mode]').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === safe);
    });
    const map = {
      password: 'supplier-password-box',
      'set-password': 'supplier-set-password-box',
      login: 'supplier-login-box',
      register: 'supplier-register-box',
    };
    Object.entries(map).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (key === 'login') {
        el.hidden = true;
        return;
      }
      el.hidden = key !== safe;
    });
    const url = new URL(location.href);
    if (safe === 'password') url.searchParams.delete('mode');
    else url.searchParams.set('mode', safe);
    history.replaceState({}, '', url);
  }

  document.querySelectorAll('.role-tab').forEach((btn) => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
  });
  setRole(initialRole);

  document.querySelectorAll('[data-buyer-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setBuyerMode(btn.dataset.buyerMode));
  });
  document.querySelectorAll('#supplier-pane .mini-tab[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setSupplierMode(btn.dataset.mode));
  });

  if (initialRole === 'buyer') setBuyerMode(initialBuyerMode);
  else setSupplierMode(initialSupplierMode);

  function requireFields(pairs) {
    const missing = pairs.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
    if (missing.length) {
      toast(`请填写：${missing.join('、')}`);
      return false;
    }
    return true;
  }

  function applyOAuthProviderUi(info) {
    const googleConfigured = Boolean(info?.google?.configured);
    oauthDemo = !googleConfigured;
    const banner = document.getElementById('oauth-banner');
    const gBtn = document.getElementById('btn-google');

    if (gBtn) {
      gBtn.innerHTML = googleConfigured
        ? '<span class="oauth-icon" aria-hidden="true">G</span> Continue with Google'
        : '<span class="oauth-icon" aria-hidden="true">G</span> Google 测试登录';
    }

    if (banner) {
      if (googleConfigured) {
        banner.hidden = true;
        banner.innerHTML = '';
      } else {
        banner.hidden = false;
        banner.innerHTML = 'Google <strong>尚未接入官方账号</strong>（意思是：点按钮会用站内测试登录）。也可用<strong>手机号+密码</strong>。短信验证码暂隐藏。';
      }
    }
    setRole(document.querySelector('.role-tab.on')?.dataset?.role || initialRole);
  }

  fetch('/api/auth/oauth/providers', { credentials: 'include' })
    .then((r) => r.json())
    .then(applyOAuthProviderUi)
    .catch(() => applyOAuthProviderUi({ demoMode: true }));

  async function startOAuth(provider) {
    const next = params.get('next') || '/buyer-portal/';
    const res = await fetch(`/api/auth/oauth/start?provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`, {
      credentials: 'include',
    }).then((r) => r.json()).catch(() => ({ error: 'Network error' }));
    if (res.error) return toast(res.error);
    if (res.url) {
      if (res.demo) toast('正在进入测试登录…');
      location.href = res.url;
      return;
    }
    toast('OAuth start failed');
  }

  document.getElementById('btn-google').addEventListener('click', () => startOAuth('google'));

  // —— Buyer password login ——
  document.getElementById('buyer-pw-login').addEventListener('click', async () => {
    const body = {
      phone: document.getElementById('buyer-pw-phone').value.trim(),
      countryCode: document.getElementById('buyer-pw-cc').value,
      password: document.getElementById('buyer-pw-password').value,
      role: 'buyer',
    };
    if (!requireFields([['手机号', body.phone], ['密码', body.password]])) return;
    const res = await fetch('/api/auth/phone/password/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ error: 'Network error' }));
    if (res.needsRegistration || res.needsPasswordSetup) {
      toast(res.error || '请先注册');
      setBuyerMode('register');
      return;
    }
    if (res.error) return toast(res.error);
    toast('登录成功');
    location.href = params.get('next') || '/buyer-portal/';
  });

  // —— Buyer register (phone + password only; SMS OTP hidden) ——
  document.getElementById('buyer-reg-submit').addEventListener('click', async () => {
    const body = {
      phone: document.getElementById('buyer-reg-phone').value.trim(),
      countryCode: document.getElementById('buyer-reg-cc').value,
      password: document.getElementById('buyer-reg-password').value,
      passwordConfirm: document.getElementById('buyer-reg-password2').value,
      email: document.getElementById('buyer-reg-email').value.trim(),
      name: document.getElementById('buyer-reg-name').value.trim(),
      company: document.getElementById('buyer-reg-name').value.trim(),
    };
    if (!requireFields([
      ['手机号', body.phone],
      ['密码', body.password],
      ['确认密码', body.passwordConfirm],
    ])) return;
    if (body.password !== body.passwordConfirm) return toast('两次密码不一致');
    if (body.password.length < 8) return toast('密码至少 8 位');
    const btn = document.getElementById('buyer-reg-submit');
    btn.disabled = true;
    const res = await fetch('/api/auth/phone/password/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ error: 'Network error' }));
    btn.disabled = false;
    if (res.error) return toast(res.error);
    toast('注册成功');
    location.href = params.get('next') || '/buyer-portal/';
  });

  // —— Buyer OTP (hidden; keep handlers if markup re-enabled later) ——
  const buyerSendOtp = document.getElementById('buyer-send-otp');
  const buyerLoginOtp = document.getElementById('buyer-login');
  if (buyerSendOtp) {
    buyerSendOtp.addEventListener('click', () => toast('短信验证码暂隐藏，请用手机号+密码或 Google'));
  }
  if (buyerLoginOtp) {
    buyerLoginOtp.addEventListener('click', () => toast('短信验证码暂隐藏，请用手机号+密码或 Google'));
  }

  // —— Supplier password login ——
  document.getElementById('sup-pw-login').addEventListener('click', async () => {
    const body = {
      phone: document.getElementById('sup-pw-phone').value.trim(),
      countryCode: document.getElementById('sup-pw-cc').value,
      password: document.getElementById('sup-pw-password').value,
      role: 'supplier',
    };
    if (!requireFields([['手机号', body.phone], ['密码', body.password]])) return;
    const res = await fetch('/api/auth/phone/password/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ error: 'Network error' }));
    if (res.needsPasswordSetup) {
      toast(res.error || '请先设密');
      setSupplierMode('set-password');
      document.getElementById('sup-set-phone').value = body.phone;
      document.getElementById('sup-set-cc').value = body.countryCode;
      const hint = document.getElementById('sup-set-hint');
      if (hint && res.uploadCount) {
        hint.innerHTML = `检测到该手机号有 <strong>${res.uploadCount}</strong> 条历史上传，设密后可登录查看（无需短信）。`;
      }
      return;
    }
    if (res.error) return toast(res.error);
    location.href = res.needsProfile
      ? '/supplier-portal/dashboard.html?complete=1'
      : (params.get('next') || '/supplier-portal/dashboard.html');
  });

  // —— Supplier set password (no SMS; phone must match account or uploads) ——
  document.getElementById('sup-set-submit').addEventListener('click', async () => {
    const body = {
      phone: document.getElementById('sup-set-phone').value.trim(),
      countryCode: document.getElementById('sup-set-cc').value,
      password: document.getElementById('sup-set-password').value,
      passwordConfirm: document.getElementById('sup-set-password2').value,
      role: 'supplier',
    };
    if (!requireFields([
      ['手机号', body.phone],
      ['密码', body.password],
      ['确认密码', body.passwordConfirm],
    ])) return;
    if (body.password !== body.passwordConfirm) return toast('两次密码不一致');
    if (body.password.length < 8) return toast('密码至少 8 位');
    const btn = document.getElementById('sup-set-submit');
    btn.disabled = true;
    const res = await fetch('/api/auth/phone/password/set', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ error: 'Network error' }));
    btn.disabled = false;
    if (res.needsRegistration) {
      toast(res.error || '请先注册');
      setSupplierMode('register');
      return;
    }
    if (res.error) return toast(res.error);
    toast('密码已设置，进入工作台');
    location.href = res.needsProfile
      ? '/supplier-portal/dashboard.html?complete=1'
      : (params.get('next') || '/supplier-portal/dashboard.html');
  });

  // —— Supplier OTP login (hidden) ——
  const supSendOtp = document.getElementById('sup-send-otp');
  const supLogin = document.getElementById('sup-login');
  if (supSendOtp) {
    supSendOtp.addEventListener('click', () => toast('短信验证码暂隐藏，请用密码登录或设密'));
  }
  if (supLogin) {
    supLogin.addEventListener('click', () => toast('短信验证码暂隐藏，请用密码登录或设密'));
  }

  // —— Supplier register (profile + password; no SMS) ——
  document.getElementById('reg-submit').addEventListener('click', async () => {
    const terms = document.getElementById('reg-terms');
    if (terms && !terms.checked) {
      toast('请勾选同意供应商标准');
      return;
    }
    const password = document.getElementById('reg-password')?.value || '';
    const passwordConfirm = document.getElementById('reg-password2')?.value || '';
    const body = {
      phone: document.getElementById('reg-phone').value.trim(),
      countryCode: document.getElementById('reg-cc').value,
      password,
      passwordConfirm,
      supplierName: document.getElementById('reg-company').value.trim(),
      businessType: document.getElementById('reg-business').value,
      contactPerson: document.getElementById('reg-contact').value.trim(),
      country: document.getElementById('reg-country').value,
      email: document.getElementById('reg-email').value.trim(),
      address: document.getElementById('reg-address').value.trim(),
      specialization: document.getElementById('reg-spec').value,
      brands: document.getElementById('reg-brands')?.value.trim() || '',
      monthlyCapacity: document.getElementById('reg-capacity')?.value || '',
    };
    if (!requireFields([
      ['手机号', body.phone],
      ['密码', body.password],
      ['确认密码', body.passwordConfirm],
      ['公司名称', body.supplierName],
      ['业务类型', body.businessType],
      ['联系人', body.contactPerson],
      ['国家', body.country],
      ['邮箱', body.email],
      ['经营地址', body.address],
      ['主营品类', body.specialization],
    ])) return;
    if (body.password !== body.passwordConfirm) return toast('两次密码不一致');
    if (body.password.length < 8) return toast('密码至少 8 位');

    const btn = document.getElementById('reg-submit');
    btn.disabled = true;
    const res = await fetch('/api/supplier/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ error: 'Network error' }));
    btn.disabled = false;

    if (res.error) {
      const missing = Array.isArray(res.missingFields)
        ? res.missingFields.map((f) => f.label || f.key || f).join('、')
        : '';
      toast(missing ? `${res.error}：${missing}` : res.error);
      const hint = document.getElementById('reg-hint');
      if (hint) hint.textContent = missing ? `缺少：${missing}` : res.error;
      return;
    }
    toast('注册成功，进入供应商工作台');
    location.href = params.get('next') || '/supplier-portal/dashboard.html';
  });

  fetch('/api/me', { credentials: 'include' })
    .then((r) => r.json())
    .then((me) => {
      if (!me.user) return;
      const panel = document.getElementById('session-panel');
      const label = document.getElementById('session-label');
      const go = document.getElementById('session-continue');
      const out = document.getElementById('session-logout');
      if (!panel || !label || !go) return;
      const name = me.user.name || me.user.company || me.user.email || me.user.phone || me.user.username || me.user.role;
      label.textContent = `已登录：${name}（${me.user.role === 'supplier' ? '供应商' : '采购商'}）`;
      const dest = me.user.role === 'supplier'
        ? (me.needsProfile ? '/supplier-portal/dashboard.html?complete=1' : '/supplier-portal/dashboard.html')
        : (params.get('next') || '/buyer-portal/');
      go.href = dest;
      panel.hidden = false;
      if (out) {
        out.onclick = async () => {
          await fetch('/api/logout', { method: 'POST', credentials: 'include' });
          location.reload();
        };
      }
      if (initialRole === 'supplier' && initialSupplierMode === 'register') return;
      if (initialRole === 'buyer' && initialBuyerMode === 'register') return;
      if (params.get('stay') === '1') return;
    })
    .catch(() => {});
})();
