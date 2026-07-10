'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadJson, saveJsonAtomic } = require('./json-store');
const { resolveMailbox } = require('./email-mailbox');

const DEFAULT_INBOX_DIR = 'memory/customer_gateway/email_inbox';

/** Strip direct contact details before supplier-facing views. */
const CONTACT_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}\b/g,
  /\b(?:whatsapp|wechat|微信|telegram|tg)[:\s@]*[^\s,;]{4,40}/gi,
  /\b(?:wa\.me|t\.me)\/\S+/gi,
];

function trim(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function hashEmail(email) {
  return crypto.createHash('sha256').update(String(email || '').toLowerCase()).digest('hex').slice(0, 16);
}

function redactContacts(text) {
  let out = String(text || '');
  for (const pattern of CONTACT_PATTERNS) {
    out = out.replace(pattern, '[contact redacted]');
  }
  return out.trim();
}

function proxyReplyAddress(threadId) {
  const local = String(process.env.EMAIL_REPLY_LOCAL || 'reply').trim() || 'reply';
  const domain = String(process.env.EMAIL_PROXY_DOMAIN || 'asia-power.com').trim() || 'asia-power.com';
  return `${local}+${threadId}@${domain}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createEmailProxyStore(options = {}) {
  const root = options.root || process.cwd();
  const dataDir = options.dataDir || path.join(root, 'data');
  const threadsFile = options.threadsFile || path.join(dataDir, 'email-threads.json');
  const inboxDir = options.inboxDir || path.join(root, DEFAULT_INBOX_DIR);
  const secret = String(options.secret || process.env.EMAIL_INBOUND_SECRET || '').trim();

  ensureDir(path.dirname(threadsFile));
  ensureDir(inboxDir);

  function loadThreads() {
    return loadJson(threadsFile, { threads: [] }, { createIfMissing: true });
  }

  function saveThreads(store) {
    saveJsonAtomic(threadsFile, store);
  }

  function verifySecret(req) {
    if (!secret) return false;
    const header = String(req.headers['x-asiapower-email-secret'] || '').trim();
    return header === secret;
  }

  function ingestInbound(payload) {
    const from = trim(payload.from, 320);
    const to = trim(payload.to || payload.recipient, 320);
    const subject = trim(payload.subject, 500);
    const text = trim(payload.text || payload.body || payload.textBody, 20000);
    const html = trim(payload.html || payload.htmlBody, 40000);
    const messageId = trim(payload.messageId || payload.message_id || '', 240);
    const inReplyTo = trim(payload.inReplyTo || payload.in_reply_to || '', 240);

    if (!from && !text && !html) {
      const err = new Error('from and body required');
      err.statusCode = 400;
      throw err;
    }

    const route = resolveMailbox(to);
    const store = loadThreads();
    let thread = null;
    if (inReplyTo) {
      thread = store.threads.find((t) => t.messageIds?.includes(inReplyTo) || t.threadId === inReplyTo);
    }
    if (!thread) {
      const threadId = `em-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      thread = {
        threadId,
        proxyReplyTo: proxyReplyAddress(threadId),
        customerEmailHash: hashEmail(from),
        customerDisplay: redactContacts(from),
        mailbox: route.mailbox,
        routeAgent: route.routeAgent,
        mailboxLabel: route.label,
        subject: subject || '(no subject)',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageIds: [],
        messages: [],
        processedByApsales: false,
        processedByAgent: false,
      };
      store.threads.unshift(thread);
    }

    const inbound = {
      id: `msg-${crypto.randomBytes(4).toString('hex')}`,
      direction: 'inbound',
      from,
      to,
      subject,
      text,
      textRedacted: redactContacts(text || stripHtml(html)),
      receivedAt: new Date().toISOString(),
      messageId: messageId || undefined,
    };
    thread.messages.push(inbound);
    if (messageId) thread.messageIds.push(messageId);
    thread.updatedAt = inbound.receivedAt;
    thread.subject = subject || thread.subject;
    thread.processedByApsales = false;
    thread.processedByAgent = false;
    if (to) {
      const r = resolveMailbox(to);
      thread.mailbox = r.mailbox;
      thread.routeAgent = r.routeAgent;
      thread.mailboxLabel = r.label;
    }
    if (store.threads[0]?.threadId !== thread.threadId) {
      store.threads = [thread, ...store.threads.filter((t) => t.threadId !== thread.threadId)];
    }
    saveThreads(store);

    const inboxPath = path.join(inboxDir, `${thread.threadId}.json`);
    fs.writeFileSync(inboxPath, JSON.stringify({ thread, latest: inbound }, null, 2));

    return { thread, message: inbound, inboxPath, route };
  }

  function listThreads(limit = 50) {
    const store = loadThreads();
    return (store.threads || []).slice(0, Math.max(1, limit));
  }

  function getThread(threadId) {
    const store = loadThreads();
    return (store.threads || []).find((t) => t.threadId === threadId) || null;
  }

  function markProcessed(threadId) {
    const store = loadThreads();
    const thread = (store.threads || []).find((t) => t.threadId === threadId);
    if (!thread) return null;
    thread.processedByApsales = true;
    thread.updatedAt = new Date().toISOString();
    saveThreads(store);
    return thread;
  }

  function recordOutbound(threadId, outbound) {
    const store = loadThreads();
    const thread = (store.threads || []).find((t) => t.threadId === threadId);
    if (!thread) return null;
    thread.messages = thread.messages || [];
    thread.messages.push({ ...outbound, direction: 'outbound', receivedAt: outbound.sentAt || new Date().toISOString() });
    thread.updatedAt = new Date().toISOString();
    thread.lastOutboundAt = thread.updatedAt;
    saveThreads(store);
    return thread;
  }

  function health() {
    const threads = listThreads(500);
    const open = threads.filter((t) => t.status === 'open').length;
    const pendingApsales = threads.filter((t) => !t.processedByApsales).length;
    return {
      ok: true,
      total: threads.length,
      open,
      pendingApsales,
      inboxDir,
      replyDomain: process.env.EMAIL_PROXY_DOMAIN || 'asia-power.com',
    };
  }

  return {
    verifySecret,
    ingestInbound,
    listThreads,
    getThread,
    markProcessed,
    recordOutbound,
    health,
    redactContacts,
    hashEmail,
    threadsFile,
    inboxDir,
  };
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  createEmailProxyStore,
  redactContacts,
  hashEmail,
  proxyReplyAddress,
};
