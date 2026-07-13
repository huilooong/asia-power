'use strict';

/**
 * APSALES-EVIDENCE-001 — AsiaPower Evidence writer (WhatsApp channel V1).
 * Append-only. Never blocks customer send (Business First).
 *
 * Flow: Customer → Decision → Truth Guard → Reply → CEO → Customer Result → Decision Result
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function asiapowerRoot() {
  const fromEnv = env('ASIAPOWER_ROOT');
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..', '..', 'AsiaPower'),
    '/root/.openclaw/workspace/AsiaPower',
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'sales_core', 'sales_brain_draft.py')) || fs.existsSync(path.join(c, 'data'))) {
      return c;
    }
  }
  return candidates[0];
}

function evidenceChannelDir(channel = 'whatsapp') {
  return path.join(asiapowerRoot(), 'data', 'evidence', channel);
}

function appendJsonl(file, row) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
}

function safeAppend(channel, filename, row) {
  try {
    const file = path.join(evidenceChannelDir(channel), filename);
    appendJsonl(file, row);
    return { ok: true, file };
  } catch (err) {
    try {
      appendJsonl(path.join(evidenceChannelDir(channel), 'failed.ndjson'), {
        at: new Date().toISOString(),
        error: String(err && err.message ? err.message : err).slice(0, 500),
        filename,
        evidence_id: row && row.evidence_id,
      });
    } catch {
      /* last resort: never throw to caller */
    }
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function makeEvidenceId(atIso) {
  const ts = String(atIso || new Date().toISOString()).replace(/[:.]/g, '');
  const h = crypto.randomBytes(4).toString('hex');
  return `ev-${ts}-${h}`;
}

function isPriceInquiry(inbound) {
  return (
    /\b(how\s*much|best\s*price|lowest\s*price|price(?:\s*list)?|pricelist|quot(?:e|ation)|pricing|cost|cheap(?:er)?|prix|devis|报价|多少钱)\b/i.test(
      String(inbound || ''),
    ) || /سعر/.test(String(inbound || ''))
  );
}

function hasVin(text) {
  return /\b[A-HJ-NPR-Z0-9]{11,17}\b/.test(String(text || '')) || /\bvin\b/i.test(String(text || ''));
}

function inferIntent(normalized) {
  const t = String(normalized.text || '');
  const typ = String(normalized.message_type || 'text');
  if (['image', 'audio', 'video', 'document', 'sticker', 'voice'].includes(typ)) return 'media';
  if (isPriceInquiry(t)) return 'price_request';
  if (hasVin(t)) return 'vin_provided';
  if (/\b(port|港口|harbour|harbor)\b/i.test(t)) return 'port_provided';
  if (/\b(qty|quantity|pcs|units|数量)\b/i.test(t)) return 'qty_provided';
  return 'general';
}

/**
 * Map sandbox outcome → Sales Decision (not Reply text).
 */
function inferDecision({
  inboundText,
  replyText,
  reasonCode,
  genDecision,
  vehicleIntelligence,
  commercialDecision,
}) {
  const inbound = String(inboundText || '');
  const reply = String(replyText || '');
  const askVin = /\bvin\b/i.test(reply) || /车架号/.test(reply);
  const askModel = /\b(model|year|engine code|型号|年款)\b/i.test(reply);
  const askPort = /\b(port|港口)\b/i.test(reply);
  const quoteNow = /\b(USD|FOB|CIF|\$\s*\d|报价)\b/i.test(reply);
  const cdr =
    commercialDecision ||
    (vehicleIntelligence && vehicleIntelligence.commercial_decision) ||
    null;

  let sales = 'general';
  let salesDetail = 'continue';
  let nextAction = 'wait';

  if (cdr && cdr.next_best_action) {
    sales = 'commercial_decision';
    salesDetail = cdr.objective || cdr.customer_intent || 'nba';
    nextAction = cdr.next_best_action;
  } else if (reasonCode === 'vehicle_intelligence_vin' || genDecision === 'vehicle_intelligence') {
    sales = 'quotation';
    salesDetail = 'vin_enriched_ask_missing';
    nextAction =
      (vehicleIntelligence && vehicleIntelligence.next_action) || 'ask_missing_sales_fields';
  } else if (
    reasonCode === 'commercial_decision_v1' ||
    genDecision === 'commercial_decision'
  ) {
    sales = 'commercial_decision';
    salesDetail = 'nba';
    nextAction = 'wait';
  } else if (reasonCode === 'price_advance' || (isPriceInquiry(inbound) && askVin)) {
    sales = 'quotation';
    salesDetail = 'collect_vin_first';
    nextAction = 'ask_vin';
  } else if (reasonCode === 'stock_advance') {
    sales = 'inventory';
    salesDetail = 'check_stock';
    nextAction = askVin ? 'ask_vin' : 'ask_model';
  } else if (reasonCode === 'policy_blocked') {
    sales = 'risk';
    salesDetail = 'refuse_claim';
    nextAction = askVin ? 'ask_vin' : 'wait';
  } else if (quoteNow) {
    sales = 'quotation';
    salesDetail = 'quote_now';
    nextAction = 'send_quote';
  } else if (askVin) {
    sales = 'quotation';
    salesDetail = 'collect_vin_first';
    nextAction = 'ask_vin';
  } else if (askModel) {
    sales = 'quotation';
    salesDetail = 'collect_model_first';
    nextAction = 'ask_model';
  } else if (askPort) {
    sales = 'logistics';
    salesDetail = 'collect_port';
    nextAction = 'ask_port';
  }

  return {
    sales,
    sales_detail: salesDetail,
    next_action: nextAction,
    module: 'SALES_DECISION',
    reason_code: reasonCode || 'ok',
    generator: genDecision || 'apsales',
    flags: {
      ask_vin: askVin,
      ask_model: askModel,
      ask_port: askPort,
      quote_now: quoteNow,
      defer_quote: isPriceInquiry(inbound) && !quoteNow,
      vin_enriched: reasonCode === 'vehicle_intelligence_vin',
      commercial_decision_v1: Boolean(cdr),
    },
  };
}

function truthGuardNode({ originalReply, finalReply, riskBlocked, reasonCode }) {
  const original = String(originalReply || '');
  const final = String(finalReply || '');
  let verdict = 'pass';
  if (riskBlocked && original !== final) verdict = 'rewrite';
  else if (riskBlocked) verdict = 'block';
  else if (original && final && original !== final) verdict = 'rewrite';

  return {
    verdict,
    reason_code: reasonCode || 'ok',
    risk_blocked: Boolean(riskBlocked),
    original_reply: original,
    note:
      verdict === 'pass'
        ? 'Truth Guard passed — original reply allowed'
        : verdict === 'rewrite'
          ? `Truth Guard rewrote reply — reason_code=${reasonCode || 'ok'}`
          : `Truth Guard blocked — reason_code=${reasonCode || 'ok'}`,
  };
}

/**
 * Classify next customer message as factual Customer Result.
 */
function classifyCustomerFact(normalized) {
  const typ = String(normalized.message_type || 'text');
  const text = String(normalized.text || '');
  if (['image', 'sticker', 'video', 'document'].includes(typ)) return 'sent_image';
  if (['audio', 'voice'].includes(typ)) return 'continued_chat';
  if (hasVin(text)) return 'sent_vin';
  if (/\b(port|港口|harbour|harbor|tema|lagos|dubai)\b/i.test(text)) return 'sent_port';
  if (/\b(\d+)\s*(pcs|units|sets|台|件)?\b/i.test(text) && /\b(qty|quantity|数量|need|要)\b/i.test(text)) {
    return 'sent_qty';
  }
  if (isPriceInquiry(text)) return 'asked_price';
  if (/\b(model|year|20\d{2}|G4K|2KD|1KD|发动机|引擎)\b/i.test(text)) return 'sent_model';
  if (/\b(bye|stop|cancel|结束|不用了)\b/i.test(text)) return 'ended';
  return 'continued_chat';
}

/**
 * Decision Result from Decision.next_action + Customer Result.fact
 */
function computeDecisionResult(nextAction, fact) {
  const action = String(nextAction || '');
  const f = String(fact || '');
  const pairs = {
    ask_vin: 'sent_vin',
    ask_model: 'sent_model',
    ask_port: 'sent_port',
    ask_qty: 'sent_qty',
  };
  if (!f || f === 'pending') {
    return { status: 'pending', basis: null };
  }
  if (f === 'ended') {
    return { status: 'failed', basis: 'customer_ended' };
  }
  if (pairs[action] && pairs[action] === f) {
    return { status: 'succeeded', basis: `customer_${f}` };
  }
  if (action === 'send_quote' && (f === 'continued_chat' || f === 'asked_price' || f === 'sent_qty')) {
    return { status: 'succeeded', basis: `customer_${f}_after_quote` };
  }
  if (f === 'silent') {
    return { status: 'failed', basis: 'customer_silent' };
  }
  return { status: 'inconclusive', basis: `fact_${f}_vs_action_${action || 'none'}` };
}

function readNdjson(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findOpenTurn(conversationId, channel = 'whatsapp') {
  const dir = evidenceChannelDir(channel);
  const turns = readNdjson(path.join(dir, 'turns.ndjson'));
  const patches = readNdjson(path.join(dir, 'patches.ndjson'));
  const patched = new Map();
  for (const p of patches) {
    if (p.evidence_id && p.customer_result) patched.set(p.evidence_id, p);
  }
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const t = turns[i];
    if (!t || t.type !== 'evidence_turn') continue;
    const cid = t.customer && t.customer.conversation_id;
    if (String(cid) !== String(conversationId)) continue;
    const p = patched.get(t.evidence_id);
    const status = (p && p.customer_result && p.customer_result.status) || (t.customer_result && t.customer_result.status);
    if (status === 'pending' || !status) return t;
  }
  return null;
}

/**
 * On new inbound: patch previous pending turn with Customer Result + Decision Result.
 */
function recordCustomerResult(normalized, channel = 'whatsapp') {
  try {
    const conversationId = String(normalized.wa_id || '');
    if (!conversationId) return { ok: true, skipped: true, reason: 'no_wa_id' };
    const open = findOpenTurn(conversationId, channel);
    if (!open) return { ok: true, skipped: true, reason: 'no_open_turn' };

    // Do not patch with the same inbound that created the turn
    if (open.customer && open.customer.inbound_wamid && open.customer.inbound_wamid === normalized.message_id) {
      return { ok: true, skipped: true, reason: 'same_inbound' };
    }

    const fact = classifyCustomerFact(normalized);
    const at = new Date().toISOString();
    const nextAction = open.decision && open.decision.next_action;
    const dr = computeDecisionResult(nextAction, fact);
    const patch = {
      schema_version: 1,
      type: 'evidence_patch',
      evidence_id: open.evidence_id,
      at,
      channel,
      customer_result: {
        status: 'observed',
        observed_at: at,
        fact,
        next_inbound_wamid: normalized.message_id || null,
      },
      decision_result: {
        status: dr.status,
        observed_at: at,
        basis: dr.basis,
      },
    };
    return { ...safeAppend(channel, 'patches.ndjson', patch), patch, open_evidence_id: open.evidence_id };
  } catch (err) {
    safeAppend(channel, 'failed.ndjson', {
      at: new Date().toISOString(),
      error: String(err && err.message ? err.message : err).slice(0, 500),
      where: 'recordCustomerResult',
    });
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * After Truth Guard + send: append one evidence turn.
 */
function recordEvidenceTurn({
  normalized,
  originalReply,
  finalReply,
  riskBlocked,
  reasonCode,
  genDecision,
  outboundWamid,
  sent,
  channel = 'whatsapp',
  vehicleIntelligence = null,
  commercialDecision = null,
}) {
  try {
    const at = new Date().toISOString();
    const evidenceId = makeEvidenceId(at);
    const waId = String(normalized.wa_id || '');
    const decision = inferDecision({
      inboundText: normalized.text || '',
      replyText: finalReply || '',
      reasonCode,
      genDecision,
      vehicleIntelligence,
      commercialDecision,
    });
    const truthGuard = truthGuardNode({
      originalReply,
      finalReply,
      riskBlocked,
      reasonCode,
    });
    const cdr =
      commercialDecision ||
      (vehicleIntelligence && vehicleIntelligence.commercial_decision) ||
      null;
    const turn = {
      schema_version: 1,
      type: 'evidence_turn',
      evidence_id: evidenceId,
      at,
      channel,
      customer: {
        message: String(normalized.text || ''),
        intent: inferIntent(normalized),
        conversation_id: waId,
        customer_id: waId ? `wa:${waId}` : null,
        timestamp: normalized.timestamp || at,
        inbound_wamid: normalized.message_id || null,
        inbound_type: normalized.message_type || 'text',
      },
      decision,
      customer_intelligence: vehicleIntelligence
        ? {
            known: vehicleIntelligence.known || [],
            do_not_ask: vehicleIntelligence.do_not_ask || [],
            ask_list: vehicleIntelligence.ask_list || [],
            next_action: vehicleIntelligence.next_action || decision.next_action,
            snapshot: vehicleIntelligence.snapshot || null,
          }
        : null,
      commercial_decision: cdr,
      truth_guard: truthGuard,
      reply: {
        text: String(finalReply || ''),
        outbound_wamid: outboundWamid || '',
        sent: Boolean(sent),
      },
      ceo: {
        modified: false,
        before_text: null,
        after_text: null,
        reason: null,
        source: null,
      },
      customer_result: {
        status: 'pending',
        observed_at: null,
        fact: null,
        next_inbound_wamid: null,
      },
      decision_result: {
        status: 'pending',
        observed_at: null,
        basis: null,
      },
      live_fix: null,
      refs: {
        normalized_path: normalized.message_id
          ? `data/whatsapp_cloud/normalized/${normalized.message_id}.json`
          : null,
        draft_id: null,
        sandbox_log: 'data/whatsapp_cloud/sandbox/decisions.ndjson',
        vehicle_knowledge: 'data/vehicle_knowledge/',
      },
    };

    // Optional sidecar for very long replies (keep ndjson readable)
    if (turn.reply.text && turn.reply.text.length > 4000 && outboundWamid) {
      try {
        const outDir = path.join(evidenceChannelDir(channel), 'outbound');
        fs.mkdirSync(outDir, { recursive: true });
        const outFile = path.join(outDir, `${outboundWamid}.txt`);
        fs.writeFileSync(outFile, turn.reply.text, 'utf8');
        turn.reply.text_path = `data/evidence/${channel}/outbound/${outboundWamid}.txt`;
      } catch {
        /* keep inline text */
      }
    }

    return { ...safeAppend(channel, 'turns.ndjson', turn), evidence_id: evidenceId, turn };
  } catch (err) {
    safeAppend(channel, 'failed.ndjson', {
      at: new Date().toISOString(),
      error: String(err && err.message ? err.message : err).slice(0, 500),
      where: 'recordEvidenceTurn',
    });
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

module.exports = {
  asiapowerRoot,
  evidenceChannelDir,
  recordEvidenceTurn,
  recordCustomerResult,
  classifyCustomerFact,
  computeDecisionResult,
  inferDecision,
  truthGuardNode,
  findOpenTurn,
};
