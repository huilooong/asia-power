window.AP_PORTAL_MOCK = {
  demoOtpBuyer: '123456',
  demoOtpSupplier: '888888',
  buyer: {
    id: 'buyer-demo-1',
    name: 'Lagos Motors Ltd',
    email: 'buyer@lagos-motors.ng',
  },
  supplier: {
    id: 'sup-qxb',
    name: '汽修宝',
    phone: '16638801930',
    countryCode: '+86',
  },
  orders: [
    {
      id: 'AP-ORD-2401',
      stockId: 'HC250127',
      title: 'Lexus LX570 Half-Cut',
      exwUsd: 5900,
      depositUsd: 1770,
      status: 'Quoted',
    },
    {
      id: 'AP-ORD-2398',
      stockId: 'HC250160',
      title: 'Toyota Land Cruiser 200',
      exwUsd: 4800,
      depositUsd: 1440,
      status: 'DepositPaid',
    },
    {
      id: 'AP-ORD-2380',
      stockId: 'HC250088',
      title: 'Nissan Patrol Y61',
      exwUsd: 3200,
      depositUsd: 960,
      status: 'Inquiry',
    },
  ],
  uploads: [
    {
      id: 'HC250511',
      title: 'Honda CR-V Half-Cut',
      priceUsd: 2100,
      status: 'approved',
      at: '2026-07-08',
    },
    {
      id: 'SUB-88421',
      title: 'Toyota Hilux Engine',
      priceUsd: 980,
      status: 'pending',
      at: '2026-07-09',
    },
    {
      id: 'HC250490',
      title: 'Isuzu NPR Cab',
      priceUsd: 3500,
      status: 'approved',
      at: '2026-07-05',
    },
    {
      id: 'SUB-88301',
      title: 'Mitsubishi Pajero',
      priceUsd: 1600,
      status: 'rejected',
      at: '2026-07-03',
    },
  ],
};

window.AP_toast = function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(window.__apToastTimer);
  window.__apToastTimer = setTimeout(() => el.classList.remove('on'), 2600);
};
