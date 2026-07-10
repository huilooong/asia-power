'use strict';

const { notifyAsync } = require('./telegram-notify');

function maskVin(vin) {
  const v = String(vin || '');
  if (v.length < 8) return v || '—';
  return `${v.slice(0, 8)}****${v.slice(-3)}`;
}

function submissionSummary(sub) {
  return [
    `ID: ${sub.submissionId || '—'}`,
    `Supplier: ${sub.supplierName || '—'}`,
    `Vehicle: ${sub.brand || '—'} ${sub.model || ''} (${sub.year || '—'})`.trim(),
    `VIN: ${maskVin(sub.vin)}`,
    `Status: ${sub.reviewStatus || 'pending'}`,
  ].join('\n');
}

function inventorySummary(item) {
  return [
    `Stock: ${item.stockId || '—'}`,
    `Vehicle: ${item.brand || '—'} ${item.model || ''}`.trim(),
    `Slug: ${item.slug || '—'}`,
  ].join('\n');
}

function diffHalfCutState(previous, next) {
  const prevSubs = new Map((previous.submissions || []).map((s) => [s.submissionId, s]));
  const nextSubs = new Map((next.submissions || []).map((s) => [s.submissionId, s]));
  const events = [];

  for (const [id, sub] of nextSubs) {
    const old = prevSubs.get(id);
    if (!old) {
      if ((sub.reviewStatus || 'pending') === 'pending') {
        events.push({ type: 'submission_new', submission: sub });
      }
      continue;
    }
    if (old.reviewStatus !== sub.reviewStatus) {
      if (sub.reviewStatus === 'approved') {
        events.push({ type: 'submission_approved', submission: sub });
      } else if (sub.reviewStatus === 'rejected') {
        events.push({ type: 'submission_rejected', submission: sub });
      }
    }
  }

  const prevApprovedIds = new Set((previous.approved || []).map((a) => a.stockId));
  for (const item of next.approved || []) {
    if (!prevApprovedIds.has(item.stockId)) {
      events.push({ type: 'inventory_approved', item });
    }
  }

  return events;
}

function notifyNewSubmission(submission) {
  notifyAsync(`🔔 新乘用车待审核\n${submissionSummary(submission)}`);
}

function notifyHalfCutEvents(events) {
  for (const event of events) {
    if (event.type === 'submission_new') {
      notifyNewSubmission(event.submission);
    } else if (event.type === 'submission_approved') {
      notifyAsync(`✅ Half-cut approved\n${submissionSummary(event.submission)}`);
    } else if (event.type === 'submission_rejected') {
      notifyAsync(`❌ Half-cut rejected\n${submissionSummary(event.submission)}`);
    } else if (event.type === 'inventory_approved') {
      notifyAsync(`📦 Inventory published\n${inventorySummary(event.item)}`);
    }
  }
}

function notifyUploadFailure(kind, errorMessage) {
  notifyAsync(`⚠️ Upload API failure (${kind})\n${errorMessage}`);
}

function notifyWhatsAppInquiry(row) {
  const preview = String(row.text || row.message || '').replace(/\s+/g, ' ').slice(0, 220);
  notifyAsync([
    '💬 WhatsApp 消息（已收到）',
    `Sender: ${row.senderName || row.senderId || row.conversationId || 'unknown'}`,
    preview ? `Message: ${preview}` : '',
  ].filter(Boolean).join('\n'));
}

function leadIpLine(lead) {
  const { formatIpLocation } = require('./ip-geo');
  const location = formatIpLocation(lead);
  if (location && lead.clientIp) return `IP: ${lead.clientIp} (${location})`;
  if (lead.clientIp) return `IP: ${lead.clientIp}`;
  return '';
}

function leadSummary(lead) {
  if (lead.source === 'half-cut') {
    return [
      `Phone: ${lead.phone || '—'}`,
      lead.name ? `Name: ${lead.name}` : '',
      lead.email ? `Email: ${lead.email}` : '',
      lead.country ? `Country: ${lead.country}` : '',
      `Stock: ${lead.stockId || '—'}`,
      `Vehicle: ${lead.brand || '—'} ${lead.model || ''}`.trim(),
      `Engine: ${lead.engineCode || '—'} / ${lead.transmissionCode || '—'}`,
      `Intent: ${lead.intent || '—'}`,
      leadIpLine(lead),
    ].filter(Boolean).join('\n');
  }
  if (lead.source === 'product-catalog') {
    return [
      `Phone: ${lead.phone || '—'}`,
      lead.name ? `Name: ${lead.name}` : '',
      lead.email ? `Email: ${lead.email}` : '',
      lead.country ? `Country: ${lead.country}` : '',
      `Category: ${lead.enquiryType || '—'}`,
      `Brand: ${lead.brand || '—'}`,
      `Product: ${lead.model || '—'}`,
      `Intent: ${lead.intent || '—'}`,
      leadIpLine(lead),
    ].filter(Boolean).join('\n');
  }
  return [
    `Name: ${lead.name || '—'}`,
    lead.company ? `Company: ${lead.company}` : '',
    `Phone: ${lead.phone || '—'}`,
    lead.email ? `Email: ${lead.email}` : '',
    `Country: ${lead.country || '—'}`,
    `Type: ${lead.enquiryType || '—'}`,
    `Vehicle: ${String(lead.vehicleDetails || '').replace(/\s+/g, ' ').slice(0, 180)}`,
    leadIpLine(lead),
  ].filter(Boolean).join('\n');
}

function notifyContactLead(lead) {
  const emailOnly = lead.replyChannel === 'email';
  notifyAsync([
    emailOnly ? '✅ 新询价单（邮件回复）' : '📝 表单询价已保存（WhatsApp 待确认发送）',
    `ID: ${lead.id}`,
    leadSummary(lead),
    emailOnly ? `Reply to: ${lead.email}` : '',
    lead.page ? `Page: ${lead.page}` : '',
    emailOnly
      ? (lead.phone
        ? '客户选择邮件回复 — 请直接回复邮箱；电话为选填补充。'
        : '客户选择邮件回复且无电话 — 请直接回复邮箱，勿等待 WhatsApp。')
      : '客户已提交表单；WhatsApp 可能尚未点 Send。请用表单中的电话/邮箱跟进，或在 WhatsApp 收到 Reference 后标记已回复。',
  ].filter(Boolean).join('\n'));
}

function notifyHalfCutLead(lead) {
  if (!lead.phone && !lead.email) return;
  notifyAsync([
    '📝 乘用车询价已保存（含联系方式）',
    `ID: ${lead.id}`,
    leadSummary(lead),
    lead.page ? `Page: ${lead.page}` : '',
    '客户已留电话 — 可直接 WhatsApp/电话跟进；若 WhatsApp 未 Send，仍可用表单电话联系。',
  ].filter(Boolean).join('\n'));
}

function notifyProductLead(lead) {
  if (!lead.phone && !lead.email) return;
  notifyAsync([
    '📝 产品目录询价已保存（发动机/变速箱/底盘）',
    `ID: ${lead.id}`,
    leadSummary(lead),
    lead.page ? `Page: ${lead.page}` : '',
    '客户已留联系方式 — 请 24 小时内回复 EXW/CIF 报价。',
  ].filter(Boolean).join('\n'));
}

function notifyLeadReminder(lead) {
  notifyAsync([
    '⏰ 询价待跟进（超过 2 小时未回复）',
    `ID: ${lead.id}`,
    `Source: ${lead.source || '—'} · ${lead.intent || '—'}`,
    leadSummary(lead),
    lead.page ? `Page: ${lead.page}` : '',
    '请在 admin/leads.html 标记已回复。',
  ].filter(Boolean).join('\n'));
}

function notifyWhatsappClick(event) {
  if (process.env.WHATSAPP_CLICK_TELEGRAM !== '1') return;

  const page = event.page || event.pageUrl || '—';
  const label = String(event.label || '').trim();
  let preview = '';
  try {
    const href = String(event.href || '');
    if (href) {
      const text = new URL(href).searchParams.get('text');
      if (text) preview = decodeURIComponent(text).replace(/\s+/g, ' ').slice(0, 220);
    }
  } catch {
    // ignore malformed href
  }
  notifyAsync([
    '⚠️ WhatsApp 按钮点击（尚未确认发送）',
    `页面: ${page}`,
    label ? `按钮: ${label}` : '',
    preview ? `预填消息: ${preview}` : '',
  ].filter(Boolean).join('\n'));
}

module.exports = {
  diffHalfCutState,
  notifyHalfCutEvents,
  notifyNewSubmission,
  notifyUploadFailure,
  notifyWhatsAppInquiry,
  notifyContactLead,
  notifyHalfCutLead,
  notifyProductLead,
  notifyLeadReminder,
  notifyWhatsappClick,
  maskVin,
};
