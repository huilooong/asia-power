/**
 * Cloudflare Email Worker — forward inbound mail to AsiaPower API.
 *
 * Setup (CEO / ops):
 * 1. Cloudflare Dashboard → Email → Email Routing → Email Workers
 * 2. Bind route: inquiry@asia-power.com → this Worker
 * 3. Worker secrets: ASIAPOWER_EMAIL_WEBHOOK, ASIAPOWER_EMAIL_SECRET
 * 4. ASIAPOWER_EMAIL_WEBHOOK = https://asia-power.com/api/email/inbound
 *
 * Deploy: wrangler deploy (see data/knowledge-base/apsales-email-outreach-runbook.md)
 */

export default {
  async email(message, env) {
    const webhook = env.ASIAPOWER_EMAIL_WEBHOOK;
    const secret = env.ASIAPOWER_EMAIL_SECRET;
    const forwardTo = (env.ASIAPOWER_CEO_FORWARD_GMAIL || 'weylonhui@gmail.com').trim();
    if (!webhook || !secret) {
      console.error('Missing ASIAPOWER_EMAIL_WEBHOOK or ASIAPOWER_EMAIL_SECRET');
      return;
    }

    const reader = message.raw.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const rawBytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const c of chunks) {
      rawBytes.set(c, offset);
      offset += c.length;
    }
    const raw = new TextDecoder().decode(rawBytes);

    const text = extractPlainText(raw);
    const payload = {
      from: message.from,
      to: message.to,
      subject: decodeMimeHeader(message.headers.get('subject') || ''),
      text,
      messageId: message.headers.get('message-id') || '',
      inReplyTo: message.headers.get('in-reply-to') || '',
    };

    const res = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AsiaPower-Email-Secret': secret,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Webhook failed ${res.status}: ${body.slice(0, 500)}`);
    }

    if (shouldForwardToCeo(message.to) && forwardTo) {
      try {
        await message.forward(forwardTo);
      } catch (err) {
        console.error(`CEO Gmail forward failed → ${forwardTo}:`, err?.message || err);
      }
    }
  },
};

function shouldForwardToCeo(toAddress) {
  const local = String(toAddress || '')
    .trim()
    .toLowerCase()
    .replace(/^.*<([^>]+)>.*$/, '$1')
    .split('@')[0];
  return local === 'sales' || local === 'inquiry' || local === 'weylon';
}

function extractPlainText(raw) {
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    return decodeBody(raw.replace(/^[\s\S]*?\r?\n\r?\n/, '').trim()).slice(0, 20000);
  }
  const boundary = boundaryMatch[1];
  const parts = raw.split(`--${boundary}`);
  for (const part of parts) {
    if (/Content-Type:\s*text\/plain/i.test(part)) {
      const body = part.replace(/^[\s\S]*?\r?\n\r?\n/, '').replace(/--\s*$/, '').trim();
      return decodePart(body, part).slice(0, 20000);
    }
  }
  return decodeBody(raw.replace(/^[\s\S]*?\r?\n\r?\n/, '').trim()).slice(0, 20000);
}

function decodeMimeHeader(value) {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, _cs, enc, data) => {
    try {
      if (enc.toUpperCase() === 'B') return b64ToUtf8(data);
      return data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      );
    } catch {
      return _;
    }
  });
}

function decodePart(body, headers) {
  const enc = (headers.match(/Content-Transfer-Encoding:\s*(\S+)/i) || [])[1]?.toLowerCase();
  if (enc === 'base64') return b64ToUtf8(body.replace(/\s/g, ''));
  if (enc === 'quoted-printable') return decodeQuotedPrintable(body);
  return decodeBody(body);
}

function decodeBody(body) {
  const trimmed = body.trim();
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 20) {
    try {
      const decoded = b64ToUtf8(trimmed.replace(/\s/g, ''));
      if (/[\u4e00-\u9fff]/.test(decoded) || /[a-zA-Z]{3,}/.test(decoded)) return decoded;
    } catch { /* keep original */ }
  }
  return body;
}

function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function decodeQuotedPrintable(input) {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
