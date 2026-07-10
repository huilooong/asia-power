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
    return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
  }

  function renderOrders(orders) {
    rows.innerHTML = (orders || []).length
      ? orders.map((o) => {
        const canPay = o.status === 'Quoted';
        const action = canPay
          ? `<button class="btn btn-gold" data-pay="${o.id}">Pay Deposit</button>`
          : o.status === 'DepositPaid'
            ? '<span class="muted">Reserved</span>'
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
      : '<tr><td colspan="6" class="muted">No orders yet. Sales will create a quote order for you.</td></tr>';

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
      toast('Demo deposit paid · stock reserved');
      await loadOrders();
      return;
    }
    if (res.session?.url) {
      location.href = res.session.url;
      return;
    }
    toast('Checkout session created');
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
      document.getElementById('buyer-name').textContent = me.user.name || me.user.company || me.user.email || me.user.username || 'Buyer';
      const meta = [
        me.user.email,
        me.user.phoneNormalized || me.user.phone,
        me.user.oauthProvider ? `via ${me.user.oauthProvider}` : me.user.authMethod,
        me.user.loginCount ? `${me.user.loginCount} logins` : '',
      ].filter(Boolean).join(' · ');
      const metaEl = document.getElementById('buyer-meta');
      if (metaEl) metaEl.textContent = meta;
      if (params.get('deposit') === 'success') {
        document.getElementById('deposit-banner').textContent = 'Deposit payment received (or demo completed).';
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
