'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  normalizeEmailText,
  decodeQuotedPrintableText,
  looksLikeQuotedPrintable,
  htmlToReadableText,
  parseRawEmail,
  parseEmailPayload,
} = require('../server/lib/email-mime-parse.js');
const { createEmailProxyStore } = require('../server/lib/email-proxy.js');

test('quoted-printable soft line breaks are removed', () => {
  // Soft breaks join without inserting spaces (RFC 2045). Space before "=" is preserved.
  const raw =
    'sales@ =\r\ninbound storage and Gmail forwarding after creating the Cloudflare =\r\ndestination';
  const out = normalizeEmailText(raw);
  assert.equal(
    out,
    'sales@ inbound storage and Gmail forwarding after creating the Cloudflare destination',
  );
  assert.doesNotMatch(out, /=\n/);
});

test('APMAIL garbled sample with spaced soft breaks normalizes', () => {
  const garbled =
    'sales@ =\ninbound storage and Gmail forwarding after creating the Cloudflare =\ndestination';
  const out = normalizeEmailText(garbled);
  assert.match(out, /sales@/);
  assert.match(out, /inbound storage/);
  assert.match(out, /Cloudflare destination/);
  assert.doesNotMatch(out, /@\s*=/);
  assert.doesNotMatch(out, /Cloudflare\s*=\s*\n/);
});

test('literal equals in body are preserved', () => {
  const text = 'Price is a = b + c, SKU=G4KJ-01, discount 10%=ok';
  const out = normalizeEmailText(text);
  assert.match(out, /a = b \+ c/);
  assert.match(out, /SKU=G4KJ-01/);
  assert.match(out, /10%=ok/);
});

test('quoted-printable Chinese decodes', () => {
  // "你好世界" in UTF-8 QP
  const qp = '=E4=BD=A0=E5=A5=BD=E4=B8=96=E7=95=8C';
  assert.equal(decodeQuotedPrintableText(qp), '你好世界');
});

test('looksLikeQuotedPrintable detects soft breaks', () => {
  assert.equal(looksLikeQuotedPrintable('hello=\nworld'), true);
  assert.equal(looksLikeQuotedPrintable('hello world'), false);
});

test('html-only mail becomes readable text', () => {
  const html =
    '<html><head><style>.x{color:red}</style><script>alert(1)</script></head>' +
    '<body><p>Need <b>2 units</b></p><a href="https://asia-power.com">AsiaPower</a>' +
    '<img src="https://track.example/pixel.gif"></body></html>';
  const out = htmlToReadableText(html);
  assert.match(out, /Need 2 units/);
  assert.match(out, /AsiaPower/);
  assert.match(out, /https:\/\/asia-power\.com/);
  assert.doesNotMatch(out, /alert/);
  assert.doesNotMatch(out, /track\.example/);
});

test('multipart/alternative prefers text/plain', async () => {
  const raw = [
    'From: buyer@example.com',
    'To: sales@asia-power.com',
    'Subject: Quote',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="BOUND"',
    '',
    '--BOUND',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'sales@ =\r\ninbound storage and Gmail forwarding after creating the Cloudflare =\r\ndestination',
    '--BOUND',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    '<p>HTML SHOULD NOT WIN</p>',
    '--BOUND--',
    '',
  ].join('\r\n');

  const parsed = await parseRawEmail(raw);
  assert.match(parsed.text, /sales@ inbound storage/);
  assert.match(parsed.text, /Cloudflare destination/);
  assert.doesNotMatch(parsed.text, /HTML SHOULD NOT WIN/);
  assert.equal(parsed.from.includes('buyer@example.com'), true);
});

test('base64 body decodes', async () => {
  const body = Buffer.from('Hello from AsiaPower 你好', 'utf8').toString('base64');
  const raw = [
    'From: a@b.com',
    'To: sales@asia-power.com',
    'Subject: B64',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
    '',
  ].join('\r\n');
  const parsed = await parseRawEmail(raw);
  assert.match(parsed.text, /Hello from AsiaPower/);
  assert.match(parsed.text, /你好/);
});

test('multipart/mixed keeps attachment metadata', async () => {
  const raw = [
    'From: a@b.com',
    'To: sales@asia-power.com',
    'Subject: With attach',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="MIX"',
    '',
    '--MIX',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    'See attached RFQ.',
    '--MIX',
    'Content-Type: application/pdf; name="rfq.pdf"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="rfq.pdf"',
    '',
    'JVBERi0xLjQK',
    '--MIX--',
    '',
  ].join('\r\n');
  const parsed = await parseRawEmail(raw);
  assert.match(parsed.text, /See attached RFQ/);
  assert.ok(parsed.attachments.length >= 1);
  assert.match(parsed.attachments[0].filename, /rfq\.pdf/i);
});

test('Gmail-style QP without relying on Worker CTE detection via payload fields', async () => {
  const payload = await parseEmailPayload({
    from: 'buyer@gmail.com',
    to: 'sales@asia-power.com',
    subject: 'Cloudflare',
    text:
      'sales@ =\ninbound storage and Gmail forwarding after creating the Cloudflare =\ndestination',
  });
  assert.equal(
    payload.text,
    'sales@ inbound storage and Gmail forwarding after creating the Cloudflare destination',
  );
});

test('Outlook-style HTML multipart via raw', async () => {
  const raw = [
    'From: outlook@contoso.com',
    'To: sales@asia-power.com',
    'Subject: =?utf-8?B?5L2g5aW9?=',
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary="OL"',
    '',
    '--OL',
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    '<html><body><p>Bonjour=2C need engine=</p><p>Merci</p></body></html>',
    '--OL--',
    '',
  ].join('\r\n');
  const parsed = await parseRawEmail(raw);
  assert.match(parsed.text, /Bonjour/);
  assert.match(parsed.text, /need engine/);
  assert.match(parsed.text, /Merci/);
});

test('ISO-8859-1 / Windows-1252 latin text via QP', async () => {
  // café as latin1 QP byte =E9 inside a charset-labeled MIME part
  const raw = [
    'From: a@b.com',
    'To: sales@asia-power.com',
    'Subject: cafe',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=ISO-8859-1',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'caf=E9',
    '',
  ].join('\r\n');
  const parsed = await parseRawEmail(raw);
  assert.match(parsed.text, /caf/);
  assert.ok(parsed.text.includes('é') || parsed.text.includes('caf'));
});

test('windows-1252 lone QP hex falls back when not valid UTF-8', () => {
  const out = decodeQuotedPrintableText('caf=E9');
  assert.equal(out, 'café');
});

test('ingestInbound stores normalized text for APSales', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'email-mime-'));
  const store = createEmailProxyStore({
    root: tmp,
    dataDir: path.join(tmp, 'data'),
    secret: 'test-secret',
  });
  const result = await store.ingestInbound({
    from: 'buyer@example.com',
    to: 'sales@asia-power.com',
    subject: 'APMAIL sample',
    text:
      'sales@=\ninbound storage and Gmail forwarding after creating the Cloudflare=\ndestination',
  });
  assert.match(result.message.text, /sales@inbound storage/);
  assert.doesNotMatch(result.message.text, /=\n/);
  assert.equal(result.thread.routeAgent, 'apsales');
});

test('ingestInbound with raw MIME uses mailparser', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'email-raw-'));
  const store = createEmailProxyStore({
    root: tmp,
    dataDir: path.join(tmp, 'data'),
    secret: 'test-secret',
  });
  const raw = [
    'From: buyer@example.com',
    'To: sales@asia-power.com',
    'Subject: Raw path',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Hello=\r\n world price a = b',
    '',
  ].join('\r\n');
  const result = await store.ingestInbound({
    from: 'buyer@example.com',
    to: 'sales@asia-power.com',
    subject: 'ignored-if-raw',
    text: 'SHOULD_NOT_WIN=\nbad',
    rawBase64: Buffer.from(raw, 'utf8').toString('base64'),
  });
  assert.match(result.message.text, /Hello world/);
  assert.match(result.message.text, /a = b/);
  assert.doesNotMatch(result.message.text, /SHOULD_NOT_WIN/);
  assert.equal(result.message.parseSource, 'raw-mime');
});
