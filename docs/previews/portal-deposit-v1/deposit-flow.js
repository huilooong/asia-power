(function () {
  const toast = window.AP_toast;
  const terms = document.getElementById('terms');
  const status = document.getElementById('flow-status');
  const steps = ['s1', 's2', 's3', 's4'].map((id) => document.getElementById(id));

  function setStep(n) {
    steps.forEach((el, i) => el.classList.toggle('on', i < n));
  }

  document.getElementById('pay-deposit').addEventListener('click', async () => {
    if (!terms.checked) {
      toast('请先勾选 B2B Terms');
      return;
    }
    status.textContent = 'Creating Stripe Checkout session…';
    setStep(1);
    await wait(500);
    status.textContent = 'Redirecting to Stripe (simulated)…';
    setStep(2);
    await wait(700);
    status.textContent = 'Webhook checkout.session.completed verified…';
    setStep(3);
    await wait(600);
    status.textContent = 'Order AP-ORD-2401 → DepositPaid · HC250127 → Reserved';
    setStep(4);
    toast('定金支付成功（预览模拟）');
  });

  document.getElementById('wa').addEventListener('click', () => {
    window.open('https://wa.me/8618603773077?text=' + encodeURIComponent('Hi AsiaPower, I want to reserve HC250127 with a deposit.'), '_blank');
  });

  document.getElementById('inquire').addEventListener('click', () => {
    toast('已保留询价路径（Guest 不强制支付）');
  });

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const params = new URLSearchParams(location.search);
  if (params.get('order')) {
    status.textContent = `Ready for order ${params.get('order')}`;
  }
})();
