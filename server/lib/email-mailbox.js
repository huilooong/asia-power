'use strict';

/** Resolve inbound address → agent route (子敬 / 子龙 / CEO). */

const DEFAULT_ROUTES = {
  inquiry: { agent: 'apsales', label: '客户询价（历史收件）', outboundFrom: 'sales' },
  sales: { agent: 'apsales', label: '销售询价（对外统一）', outboundFrom: 'sales' },
  supplier: { agent: 'apinventory', label: '供应商', outboundFrom: 'supplier' },
  weylon: { agent: 'ceo', label: 'CEO', forwardTo: 'weylonhui@gmail.com', outboundFrom: 'weylon' },
};

const OUTBOUND_BY_AGENT = {
  apsales: 'sales',
  apinventory: 'supplier',
  ceo: 'weylon',
};

function localPart(address) {
  const raw = String(address || '').trim().toLowerCase();
  const m = raw.match(/<?([^@<\s]+)@/);
  return m ? m[1] : raw.split('@')[0];
}

function resolveMailbox(toAddress) {
  const local = localPart(toAddress);
  const route = DEFAULT_ROUTES[local] || { agent: 'apsales', label: local || 'unknown', outboundFrom: 'sales' };
  return {
    mailbox: local || 'unknown',
    routeAgent: route.agent,
    label: route.label,
    forwardTo: route.forwardTo || null,
    outboundFrom: route.outboundFrom || OUTBOUND_BY_AGENT[route.agent] || 'sales',
  };
}

function outboundMailboxForThread(thread) {
  const agent = thread?.routeAgent || resolveMailbox(
    (thread?.messages || []).slice(-1)[0]?.to || 'sales@asia-power.com'
  ).routeAgent;
  return OUTBOUND_BY_AGENT[agent] || thread?.mailbox || 'sales';
}

module.exports = { resolveMailbox, localPart, DEFAULT_ROUTES, outboundMailboxForThread, OUTBOUND_BY_AGENT };
