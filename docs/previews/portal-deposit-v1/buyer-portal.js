(function () {
  const M = window.AP_PORTAL_MOCK;
  const rows = document.getElementById('order-rows');
  const portal = document.getElementById('portal-body');
  const loginPanel = document.getElementById('login-panel');

  function statusBadge(status) {
    const map = {
      Inquiry: 'badge-gray',
      Quoted: 'badge-blue',
      DepositPaid: 'badge-green',
      Shipped: 'badge-gold',
      Settled: 'badge-green',
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
  }

  function renderOrders() {
    rows.innerHTML = M.orders.map((o) => {
      const canPay = o.status === 'Quoted';
      const action = canPay
        ? `<a class="btn btn-gold" href="deposit-flow-preview.html?order=${encodeURIComponent(o.id)}">Pay Deposit</a>`
        : o.status === 'DepositPaid'
          ? `<span class="muted">Reserved</span>`
          : `<span class="muted">Awaiting quote</span>`;
      return `<tr>
        <td class="stock">${o.id}</td>
        <td>${o.stockId}<div class="muted">${o.title}</div></td>
        <td class="price">$${o.exwUsd.toLocaleString()}</td>
        <td>$${o.depositUsd.toLocaleString()}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${action}</td>
      </tr>`;
    }).join('');
  }

  document.getElementById('send-otp').addEventListener('click', () => {
    document.getElementById('buyer-otp').value = M.demoOtpBuyer;
    window.AP_toast('Demo code filled: ' + M.demoOtpBuyer);
  });

  document.getElementById('buyer-login').addEventListener('click', () => {
    const otp = String(document.getElementById('buyer-otp').value || '').trim();
    if (otp !== M.demoOtpBuyer) {
      window.AP_toast('验证码错误（演示请用 123456）');
      return;
    }
    document.getElementById('buyer-name').textContent = M.buyer.name;
    portal.hidden = false;
    loginPanel.style.opacity = '0.55';
    renderOrders();
    window.AP_toast('已登录采购商门户（预览）');
  });

  document.getElementById('buyer-logout').addEventListener('click', () => {
    portal.hidden = true;
    loginPanel.style.opacity = '1';
    window.AP_toast('已退出');
  });
})();
