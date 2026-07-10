/**
 * AsiaPower — lead context helpers (capture + admin display)
 */
(function () {
  'use strict';

  const PRODUCT_LABELS = {
    engines: { en: 'Engines', zh: '发动机' },
    engine: { en: 'Engine', zh: '发动机' },
    'half-cuts': { en: 'Half-cut', zh: '半切车' },
    truck: { en: 'Truck', zh: '卡车' },
    gearbox: { en: 'Gearbox', zh: '变速箱' },
    gearboxes: { en: 'Gearbox', zh: '变速箱' },
    transmission: { en: 'Transmission', zh: '变速箱' },
    chassis: { en: 'Chassis', zh: '底盘件' },
  };

  const ENQUIRY_ZH = {
    engine: '发动机询价',
    gearbox: '变速箱询价',
    chassis: '底盘件询价',
    'truck-head': '车头询价',
    'truck-parts': '卡车配件询价',
    'half-cut': '半切车询价',
    powertrain: '动力总成询价',
    bulk: '批量订单询价',
    partnership: '合作询价',
    other: '其他询价',
  };

  const ENQUIRY_EN = {
    engine: 'Engine',
    gearbox: 'Gearbox',
    chassis: 'Chassis',
    'truck-head': 'Truck Head',
    'truck-parts': 'Truck Parts',
    'half-cut': 'Half-cut',
    powertrain: 'Powertrain',
    bulk: 'Bulk Order',
    partnership: 'Partnership',
    other: 'Enquiry',
  };

  const UTM_KEY = 'asiapower_utm';

  function trim(value, max) {
    return String(value ?? '').trim().slice(0, max);
  }

  function titleCaseSlug(slug) {
    return String(slug || '')
      .trim()
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  function resolveProductLabel(raw) {
    const text = String(raw || '').trim();
    const key = text.toLowerCase();
    if (!text) return { en: '', zh: '' };
    if (PRODUCT_LABELS[key]) return PRODUCT_LABELS[key];
    if (/^[a-z0-9-]{2,24}$/i.test(text) && !PRODUCT_LABELS[key]) {
      return { en: text.toUpperCase(), zh: text.toUpperCase() };
    }
    const titled = titleCaseSlug(key);
    return { en: titled, zh: titled };
  }

  function pageContextLabel(pageUrl) {
    const full = String(pageUrl || '').trim();
    const path = full.split('?')[0].toLowerCase();
    if (path.includes('contact')) return '联系页';
    if (path.includes('/engines/')) return '发动机详情';
    if (path.includes('engines')) return '发动机目录';
    if (path.includes('half-cut')) return '半切车页';
    if (path.includes('/brands/')) return '品牌页';
    if (path.includes('gearbox')) return '变速箱页';
    if (path.includes('trucks')) return '卡车页';
    if (path === '/' || path.endsWith('index.html') || path.endsWith('/')) return '首页';
    const base = path.split('/').filter(Boolean).pop() || '网站';
    return `${base.replace(/\.html$/i, '')}页`;
  }

  function productForLead(lead) {
    return trim(lead.product || lead.model || lead.engineCode, 120);
  }

  function buildInquirySubject(lead) {
    if (lead.inquirySubject) return trim(lead.inquirySubject, 160);
    const brand = titleCaseSlug(lead.brand);
    const product = productForLead(lead);
    const { zh: productZh } = resolveProductLabel(product);
    const pageLabel = pageContextLabel(lead.pageUrl || lead.page);
    const enquiryZh = ENQUIRY_ZH[lead.enquiryType];

    if (brand && productZh) return `${brand} ${productZh} - ${pageLabel}`;
    if (brand && enquiryZh) return `${brand} ${enquiryZh.replace(/询价$/, '')} - ${pageLabel}`;
    if (brand) return `${brand} - ${pageLabel}`;
    if (enquiryZh) return `${enquiryZh} - ${pageLabel}`;
    if (lead.source === 'half-cut') return `半切车询价 - ${pageLabel}`;
    if (lead.source === 'whatsapp-intent') return `WhatsApp 询价 - ${pageLabel}`;
    return `网站询价 - ${pageLabel}`;
  }

  function buildReplySubject(lead) {
    if (lead.replySubject) return trim(lead.replySubject, 160);
    const brand = titleCaseSlug(lead.brand);
    const product = productForLead(lead);
    const { en: productEn } = resolveProductLabel(product);
    const typeEn = ENQUIRY_EN[lead.enquiryType] || 'Enquiry';

    if (brand && product && !['engines', 'engine', 'gearboxes', 'gearbox'].includes(String(product).toLowerCase())) {
      return `Re: ${brand} ${productEn} inquiry - AsiaPower`;
    }
    if (brand && typeEn) return `Re: ${brand} ${typeEn} inquiry - AsiaPower`;
    if (brand) return `Re: ${brand} inquiry - AsiaPower`;
    if (lead.id) return `Re: AsiaPower enquiry — ${lead.id}`;
    return 'Re: AsiaPower enquiry';
  }

  function enrichLead(lead) {
    const next = { ...(lead || {}) };
    const pageUrl = trim(next.pageUrl || next.page, 240);
    const product = productForLead(next);
    const productLabel = trim(next.productLabel, 120) || resolveProductLabel(product).en;
    const inquirySubject = buildInquirySubject({ ...next, pageUrl, product, productLabel });
    const replySubject = buildReplySubject({ ...next, pageUrl, product, productLabel, inquirySubject });
    return {
      ...next,
      pageUrl,
      page: pageUrl || next.page,
      product,
      productLabel,
      inquirySubject,
      replySubject,
    };
  }

  function readStoredUtm() {
    try {
      const raw = sessionStorage.getItem(UTM_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function persistUtm(values) {
    try {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(values));
    } catch {
      // ignore storage failures
    }
  }

  function captureUtm() {
    const params = new URLSearchParams(window.location.search);
    const stored = readStoredUtm();
    const next = {
      utm_source: params.get('utm_source') || stored.utm_source || '',
      utm_medium: params.get('utm_medium') || stored.utm_medium || '',
      utm_campaign: params.get('utm_campaign') || stored.utm_campaign || '',
      utm_content: params.get('utm_content') || stored.utm_content || '',
      utm_term: params.get('utm_term') || stored.utm_term || '',
    };
    if (next.utm_source || next.utm_medium || next.utm_campaign) persistUtm(next);
    return next;
  }

  function captureLeadMeta(extra = {}) {
    const params = new URLSearchParams(window.location.search);
    const brand = trim(extra.brand || params.get('brand'), 80);
    const product = trim(extra.product || params.get('product'), 120);
    const pageUrl = trim(extra.pageUrl || `${window.location.pathname}${window.location.search}`, 240);
    const utm = captureUtm();
    const productLabel = resolveProductLabel(product).en;
    const draft = enrichLead({
      brand,
      product,
      productLabel,
      pageUrl,
      referrer: trim(extra.referrer || document.referrer || '', 240),
      enquiryType: extra.enquiry_type || extra.enquiryType || '',
      source: extra.source || '',
      utmSource: utm.utm_source,
      utmMedium: utm.utm_medium,
      utmCampaign: utm.utm_campaign,
      utmContent: utm.utm_content,
      utmTerm: utm.utm_term,
    });
    return {
      pageUrl,
      page: pageUrl,
      brand,
      product,
      productLabel: draft.productLabel,
      inquirySubject: draft.inquirySubject,
      replySubject: draft.replySubject,
      referrer: draft.referrer,
      ...utm,
    };
  }

  function buildWhatsappReplyTemplate(lead, summaryText) {
    const enriched = enrichLead(lead);
    const greeting = enriched.name ? `Hi ${enriched.name},` : 'Hello,';
    const topic = enriched.inquirySubject || 'your enquiry';
    const lines = [
      greeting,
      '',
      `Thank you for your enquiry about ${topic}.`,
      '',
      summaryText || '',
      '',
      'Best regards,',
      'AsiaPower Team',
    ];
    return lines.filter((line, index, arr) => !(line === '' && arr[index + 1] === '')).join('\n');
  }

  window.AsiaLeadContext = {
    enrichLead,
    buildInquirySubject,
    buildReplySubject,
    captureLeadMeta,
    captureUtm,
    resolveProductLabel,
    pageContextLabel,
    buildWhatsappReplyTemplate,
  };

  window.AsiaPowerUtm = {
    forLead: captureUtm,
  };
})();
