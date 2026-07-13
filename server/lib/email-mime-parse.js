'use strict';

/**
 * Unified inbound email MIME parse + text normalize for AsiaPower.
 *
 * Call chain consumers (子敬 / APSales / Telegram) must use `text` from
 * parseEmailPayload / normalizeEmailText — never raw MIME or undecoded body.
 */

const { simpleParser } = require('mailparser');

const MAX_TEXT = 20000;
const MAX_HTML = 40000;

/**
 * Remove quoted-printable soft line breaks and decode =XX as UTF-8 bytes.
 * Does NOT strip legitimate mid-line equals (e.g. "a = b", "SKU=G4KJ").
 */
function decodeQuotedPrintableText(input) {
  let s = String(input || '');
  // Soft breaks: "=" at end of line
  s = s.replace(/=\r?\n/g, '');
  s = s.replace(/=\r/g, '');
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    const code = s.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else {
      // Already-decoded Unicode in the string — re-encode as UTF-8 bytes.
      const enc = new TextEncoder().encode(s[i]);
      for (let j = 0; j < enc.length; j++) bytes.push(enc[j]);
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    try {
      return new TextDecoder('windows-1252', { fatal: false }).decode(Uint8Array.from(bytes));
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bytes));
    }
  }
}

/**
 * Heuristic: body still looks like undecoded quoted-printable.
 */
function looksLikeQuotedPrintable(text) {
  const s = String(text || '');
  if (!s) return false;
  if (/=\r?\n/.test(s)) return true;
  // Soft break leftover: word@ or word then "=" alone at end of line
  if (/[^\s=]=\s*$/m.test(s) && /\n/.test(s)) return true;
  // Multiple =XX hex tokens
  const hex = s.match(/=[0-9A-Fa-f]{2}/g);
  if (hex && hex.length >= 2) return true;
  return false;
}

/**
 * Normalize whitespace while keeping paragraphs and Unicode.
 */
function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * HTML → readable plain text (no script/style/tracking pixels).
 */
function htmlToReadableText(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<img\b[^>]*>/gi, ' ');
  // Links: keep href when useful
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const t = String(label).replace(/<[^>]+>/g, '').trim();
    if (t && href && !t.includes(href)) return `${t} (${href})`;
    return t || href || '';
  });
  // Block-ish tags → newlines
  s = s.replace(/<\/(p|div|tr|table|h[1-6]|li|br)\s*>/gi, '\n');
  s = s.replace(/<(br|hr)\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(p|div|tr|table|h[1-6]|li|ul|ol|blockquote)[^>]*>/gi, '\n');
  s = s.replace(/<td[^>]*>/gi, ' | ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return normalizeWhitespace(s);
}

/**
 * Sanitize already-extracted body text (Gmail/Worker/Telegram path).
 */
function normalizeEmailText(text, options = {}) {
  let s = String(text || '');
  if (!s) return '';
  const forceQp = options.forceQuotedPrintable === true || looksLikeQuotedPrintable(s);
  if (forceQp) {
    s = decodeQuotedPrintableText(s);
  }
  // Broken soft-break display form: "word =\nnext" (space before =)
  s = s.replace(/[ \t]=\r?\n/g, ' ');
  s = normalizeWhitespace(s);
  if (options.maxLen) s = s.slice(0, options.maxLen);
  return s;
}

function addrList(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value?.value)) {
    return value.value
      .map((a) => {
        if (a.name && a.address) return `${a.name} <${a.address}>`;
        return a.address || a.name || '';
      })
      .filter(Boolean)
      .join(', ');
  }
  if (value.text) return value.text;
  return String(value);
}

/**
 * Parse raw RFC822 / MIME email into a normalized structure.
 * @param {Buffer|string} raw
 */
async function parseRawEmail(raw) {
  const parsed = await simpleParser(raw, {
    skipHtmlToText: false,
    skipTextToHtml: true,
    skipImageLinks: true,
  });

  let text = (parsed.text || '').trim();
  const html = (parsed.html || '').trim();
  if (!text && html) {
    text = htmlToReadableText(html);
  } else {
    text = normalizeEmailText(text);
  }

  const attachments = (parsed.attachments || []).map((a) => ({
    filename: a.filename || a.cid || 'attachment',
    contentType: a.contentType || 'application/octet-stream',
    size: a.size || (a.content ? a.content.length : 0),
    contentId: a.contentId || undefined,
    checksum: a.checksum || undefined,
  }));

  const cte =
    (parsed.headers && (parsed.headers.get('content-transfer-encoding') || '')) ||
    '';
  const ct = String(parsed.headers?.get('content-type') || '');
  const charsetMatch = ct.match(/charset\s*=\s*"?([^";\s]+)"?/i);

  return {
    subject: String(parsed.subject || '').trim(),
    from: addrList(parsed.from),
    to: addrList(parsed.to),
    cc: addrList(parsed.cc),
    date: parsed.date ? new Date(parsed.date).toISOString() : '',
    messageId: String(parsed.messageId || '').trim(),
    inReplyTo: String(parsed.inReplyTo || '').trim(),
    text: text.slice(0, MAX_TEXT),
    html: html.slice(0, MAX_HTML),
    attachments,
    detectedEncoding: String(cte || '').toLowerCase() || 'unknown',
    detectedCharset: (charsetMatch && charsetMatch[1]) || parsed.charset || 'utf-8',
  };
}

/**
 * Normalize webhook payload (Cloudflare Worker / tests / Resend-style).
 * Prefer raw MIME when present; otherwise sanitize text/html fields.
 */
async function parseEmailPayload(payload = {}) {
  const rawB64 = payload.rawBase64 || payload.raw_base64 || '';
  const rawStr = payload.raw || payload.rawMime || payload.mime || '';
  let raw = null;
  if (rawB64) {
    try {
      raw = Buffer.from(String(rawB64), 'base64');
    } catch {
      raw = null;
    }
  } else if (rawStr) {
    raw = Buffer.from(String(rawStr), 'utf8');
  }

  if (raw && raw.length > 0) {
    const parsed = await parseRawEmail(raw);
    return {
      ...parsed,
      from: parsed.from || String(payload.from || '').trim(),
      to: parsed.to || String(payload.to || payload.recipient || '').trim(),
      subject: parsed.subject || String(payload.subject || '').trim(),
      messageId: parsed.messageId || String(payload.messageId || payload.message_id || '').trim(),
      inReplyTo: parsed.inReplyTo || String(payload.inReplyTo || payload.in_reply_to || '').trim(),
      source: 'raw-mime',
    };
  }

  let text = normalizeEmailText(payload.text || payload.body || payload.textBody || '', {
    maxLen: MAX_TEXT,
  });
  const html = String(payload.html || payload.htmlBody || '').slice(0, MAX_HTML);
  if (!text && html) {
    text = htmlToReadableText(html).slice(0, MAX_TEXT);
  }

  return {
    subject: String(payload.subject || '').trim(),
    from: String(payload.from || '').trim(),
    to: String(payload.to || payload.recipient || '').trim(),
    cc: String(payload.cc || '').trim(),
    date: String(payload.date || '').trim(),
    messageId: String(payload.messageId || payload.message_id || '').trim(),
    inReplyTo: String(payload.inReplyTo || payload.in_reply_to || '').trim(),
    text,
    html,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    detectedEncoding: String(payload.detectedEncoding || 'unknown'),
    detectedCharset: String(payload.detectedCharset || 'utf-8'),
    source: 'fields',
  };
}

module.exports = {
  parseRawEmail,
  parseEmailPayload,
  normalizeEmailText,
  decodeQuotedPrintableText,
  looksLikeQuotedPrintable,
  htmlToReadableText,
  normalizeWhitespace,
};
