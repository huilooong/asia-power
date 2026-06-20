/**
 * AsiaPower — Half-cut enquiry lead capture before WhatsApp
 */
(function () {
  'use strict';

  function openWhatsApp(text) {
    const c = window.ASIAPOWER || {};
    if (!c.whatsapp) return;
    const url = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(text)}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
  }

  function messageForIntent(item, intent) {
    const u = window.HalfCutUtils;
    if (!u || !item) return 'Hello AsiaPower, I would like to enquire about a half-cut listing.';
    if (intent === 'photos') return u.photosMessage(item);
    if (intent === 'similar') return u.similarUnitMessage(item);
    if (intent === 'availability') return u.whatsappMessage(item);
    return u.whatsappMessage(item);
  }

  function buildPayload(item, intent) {
    return {
      slug: item.slug,
      stockId: item.stockId,
      intent,
      brand: item.brand,
      model: item.model,
      engineCode: item.engineCode,
      transmissionCode: item.transmissionCode,
      listingStatus: item.status,
      page: `${window.location.pathname}${window.location.search}`,
    };
  }

  async function saveHalfCutLead(item, intent) {
    const res = await fetch('/api/leads/half-cut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(item, intent)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save enquiry');
    return data;
  }

  function toast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
      return;
    }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:96px;right:24px;z-index:10001;background:#0a1628;color:#fff;padding:14px 20px;border-radius:6px;font-size:.88rem;max-width:320px;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  async function handleHalfCutLeadClick(event) {
    const btn = event.target.closest('[data-half-cut-lead]');
    if (!btn) return;
    event.preventDefault();

    const slug = btn.dataset.slug;
    const intent = btn.dataset.intent || 'price';
    const item = window.getHalfCutBySlug?.(slug);
    if (!item) {
      toast('Listing unavailable. Please contact us on WhatsApp.');
      return;
    }

    const original = btn.textContent;
    btn.setAttribute('aria-busy', 'true');
    if (btn.tagName === 'BUTTON') btn.disabled = true;

    let leadId = null;
    try {
      const saved = await saveHalfCutLead(item, intent);
      leadId = saved?.id || null;
    } catch (err) {
      console.warn('[half-cut-lead]', err);
      toast('Could not save on server. Please still send the WhatsApp message.');
    }

    let text = messageForIntent(item, intent);
    if (leadId) text += `\n\nReference: ${leadId}`;
    openWhatsApp(text);

    btn.removeAttribute('aria-busy');
    if (btn.tagName === 'BUTTON') btn.disabled = false;
    if (original) btn.textContent = original;
  }

  document.addEventListener('click', handleHalfCutLeadClick);

  window.HalfCutLeads = {
    saveHalfCutLead,
    messageForIntent,
  };
})();
