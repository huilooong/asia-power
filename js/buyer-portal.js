(function () {
  const toastEl = document.getElementById('toast');
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(window.__t);
    window.__t = setTimeout(() => toastEl.classList.remove('on'), 2800);
  }

  const loginGate = document.getElementById('login-gate');
  const portal = document.getElementById('portal');
  const rows = document.getElementById('order-rows');
  const params = new URLSearchParams(location.search);

  function badge(status) {
    const map = {
      Inquiry: 'badge-gray',
      Quoted: 'badge-blue',
      DepositPaid: 'badge-green',
      Shipped: 'badge-gold',
      Settled: 'badge-green',
      Cancelled: 'badge-red',
    };
    const labels = {
      Inquiry: '询价中',
      Quoted: '已报价',
      DepositPaid: '已付定金',
      Shipped: '已发运',
      Settled: '已结清',
      Cancelled: '已取消',
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${labels[status] || status}</span>`;
  }

  function renderOrders(orders) {
    rows.innerHTML = (orders || []).length
      ? orders.map((o) => {
        const canPay = o.status === 'Quoted';
        const action = canPay
          ? `<button class="btn btn-gold" data-pay="${o.id}">支付定金</button>`
          : o.status === 'DepositPaid'
            ? '<span class="muted">已锁定</span>'
            : '<span class="muted">—</span>';
        return `<tr>
          <td class="stock">${o.id}</td>
          <td>${o.stockId}<div class="muted">${o.title || ''}</div></td>
          <td class="price">$${Number(o.exwUsd).toLocaleString()}</td>
          <td>$${Number(o.depositUsd).toLocaleString()}</td>
          <td>${badge(o.status)}</td>
          <td>${action}</td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="6" class="muted">暂无订单。销售确认报价后会出现在这里。</td></tr>';

    rows.querySelectorAll('[data-pay]').forEach((btn) => {
      btn.addEventListener('click', () => payDeposit(btn.getAttribute('data-pay')));
    });
  }

  async function payDeposit(orderId) {
    const res = await fetch('/api/buyer/orders/deposit-session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, termsAccepted: true }),
    }).then((r) => r.json());
    if (res.error) return toast(res.error);
    if (res.session?.demo) {
      const done = await fetch('/api/buyer/orders/demo-complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      }).then((r) => r.json());
      if (done.error) return toast(done.error);
      toast('演示定金已支付 · 库存已锁定');
      await loadOrders();
      return;
    }
    if (res.session?.url) {
      location.href = res.session.url;
      return;
    }
    toast('已创建结账会话');
  }

  async function loadOrders() {
    const data = await fetch('/api/buyer/orders', { credentials: 'include' }).then((r) => r.json());
    if (data.error) throw new Error(data.error);
    renderOrders(data.orders || []);
  }

  async function refreshMe() {
    const me = await fetch('/api/me', { credentials: 'include' }).then((r) => r.json());
    if (me.user && (me.user.role === 'buyer' || me.user.role === 'admin')) {
      loginGate.hidden = true;
      portal.hidden = false;
      document.getElementById('buyer-name').textContent = me.user.name || me.user.company || me.user.email || me.user.username || '采购商';
      const provider = me.user.oauthProvider ? `通过 ${me.user.oauthProvider}` : me.user.authMethod;
      const logins = me.user.loginCount ? `登录 ${me.user.loginCount} 次` : '';
      const meta = [
        me.user.email,
        me.user.phoneNormalized || me.user.phone,
        provider,
        logins,
      ].filter(Boolean).join(' · ');
      const metaEl = document.getElementById('buyer-meta');
      if (metaEl) metaEl.textContent = meta;
      if (params.get('deposit') === 'success') {
        document.getElementById('deposit-banner').textContent = '定金已收到（或演示支付完成）。';
      }
      await loadOrders();
      return true;
    }
    loginGate.hidden = false;
    portal.hidden = true;
    return false;
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    location.href = '/login/?role=buyer';
  });

  refreshMe().catch(() => {
    loginGate.hidden = false;
    portal.hidden = true;
  });
})();
