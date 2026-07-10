'use strict';

/** Phase 2 — outbound email via Resend API. Sales replies always from sales@. */

const crypto = require('crypto');
const { outboundMailboxForThread } = require('./email-mailbox');

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function sendEnabled() {
  return env('EMAIL_SEND_ENABLED', '0') === '1' && !!env('RESEND_API_KEY');
}

function fromAddress(mailbox) {
  const domain = env('EMAIL_PROXY_DOMAIN', 'asia-power.com');
  const fallback = env('EMAIL_RESEND_FALLBACK_FROM', 'AsiaPower Sales <onboarding@resend.dev>');
  if (env('EMAIL_RESEND_USE_FALLBACK', '1') === '1' && (mailbox === 'sales' || mailbox === 'inquiry')) {
    return env('EMAIL_FROM_SALES', fallback) || fallback;
  }
  const salesDefault = `AsiaPower Sales <sales@${domain}>`;
  const map = {
    sales: env('EMAIL_FROM_SALES', salesDefault),
    inquiry: env('EMAIL_FROM_INQUIRY', salesDefault),
    supplier: env('EMAIL_FROM_SUPPLIER', `AsiaPower Supplier <supplier@${domain}>`),
  };
  return map[mailbox] || map.sales;
}

function replySubject(subject) {
  const s = String(subject || '').trim() || '(no subject)';
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

async function sendViaResend({ from, to, subject, text, replyTo, inReplyTo }) {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) {
    const err = new Error('RESEND_API_KEY not configured');
    err.statusCode = 503;
    throw err;
  }
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;
  if (inReplyTo) payload.headers = { 'In-Reply-To': inReplyTo, References: inReplyTo };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'AsiaPower-Email/1.0',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Resend HTTP ${res.status}`);
    err.statusCode = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

function createEmailOutbound(store) {
  return {
    sendEnabled,
    fromAddress,
    replySubject,

    async sendReply({ threadId, to, subject, text, mailbox }) {
      if (!sendEnabled()) {
        const err = new Error('Email send disabled (set EMAIL_SEND_ENABLED=1 and RESEND_API_KEY)');
        err.statusCode = 503;
        throw err;
      }
      const thread = store.getThread(threadId);
      if (!thread) {
        const err = new Error(`Thread not found: ${threadId}`);
        err.statusCode = 404;
        throw err;
      }
      const lastInbound = [...(thread.messages || [])].reverse().find((m) => m.direction === 'inbound');
      const toEmail = to || lastInbound?.from;
      if (!toEmail || !toEmail.includes('@')) {
        const err = new Error('Customer email address not found on thread');
        err.statusCode = 400;
        throw err;
      }

      const mb = mailbox || outboundMailboxForThread(thread);
      const resendResult = await sendViaResend({
        from: fromAddress(mb),
        to: toEmail,
        subject: replySubject(subject || thread.subject),
        text,
        replyTo: thread.proxyReplyTo,
        inReplyTo: lastInbound?.messageId,
      });

      const outbound = {
        id: `msg-${crypto.randomBytes(4).toString('hex')}`,
        direction: 'outbound',
        from: fromAddress(mb),
        to: toEmail,
        subject: replySubject(subject || thread.subject),
        text,
        sentAt: new Date().toISOString(),
        resendId: resendResult.id,
        draftId: null,
      };

      const updated = store.recordOutbound(threadId, outbound);
      return { thread: updated, outbound, resend: resendResult };
    },

    health() {
      return {
        sendEnabled: sendEnabled(),
        provider: 'resend',
        fromInquiry: fromAddress('sales'),
        fromSales: fromAddress('sales'),
        defaultOutbound: 'sales@' + env('EMAIL_PROXY_DOMAIN', 'asia-power.com'),
      };
    },
  };
}

module.exports = { createEmailOutbound, sendViaResend, sendEnabled, fromAddress, replySubject };
