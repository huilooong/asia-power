import fs from "node:fs/promises";
import path from "node:path";

// This is intentionally a separate physical store from per-customer deal_state.
const FORBIDDEN = /(?:\$\s*\d|\b(?:usd|ghs|rmb|cny|eur|gbp|price|quote|rate|discount|payment|deposit|invoice|delivery|shipping|freight|address)\b|\b\d+\s*(?:days?|weeks?)\b|(?:价格|报价|美元|人民币|元|折扣|优惠|定金|付款|发票|运费|运送|地址|交期|天|周)|(?:prix|tarif|co[uû]t|devis|remise|r[eé]duction|acompte|paiement|facture|livraison|fret|adresse|d[eé]lai))/iu;
const REUSABLE = /(?:\b(?:we\s+can\s+(?:supply|provide|source|do)|compatible|fits?|same\s+(?:engine|model))\b|(?:可(?:以|做)|兼容|适配))/iu;

export function classifyHumanAnswerForReuse(teamText) {
  const text = String(teamText || "").trim();
  if (!text) return { reusable: false, reason: "empty" };
  if (FORBIDDEN.test(text)) return { reusable: false, reason: "customer_specific_commitment" };
  if (!REUSABLE.test(text)) return { reusable: false, reason: "not_explicit_general_fact" };
  return { reusable: true, reason: "general_technical_fact" };
}

export async function storeReusableFact({ workspace, teamText, dealState, at = new Date().toISOString() }) {
  const verdict = classifyHumanAnswerForReuse(teamText);
  if (!verdict.reusable) return { stored: false, ...verdict };
  const file = path.join(workspace, "memory", "sales_evidence", "reusable_facts.ndjson");
  const fact = { schema_version: 1, type: "reusable_technical_fact", at, text: String(teamText).slice(0, 1000), part_intent: dealState?.part_intent || null, brand: dealState?.brand || null, model: dealState?.model || null, engine_code: dealState?.engine_code || null, year: dealState?.year || null };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(fact)}\n`);
  return { stored: true, fact };
}

export async function retrieveReusableFacts({ workspace, dealState, max = 3 }) {
  const file = path.join(workspace, "memory", "sales_evidence", "reusable_facts.ndjson");
  let raw = ""; try { raw = await fs.readFile(file, "utf8"); } catch { return []; }
  const part = String(dealState?.part_intent || ""); const engine = String(dealState?.engine_code || "");
  return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((f) => (!part || f.part_intent === part) && (!engine || f.engine_code === engine)).slice(-max).map((f) => ({ text: f.text, part_intent: f.part_intent, engine_code: f.engine_code }));
}
