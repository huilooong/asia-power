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

  /** Multi-item quote list → one WhatsApp message (not N separate jumps). */
  function buildBulkWhatsAppMessage(items) {
    if (window.QuoteList?.buildBulkMessage) return window.QuoteList.buildBulkMessage(items);
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return 'Hello AsiaPower, I would like a quote.';
    const lines = ['Hello AsiaPower — quote list inquiry', `Items: ${list.length}`, ''];
    list.forEach((it, i) => {
      lines.push(
        `${i + 1}. ${it.stockId || it.stock_id || 'item'}` +
          (it.priceUsd != null || it.price_usd != null
            ? ` · EXW $${Math.round(Number(it.priceUsd ?? it.price_usd))} USD`
            : '') +
          ` · qty ${it.qty || 1}`,
      );
    });
    lines.push('', 'Destination country: [please advise]');
    return lines.join('\n');
  }

  function buildBulkUrl(items, leadId) {
    return buildUrl(buildBulkWhatsAppMessage(items), leadId);
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
    buildBulkWhatsAppMessage,
    buildBulkUrl,
    openWhatsApp,
    truckPrefill,
    quotePageUrl,
  };
})();
