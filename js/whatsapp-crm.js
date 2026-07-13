/**
 * AsiaPower — WhatsApp CTA helpers (open with reference, structured URLs)
 */
(function () {
  'use strict';

  function waNumber() {
    return String(window.ASIAPOWER?.whatsapp || '8616638801930').replace(/\D/g, '');
  }

  function appendReference(text, leadId) {
    const body = String(text || '').trim();
    if (!leadId || body.includes(leadId)) return body;
    return `${body}\n\nReference: ${leadId}`;
  }

  function buildUrl(text, leadId) {
    const msg = appendReference(text, leadId);
    return `https://wa.me/${waNumber()}?text=${encodeURIComponent(msg)}`;
  }

  function openWhatsApp(text, leadId) {
    window.open(buildUrl(text, leadId), '_blank', 'noopener,noreferrer');
  }

  function truckPrefill() {
    return window.ASIAPOWER?.whatsappTruckMessage
      || 'Hello AsiaPower, I am looking for truck head / truck cab / truck parts. Brand: __ Model: __ Year: __ Destination country: __';
  }

  function quotePageUrl(params) {
    const base = window.SitePaths?.href?.('contact.html') || 'contact.html';
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return `${base}${qs}`;
  }

  window.WhatsAppCrm = {
    waNumber,
    appendReference,
    buildUrl,
    openWhatsApp,
    truckPrefill,
    quotePageUrl,
  };
})();
