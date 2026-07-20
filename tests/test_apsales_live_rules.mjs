import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { buildLiveRulesPrompt } from "../deploy/apsales-live-draft/apsales-live-rules.mjs";

const rules = fs.readFileSync(new URL("../docs/zijing-training/LIVE-RULES.md", import.meta.url), "utf8");
const historical = [
  ["ev-2026-07-13T095541585Z-23a58f75", "hi", "greeting"],
  ["ev-2026-07-15T003804506Z-6383a222", "What price is this?", "quotation"],
  ["ev-2026-07-14T190058223Z-bc246dfd", "VIN KMHSU81E8DU090675", "product_enquiry"],
  ["ev-2026-07-17T182905647Z-bae8f264", "I need a Jeep Cherokee engine. Your price must include delivery to Lusaka, Zambia.", "quotation"],
  ["ev-2026-07-14T223154419Z-0511c361", "I am not getting what you are saying. I need a windscreen and side mirror.", "complaint"],
];

test("real evidence replay uses Sales Coach classifier and always retains hard redlines", () => {
  for (const [evidenceId, message, expected] of historical) {
    const p = spawnSync("python3", ["scripts/apsales-classify-customer-intent.py"], { input: JSON.stringify({ text: message }), encoding: "utf8" });
    assert.equal(p.status, 0, `${evidenceId}: ${p.stderr}`);
    const intent = JSON.parse(p.stdout).intent;
    assert.equal(intent, expected, evidenceId);
    const selected = buildLiveRulesPrompt(rules, intent);
    assert.match(selected.hardRedlines, /严禁|永远不要/);
    assert.match(selected.prompt, /CEO HARD REDLINES/);
  }
});

test("selective prompt is smaller than legacy full-file injection in most real scenarios", () => {
  const legacy = rules.trim().slice(0, 7000);
  const lengths = historical.map(([, , intent]) => buildLiveRulesPrompt(rules, intent).prompt.length);
  assert.ok(lengths.filter((n) => n < legacy.length).length >= 4, `${lengths.join(",")} vs ${legacy.length}`);
  console.log(`live-rules chars: legacy=${legacy.length}; selected=${lengths.join(",")}`);
});
