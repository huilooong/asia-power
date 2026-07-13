'use strict';

/**
 * WhatsApp Cloud auto-reply (APWA-002 / APWA-NIGHTSHIFT-001)
 * - sandbox: CEO allowlist only
 * - live: all real +86 Cloud inbound → APSales
 * - observe / off: no auto-reply (off = emergency kill switch)
 */

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sendText, markAsRead, accessToken } = require('./whatsapp-cloud-send');
const { recordCustomerResult, recordEvidenceTurn } = require('./asiapower-evidence');

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function autonomyMode() {
  return (env('WHATSAPP_AUTONOMY_MODE', 'WHATSAPP_CLOUD_AUTONOMY_MODE') || 'observe').toLowerCase();
}

function normalizeWaId(num) {
  return String(num || '').replace(/\D/g, '');
}

function sandboxAllowlist() {
  const raw = env('CEO_WHATSAPP_NUMBER', 'WHATSAPP_SANDBOX_ALLOWLIST');
  return raw
    .split(/[,\s]+/)
    .map(normalizeWaId)
    .filter(Boolean);
}

function isSandboxAllowlisted(waId) {
  const id = normalizeWaId(waId);
  if (!id) return false;
  const list = sandboxAllowlist();
  return list.some((allowed) => id === allowed || id.endsWith(allowed) || allowed.endsWith(id));
}

function internalWaIds() {
  const raw = env('WHATSAPP_INTERNAL_WA_IDS');
  return String(raw || '')
    .split(/[,\s]+/)
    .map(normalizeWaId)
    .filter(Boolean);
}

function customerTrafficTag(waId) {
  const id = normalizeWaId(waId);
  if (!id) return 'unknown';
  if (isSandboxAllowlisted(id)) return 'ceo_test';
  if (internalWaIds().some((x) => id === x || id.endsWith(x) || x.endsWith(id))) {
    return 'internal';
  }
  return 'public_inbound';
}

/** live = all real inbound; sandbox = allowlist only; observe/off = no auto-reply */
function shouldAutoReply(waId) {
  const mode = autonomyMode();
  if (mode === 'off' || mode === 'observe') return false;
  if (mode === 'live') return Boolean(normalizeWaId(waId));
  if (mode === 'sandbox') return isSandboxAllowlisted(waId);
  return false;
}

function asiapowerRoot() {
  const fromEnv = env('ASIAPOWER_ROOT');
  if (fromEnv && fs.existsSync(path.join(fromEnv, 'sales_core', 'sales_brain_draft.py'))) {
    return fromEnv;
  }
  const candidates = [
    path.resolve(__dirname, '..', '..', 'AsiaPower'), // inventory-site/lib → ../AsiaPower
    path.resolve(__dirname, '..', '..'), // repo server/lib → AsiaPower root
    '/root/.openclaw/workspace/AsiaPower',
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'sales_core', 'sales_brain_draft.py'))) return c;
  }
  return candidates[candidates.length - 1];
}

function loadDotEnvKeys(file, keys) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (keys.includes(k) && v) out[k] = v;
  }
  return out;
}

function appendJsonl(file, row) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
}

/** P2: claim outbound once per inbound wamid (atomic O_EXCL). */
function claimOutboundOnce(rootDir, inboundWamid) {
  if (!inboundWamid) return { ok: true, first: true };
  const dir = path.join(rootDir, 'data', 'whatsapp_cloud', 'outbound_dedup');
  fs.mkdirSync(dir, { recursive: true });
  const safe = String(inboundWamid).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
  const p = path.join(dir, `${safe}.sent`);
  try {
    const fd = fs.openSync(p, 'wx');
    fs.writeFileSync(fd, new Date().toISOString(), 'utf8');
    fs.closeSync(fd);
    return { ok: true, first: true, path: p };
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      return { ok: false, first: false, path: p, reason: 'outbound_already_sent' };
    }
    return { ok: true, first: true, path: p, soft: true };
  }
}

function stripInternalLeaks(text) {
  return String(text || '')
    // APPROVAL_REQUEST (not only APPROVAL_REQUIRED) — Live Fix 2026-07-13
    .replace(
      /(?:^|\n)\s*(?:MEMORY_TO_SAVE|DECISION_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|INTERNAL_NOTE|SYSTEM|DEBUG)\s*:.*$/gim,
      '',
    )
    .replace(/\bAPPROVAL_REQUEST\b[:\s].*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasEmailTone(text) {
  return (
    /\bDear\s+Customer\b/i.test(text) ||
    /\bDear\s+Sir\b/i.test(text) ||
    /\bBest\s+regards\b/i.test(text) ||
    /\bLooking\s+forward\s+to\s+your\s+reply\b/i.test(text) ||
    /\bAsiaPower\s+Sales\s+Team\b/i.test(text)
  );
}

function hasResidualLeak(text) {
  return /MEMORY_TO_SAVE|DECISION_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|INTERNAL_NOTE\s*:/i.test(
    String(text || ''),
  );
}

function extractVin(text) {
  const m = String(text || '').toUpperCase().match(/\b([A-HJ-NPR-Z0-9]{11,17})\b/);
  return m ? m[1] : '';
}

/** WhatsApp-native reply after customer sent VIN (Vehicle Intelligence when possible). */
function vinReceivedReply(inboundText) {
  const inbound = String(inboundText || '');
  try {
    const root = asiapowerRoot();
    const py =
      process.env.APSALES_PYTHON ||
      (fs.existsSync(path.join(root, '.venv', 'bin', 'python3'))
        ? path.join(root, '.venv', 'bin', 'python3')
        : fs.existsSync(path.join(root, '.venv-qxb', 'bin', 'python3'))
          ? path.join(root, '.venv-qxb', 'bin', 'python3')
          : 'python3');
    const run = spawnSync(
      py,
      [
        '-c',
        'from sales_core.vehicle_intelligence import enrich_and_decide, build_whatsapp_reply; import sys;\n'
          + 'print(build_whatsapp_reply(enrich_and_decide(sys.stdin.read())))',
      ],
      {
        cwd: root,
        input: inbound,
        encoding: 'utf8',
        timeout: 20000,
        env: {
          ...process.env,
          ASIAPOWER_ROOT: root,
          PYTHONPATH: [root, process.env.PYTHONPATH || ''].filter(Boolean).join(path.delimiter),
        },
      },
    );
    const out = String(run.stdout || '').trim();
    if (run.status === 0 && out && !/Dear Customer|APPROVAL_REQUEST/i.test(out)) {
      return out;
    }
  } catch {
    /* fall through */
  }
  const vin = extractVin(inbound);
  const vinLine = vin ? `Got your VIN: ${vin}\n\n` : 'Got your VIN.\n\n';
  return (
    vinLine +
    'Matching is pending. To avoid a costly mismatch, please send a clear engine plate photo ' +
    '(VIN is factory config only — not always the engine now installed).'
  );
}

/**
 * High-risk content must never auto-send in sandbox.
 * Price intent → advance toward VIN/model (APSALES-P0), never dead-end refusal.
 */
function priceAdvanceReply(inboundText) {
  const inbound = String(inboundText || '');
  if (/[\u0600-\u06FF]/.test(inbound)) {
    return (
      'نعم — يمكننا المساعدة في السعر.\n\n' +
      'للتسعير الصحيح نحتاج مواصفات السيارة أولاً (كود خاطئ = سعر خاطئ).\n\n' +
      'يرجى إرسال:\n' +
      '• VIN أو الموديل + السنة + كود المحرك\n' +
      '• المطلوب (long block / complete engine / gearbox)\n' +
      '• الكمية + ميناء الوصول\n\n' +
      'بعدها نتحقق ونتقدم نحو عرض السعر.\n\n' +
      'www.asia-power.com'
    );
  }
  if (/\b(bonjour|salut|merci|prix|devis|combien)\b/i.test(inbound)) {
    return (
      'Oui — nous pouvons vous aider pour le prix.\n\n' +
      'Pour un devis exact, j\'ai besoin du véhicule précis (mauvais code = mauvais prix).\n\n' +
      'Merci d\'envoyer:\n' +
      '• VIN, ou modèle + année + code moteur\n' +
      '• Besoin (long block / complete engine / gearbox)\n' +
      '• Quantité + port de destination\n\n' +
      'Ensuite on vérifie et on avance vers le devis.\n\n' +
      'www.asia-power.com'
    );
  }
  return (
    'Yes — we can help with pricing once identity is solid.\n\n' +
    'Please send the VIN (or a clear engine plate photo).'
  );
}

function isPriceInquiry(inbound) {
  return (
    /\b(how\s*much|best\s*price|lowest\s*price|price(?:\s*list)?|pricelist|quot(?:e|ation)|pricing|cost|cheap(?:er)?|prix|devis|报价|多少钱)\b/i.test(
      inbound,
    ) || /سعر/.test(inbound)
  );
}

function applyRiskPolicy(text, inboundText) {
  let body = stripInternalLeaks(text);
  const inbound = String(inboundText || '');
  const inboundL = inbound.toLowerCase();
  const inboundHasVin = Boolean(extractVin(inbound));

  // P0: internal tags or email tone must never reach WhatsApp
  if (hasResidualLeak(body) || hasEmailTone(body)) {
    if (inboundHasVin) {
      return {
        text: vinReceivedReply(inbound),
        risk_blocked: true,
        reason_code: 'whatsapp_style_vin',
      };
    }
    return {
      text: priceAdvanceReply(inbound),
      risk_blocked: true,
      reason_code: hasResidualLeak(body) ? 'leak_stripped' : 'email_tone_rewrite',
    };
  }

  const forbidden = [
    /\bwe have (?:it )?in stock\b/i,
    /\bin stock\b/i,
    /\bready to ship\b/i,
    /\bguaranteed\b/i,
    /\bUSD\s*[$]?\s*\d/i,
    /\$\s*\d/,
    /\bFOB\b.{0,20}\d/i,
    /\bCIF\b.{0,20}\d/i,
    /\bprice(?:\s+is)?\s*[:=]?\s*\d/i,
    /\bbank\s+(?:account|transfer)\b/i,
    /\bdeposit\b/i,
    /\bwire transfer\b/i,
    /现货/,
    /有货/,
    /付款/,
    /定金/,
  ];

  const hit = forbidden.some((re) => re.test(body));
  const inboundAsksPrice = isPriceInquiry(inboundL);
  const inboundAsksStock = /\b(in\s*stock|available|have\s+you)\b/i.test(inboundL) || /库存|有货/.test(inbound);

  if (inboundAsksPrice) {
    const weak =
      hit ||
      !body ||
      /do not confirm|cannot quote|we cannot (?:give|provide) (?:a )?price/i.test(body);
    return {
      text: weak ? priceAdvanceReply(inbound) : body,
      risk_blocked: weak,
      reason_code: weak ? 'price_advance' : 'ok',
    };
  }

  // VIN already provided: keep WhatsApp short advance if model invents email prose
  if (inboundHasVin && (hasEmailTone(body) || body.length > 900)) {
    return {
      text: vinReceivedReply(inbound),
      risk_blocked: true,
      reason_code: 'whatsapp_style_vin',
    };
  }

  if (!hit && !inboundAsksStock) {
    return { text: body, risk_blocked: false, reason_code: 'ok' };
  }

  return {
    text: priceAdvanceReply(inbound),
    risk_blocked: true,
    reason_code: inboundAsksStock ? 'stock_advance' : 'policy_blocked',
  };
}

function generateReplyViaPython(normalized) {
  const root = asiapowerRoot();
  const py =
    process.env.APSALES_PYTHON ||
    (fs.existsSync(path.join(root, '.venv', 'bin', 'python3'))
      ? path.join(root, '.venv', 'bin', 'python3')
      : fs.existsSync(path.join(root, '.venv-qxb', 'bin', 'python3'))
        ? path.join(root, '.venv-qxb', 'bin', 'python3')
        : 'python3');

  const script = path.join(root, 'scripts', 'whatsapp_cloud_sandbox_reply.py');
  const input = JSON.stringify({
    text: normalized.text || '',
    wa_id: normalized.wa_id,
    profile_name: normalized.profile_name || '',
    message_type: normalized.message_type,
    media: normalized.media || null,
  });

  // Pull LLM keys from AsiaPower .env (inventory-site .env may not have OPENAI)
  const asiaEnv = loadDotEnvKeys(path.join(root, '.env'), [
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_MODEL',
    'APSALES_MODEL',
  ]);

  const run = spawnSync(py, [script], {
    cwd: root,
    input,
    encoding: 'utf8',
    timeout: 90000,
    env: {
      ...process.env,
      ...asiaEnv,
      ASIAPOWER_ROOT: root,
      PYTHONPATH: [root, process.env.PYTHONPATH || ''].filter(Boolean).join(path.delimiter),
    },
  });

  if (run.error) {
    return { ok: false, error: String(run.error.message || run.error) };
  }
  if (run.status !== 0) {
    return {
      ok: false,
      error: (run.stderr || run.stdout || `exit ${run.status}`).slice(0, 500),
    };
  }
  const lines = (run.stdout || '').trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] || '{}';
  try {
    return { ok: true, ...JSON.parse(last) };
  } catch {
    return { ok: false, error: 'invalid python json', raw: last.slice(0, 200) };
  }
}

function fallbackReply(normalized) {
  const t = String(normalized.message_type || '');
  if (['image', 'audio', 'video', 'document', 'sticker', 'voice'].includes(t)) {
    return (
      "Thanks — we received your media.\n\n" +
      "Please also type: vehicle model, year, engine code or VIN, and what you need (long block / complete engine / gearbox).\n\n" +
      "www.asia-power.com"
    );
  }
  if (t === 'location' || t === 'contacts') {
    return "Thanks. Please type what engine or parts you need, and your destination port.\n\nwww.asia-power.com";
  }
  return (
    "Hi — AsiaPower here.\n\n" +
    "What do you need? Engine / gearbox / half-cut?\n" +
    "Please share model, year, VIN or engine code.\n\n" +
    "www.asia-power.com"
  );
}

async function handleSandboxInbound(rootDir, normalized) {
  const logFile = path.join(rootDir, 'data', 'whatsapp_cloud', 'sandbox', 'decisions.ndjson');
  const mode = autonomyMode();
  const trafficTag = customerTrafficTag(normalized.wa_id);

  if (mode === 'off') {
    return { skipped: true, reason: 'autonomy_off' };
  }
  if (mode === 'observe') {
    return { skipped: true, reason: 'observe_mode' };
  }
  if (mode === 'sandbox' && !isSandboxAllowlisted(normalized.wa_id)) {
    return { skipped: true, reason: 'not_allowlisted' };
  }
  if (mode === 'live' && !normalizeWaId(normalized.wa_id)) {
    return { skipped: true, reason: 'missing_wa_id' };
  }
  if (!shouldAutoReply(normalized.wa_id)) {
    return { skipped: true, reason: `mode_${mode}_no_reply` };
  }

  // APSALES-EVIDENCE-001: pair previous pending Decision with this inbound (facts only).
  // Must not throw / must not block business.
  try {
    recordCustomerResult(normalized, 'whatsapp');
  } catch {
    /* Business First */
  }

  if (!accessToken()) {
    appendJsonl(logFile, {
      at: new Date().toISOString(),
      error: 'NO_ACCESS_TOKEN',
      wa_suffix: String(normalized.wa_id || '').slice(-4),
    });
    return { ok: false, error: 'NO_ACCESS_TOKEN' };
  }

  const phoneNumberId =
    normalized.phone_number_id ||
    env('WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_CLOUD_PHONE_NUMBER_ID');

  // Mark read (best-effort)
  await markAsRead({ phoneNumberId, messageId: normalized.message_id });

  let gen = generateReplyViaPython(normalized);
  let replyText = '';
  let decision = 'apsales';
  if (!gen.ok || !gen.reply) {
    replyText = fallbackReply(normalized);
    decision = 'fallback';
  } else {
    replyText = gen.reply;
    if (gen.reason_code === 'vehicle_intelligence_vin' || gen.source === 'vehicle_intelligence') {
      decision = 'vehicle_intelligence';
    } else if (
      gen.reason_code === 'commercial_decision_v1' ||
      gen.source === 'commercial_decision'
    ) {
      decision = 'commercial_decision';
    }
  }

  const originalReply = replyText;
  let gated;
  // Already Think-Before-Reply from Vehicle Intelligence / Commercial Decision — do not re-LLM rewrite
  if (
    (decision === 'vehicle_intelligence' || decision === 'commercial_decision') &&
    !hasResidualLeak(replyText) &&
    !hasEmailTone(replyText)
  ) {
    gated = {
      text: stripInternalLeaks(replyText),
      risk_blocked: false,
      reason_code: decision === 'commercial_decision' ? 'commercial_decision_v1' : 'vehicle_intelligence_vin',
    };
  } else {
    gated = applyRiskPolicy(replyText, normalized.text || '');
  }
  replyText = gated.text;

  // P2 outbound idempotency — claim immediately before Graph send
  const outboundClaim = claimOutboundOnce(rootDir, normalized.message_id);
  if (!outboundClaim.first) {
    appendJsonl(logFile, {
      at: new Date().toISOString(),
      skipped: true,
      reason: 'outbound_idempotent_skip',
      wa_suffix: String(normalized.wa_id || '').slice(-4),
      inbound_wamid: normalized.message_id || '',
      decision,
      reply_excerpt: String(replyText || '').slice(0, 120),
    });
    return { skipped: true, reason: 'outbound_idempotent_skip' };
  }

  const send = await sendText({
    phoneNumberId,
    to: normalized.wa_id,
    text: replyText,
  });

  const row = {
    at: new Date().toISOString(),
    decision,
    mode,
    traffic_tag: trafficTag,
    risk_level: gated.risk_blocked ? 'high' : gen.risk_level || 'low',
    reason_code: gated.reason_code,
    risk_blocked: gated.risk_blocked,
    wa_suffix: String(normalized.wa_id || '').slice(-4),
    inbound_type: normalized.message_type,
    inbound_excerpt: String(normalized.text || '').slice(0, 120),
    reply_excerpt: String(replyText || '').slice(0, 200),
    wamid_out: send.messageId || '',
    policy_version: 'apwa-nightshift-001-v1',
    parser_version: normalized.parser_version,
  };
  appendJsonl(logFile, row);

  // APSALES-EVIDENCE-001: append AsiaPower Evidence turn (never blocks send).
  try {
    const ev = recordEvidenceTurn({
      normalized,
      originalReply,
      finalReply: replyText,
      riskBlocked: gated.risk_blocked,
      reasonCode: gated.reason_code,
      genDecision: decision,
      outboundWamid: send.messageId || '',
      sent: Boolean(send.messageId),
      channel: 'whatsapp',
      vehicleIntelligence: gen.vehicle_intelligence || null,
      commercialDecision: gen.commercial_decision || null,
      messageUnderstanding: gen.message_understanding || null,
      conversationState: gen.conversation_state || null,
      repeatedActionBlocked: Boolean(gen.repeated_action_blocked),
    });
    if (ev && ev.evidence_id) row.evidence_id = ev.evidence_id;
  } catch {
    /* Business First */
  }

  return { ok: true, ...row };
}

module.exports = {
  handleSandboxInbound,
  isSandboxAllowlisted,
  sandboxAllowlist,
  shouldAutoReply,
  customerTrafficTag,
  applyRiskPolicy,
  autonomyMode,
};
