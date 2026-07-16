/**
 * AsiaPower — TikTok bio-link hub: tags the WhatsApp CTA with a TikTok-specific
 * prefilled message so Zijing/Longhui can see the lead came from TikTok without
 * asking the customer to re-type what they already said in the video.
 */
(function () {
  'use strict';

  function videoRef() {
    const params = new URLSearchParams(window.location.search);
    return params.get('utm_content') || params.get('v') || '';
  }

  function tiktokMessage() {
    const base = window.ASIAPOWER?.whatsappTiktokMessage
      || 'Hello AsiaPower (from TikTok), I need export quote. Product: __ Brand/Model: __ Qty: __ Destination port: __';
    const ref = videoRef();
    return ref ? `${base}\nVideo: ${ref}` : base;
  }

  function bind() {
    const btn = document.getElementById('tiktok-wa-primary');
    if (!btn || !window.WhatsAppCrm) return;
    btn.href = window.WhatsAppCrm.buildUrl(tiktokMessage());
    const sub = btn.querySelector('.tiktok-hub__btn-sub');
    if (sub) {
      const display = window.ASIAPOWER?.whatsappDisplayNumber || '+86 166 3880 1930';
      sub.textContent = `${display} · Reply within 24h`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
