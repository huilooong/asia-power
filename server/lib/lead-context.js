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
  return { en: titled, enSingular: titled, zh: titled };
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

function enrichLeadFields(lead = {}) {
  const next = { ...lead };
  const pageUrl = trim(next.pageUrl || next.page, 240);
  const product = productForLead(next);
  const productLabel = trim(next.productLabel, 120) || resolveProductLabel(product).en;
  const inquirySubject = buildInquirySubject({ ...next, pageUrl, product, productLabel });
  const replySubject = buildReplySubject({ ...next, pageUrl, product, productLabel, inquirySubject });

  next.pageUrl = pageUrl;
  next.page = pageUrl || next.page;
  next.product = product;
  next.productLabel = productLabel;
  next.inquirySubject = inquirySubject;
  next.replySubject = replySubject;
  next.referrer = trim(next.referrer, 240);
  return next;
}

function captureLeadMetaFromBody(body = {}) {
  const pageUrl = trim(body.pageUrl || body.page, 240);
  return {
    pageUrl,
    page: pageUrl,
    referrer: trim(body.referrer, 240),
    utmSource: trim(body.utm_source || body.utmSource, 80),
    utmMedium: trim(body.utm_medium || body.utmMedium, 80),
    utmCampaign: trim(body.utm_campaign || body.utmCampaign, 120),
    utmContent: trim(body.utm_content || body.utmContent, 120),
    utmTerm: trim(body.utm_term || body.utmTerm, 120),
    brand: trim(body.brand, 80),
    product: trim(body.product || body.model, 120),
    productLabel: trim(body.productLabel, 120),
  };
}

module.exports = {
  PRODUCT_LABELS,
  ENQUIRY_ZH,
  ENQUIRY_EN,
  titleCaseSlug,
  resolveProductLabel,
  pageContextLabel,
  buildInquirySubject,
  buildReplySubject,
  enrichLeadFields,
  captureLeadMetaFromBody,
};
