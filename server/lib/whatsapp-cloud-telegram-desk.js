'use strict';

/**
 * Conversational WhatsApp desk on @Asiapower86166_bot (Kongming-like chat UX).
 * Still never auto-sends: propose → confirm button → Cloud API.
 */

const fs = require('fs');
const path = require('path');

function quoteLib() {
  return require('./whatsapp-cloud-telegram-quote');
}

function notifyLib() {
  return require('./telegram-notify');
}

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function deskEnabled() {
  const flag = env('WHATSAPP_TELEGRAM_DESK', 'WHATSAPP_CLOUD_TELEGRAM_DESK').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return true;
}

function ensureLlmEnv(rootDir) {
  if (env('OPENAI_API_KEY', 'OPENROUTER_API_KEY')) return;
  try {
    const { loadEnv } = require('./load-env');
    const asia = env('ASIAPOWER_ROOT')
      || path.resolve(rootDir, '..', 'AsiaPower')
      || '/root/.openclaw/workspace/AsiaPower';
    if (fs.existsSync(path.join(asia, '.env'))) loadEnv(asia);
  } catch {
    /* optional */
  }
}

function listRecentCustomers(rootDir, limit = 12) {
  const { storePaths, clip } = quoteLib();
  const { bindings } = storePaths(rootDir);
  let map = {};
  try {
    if (fs.existsSync(bindings)) map = JSON.parse(fs.readFileSync(bindings, 'utf8'));
  } catch {
    map = {};
  }
  const byWa = new Map();
  for (const [msgId, b] of Object.entries(map || {})) {
    const wa = String(b.wa_id || '').replace(/\D/g, '');
    if (!wa) continue;
    const prev = byWa.get(wa);
    const created = b.created_at || '';
    if (!prev || String(created) > String(prev.created_at || '')) {
      byWa.set(wa, {
        wa_id: wa,
        last4: wa.slice(-4),
        profile_name: b.profile_name || '',
        inbound_snippet: b.inbound_snippet || '',
        phone_number_id: b.phone_number_id || '',
        created_at: created,
        telegram_message_id: msgId,
      });
    }
  }
  return [...byWa.values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

function resolveCustomer(rootDir, { last4, waId, name }) {
  const recent = listRecentCustomers(rootDir, 30);
  const digits = String(waId || '').replace(/\D/g, '');
  if (digits) {
    const hit = recent.find((c) => c.wa_id === digits || c.wa_id.endsWith(digits));
    if (hit) return { ok: true, customer: hit, matches: [hit] };
  }
  const l4 = String(last4 || '').replace(/\D/g, '').slice(-4);
  if (l4) {
    const matches = recent.filter((c) => c.last4 === l4);
    if (matches.length === 1) return { ok: true, customer: matches[0], matches };
    if (matches.length > 1) return { ok: false, reason: 'ambiguous_last4', matches };
    return { ok: false, reason: 'not_found', matches: [], last4: l4 };
  }
  const n = String(name || '').trim().toLowerCase();
  if (n) {
    const matches = recent.filter((c) => String(c.profile_name || '').toLowerCase().includes(n));
    if (matches.length === 1) return { ok: true, customer: matches[0], matches };
    if (matches.length > 1) return { ok: false, reason: 'ambiguous_name', matches };
  }
  return { ok: false, reason: 'need_customer', matches: recent.slice(0, 8) };
}

function heuristicIntent(text, recent) {
  const t = String(text || '').trim();
  const last4m = t.match(/(?:尾号|后四位|\.\.\.|…|#)?\s*(\d{4})\b/);
  const last4 = last4m ? last4m[1] : '';
  const wantsSend = /回(消息|复)|告诉|跟他说|发(给|消息)|通知|安排|现货|报价|拆/.test(t);
  if (wantsSend && last4) {
    const matches = recent.filter((c) => c.last4 === last4);
    if (matches.length === 1) {
      let outbound = t
        .replace(/给?尾号\s*\d{4}\s*的?客户/g, '')
        .replace(/回(消息|复)/g, '')
        .replace(/告诉他|跟他说|说/g, '')
        .trim();
      if (/现货/.test(t) && /拆/.test(t)) {
        outbound = [
          'We have stock available for your request.',
          'If you confirm, we can arrange dismantling for you.',
          'Please reply YES to proceed.',
        ].join('\n');
      } else if (/现货/.test(t)) {
        outbound = 'We have stock available. Please let me know if you want to proceed.';
      } else if (!outbound || outbound.length < 8) {
        outbound = t;
      }
      return {
        action: 'propose_send',
        last4,
        outbound,
        ceo_reply: `准备发给 …${last4}（${matches[0].profile_name || '客户'}），请确认。`,
        confidence: 0.7,
        source: 'heuristic',
      };
    }
  }
  if (/最近|谁|客户列表|有哪些/.test(t)) {
    return { action: 'list', ceo_reply: '', confidence: 0.9, source: 'heuristic' };
  }
  return null;
}

async function callDeskLlm(rootDir, { text, recent }) {
  const { clip } = quoteLib();
  ensureLlmEnv(rootDir);
  const apiKey = env('OPENAI_API_KEY');
  const openrouter = env('OPENROUTER_API_KEY');
  if (!apiKey && !openrouter) {
    return { ok: false, reason: 'no_llm_key' };
  }

  let model = env('WHATSAPP_TELEGRAM_DESK_MODEL') || '';
  let baseUrl;
  let key;
  if (openrouter) {
    baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    key = openrouter;
    model = model || 'google/gemini-2.5-flash';
    model = model.replace(/^openrouter\//, '');
  } else {
    baseUrl = 'https://api.openai.com/v1/chat/completions';
    key = apiKey;
    model = model || 'gpt-4o-mini';
  }

  const catalog = recent.map((c) => (
    `…${c.last4} name=${c.profile_name || '-'} wa=${c.wa_id} last="${clip(c.inbound_snippet, 80)}"`
  )).join('\n');

  const system = [
    '你是 AsiaPower 的 WhatsApp 接待台助手（专用 Bot）。风格简洁，像同事。',
    '只处理 Cloud WhatsApp(+86) 客户相关指令。',
    '你不能直接给客户发 WhatsApp；只能 propose_send，由系统弹确认按钮。',
    '客户必须从 recent_customers 匹配（尾号/名字）。匹配不到就问清楚，绝不编造号码。',
    '发给客户的 outbound 用客户常用语言（多为英文），完整可直接发送。',
    '只输出 JSON：',
    '{"action":"chat"|"list"|"propose_send","ceo_reply":"中文回复CEO","last4":"4122","outbound":"给客户的原文","confidence":0.0}',
  ].join('\n');

  const user = [
    `recent_customers:\n${catalog || '(none)'}`,
    '',
    `CEO: ${text}`,
  ].join('\n');

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(openrouter ? { 'HTTP-Referer': 'https://asia-power.com', 'X-Title': 'AsiaPower WA Desk' } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, reason: 'llm_http', error: data.error?.message || `HTTP ${res.status}` };
  }
  const raw = data.choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, intent: { ...parsed, source: 'llm' } };
  } catch {
    return { ok: false, reason: 'llm_parse', raw: String(raw).slice(0, 300) };
  }
}

function formatCustomerList(recent) {
  if (!recent.length) {
    return '最近还没有可绑定的 WhatsApp 客户盯梢。等客户再发消息后会出现在列表里。';
  }
  const { clip } = quoteLib();
  const lines = recent.map((c, i) => (
    `${i + 1}. …${c.last4}${c.profile_name ? ` ${c.profile_name}` : ''} — ${clip(c.inbound_snippet, 50) || '(无摘要)'}`
  ));
  return ['最近 WhatsApp 客户：', ...lines, '', '直接说：给尾号4122回… 或 回复那条盯梢消息写话术。'].join('\n');
}

async function handleDeskChat(rootDir, { text, chatId, fromUser }) {
  if (!deskEnabled()) {
    return { handled: false, reason: 'desk_off' };
  }
  const {
    maskWa,
    getBinding,
    promptConfirmSend,
    clip,
    appendAudit,
  } = quoteLib();
  const { notifyWhatsApp } = notifyLib();

  const recent = listRecentCustomers(rootDir, 15);
  let intent = heuristicIntent(text, recent);

  if (!intent) {
    const llm = await callDeskLlm(rootDir, { text, recent });
    if (llm.ok) intent = llm.intent;
    else {
      await notifyWhatsApp(
        [
          '我是 WhatsApp 接待台（能对话下指令，发消息前仍要你确认）。',
          llm.reason === 'no_llm_key'
            ? '（高级理解暂未就绪，先用尾号规则）'
            : `（智能解析暂不可用：${llm.reason}）`,
          '',
          formatCustomerList(recent),
        ].join('\n'),
      );
      appendAudit(rootDir, { event: 'desk_fallback', reason: llm.reason, text: clip(text, 120) });
      return { handled: true, reason: 'desk_fallback' };
    }
  }

  const action = String(intent.action || 'chat').toLowerCase();

  if (action === 'list') {
    await notifyWhatsApp(intent.ceo_reply ? `${intent.ceo_reply}\n\n${formatCustomerList(recent)}` : formatCustomerList(recent));
    appendAudit(rootDir, { event: 'desk_list', from: fromUser || '' });
    return { handled: true, reason: 'desk_list' };
  }

  if (action === 'propose_send') {
    const resolved = resolveCustomer(rootDir, {
      last4: intent.last4,
      waId: intent.wa_id,
      name: intent.name || intent.profile_name,
    });
    if (!resolved.ok) {
      const hint = resolved.matches?.length
        ? formatCustomerList(resolved.matches)
        : formatCustomerList(recent);
      await notifyWhatsApp(
        [
          intent.ceo_reply || '还不能确定发给哪位客户。',
          `原因: ${resolved.reason}`,
          '',
          hint,
        ].join('\n'),
      );
      appendAudit(rootDir, { event: 'desk_resolve_fail', reason: resolved.reason, text: clip(text, 100) });
      return { handled: true, reason: 'desk_resolve_fail' };
    }

    const customer = resolved.customer;
    const outbound = String(intent.outbound || '').trim();
    if (!outbound) {
      await notifyWhatsApp('请告诉我要发给客户的具体内容（建议英文原文）。');
      return { handled: true, reason: 'desk_missing_outbound' };
    }

    const binding = getBinding(rootDir, customer.telegram_message_id) || {
      wa_id: customer.wa_id,
      profile_name: customer.profile_name,
      phone_number_id: customer.phone_number_id,
      inbound_snippet: customer.inbound_snippet,
    };

    if (intent.ceo_reply) {
      await notifyWhatsApp(String(intent.ceo_reply));
    }

    const result = await promptConfirmSend(rootDir, {
      binding,
      replyToMessageId: customer.telegram_message_id || 'desk',
      fromUser,
      label: clip(outbound, 60),
      outbound: outbound.slice(0, 3500),
      kind: 'message',
    });
    appendAudit(rootDir, {
      event: 'desk_propose_send',
      wa_id_mask: maskWa(customer.wa_id),
      source: intent.source || 'llm',
      pending_id: result.pending_id,
    });
    return result;
  }

  const reply = String(intent.ceo_reply || '').trim()
    || '可以说：给尾号XXXX回… / 最近客户 / 或回复盯梢消息写话术。';
  await notifyWhatsApp(reply);
  appendAudit(rootDir, { event: 'desk_chat', text: clip(text, 100) });
  return { handled: true, reason: 'desk_chat' };
}

module.exports = {
  deskEnabled,
  listRecentCustomers,
  resolveCustomer,
  heuristicIntent,
  handleDeskChat,
  formatCustomerList,
};
