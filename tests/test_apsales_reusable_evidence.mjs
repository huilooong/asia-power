import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { classifyHumanAnswerForReuse, storeReusableFact, retrieveReusableFacts } from "../deploy/apsales-live-draft/apsales-reusable-evidence.mjs";

test("prices and customer commitments cannot enter reusable evidence storage", async () => {
  assert.equal(classifyHumanAnswerForReuse("We can supply this engine for 900 USD.").reusable, false);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apsales-evidence-"));
  const stored = await storeReusableFact({ workspace: root, teamText: "We can supply this engine for 900 USD.", dealState: { part_intent: "engine" } });
  assert.equal(stored.stored, false);
  await assert.rejects(fs.access(path.join(root, "memory", "sales_evidence", "reusable_facts.ndjson")));
});

test("five Chinese price or discount commitments cannot enter reusable storage", async () => {
  const replies = [
    "可以，价格是900美元。",
    "这台发动机报价6500元，今天给你优惠。",
    "给这个客户打九折，最终价格800 USD。",
    "请先付500元定金，我们再安排发货。",
    "运费和发票费用已经包含在这个报价里。",
  ];
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apsales-evidence-cn-"));
  for (const teamText of replies) {
    assert.equal(classifyHumanAnswerForReuse(teamText).reusable, false, teamText);
    assert.equal((await storeReusableFact({ workspace: root, teamText, dealState: { part_intent: "engine" } })).stored, false, teamText);
  }
  await assert.rejects(fs.access(path.join(root, "memory", "sales_evidence", "reusable_facts.ndjson")));
});

test("French price and delivery commitments and English rate are excluded", () => {
  for (const text of ["Le prix est 900 EUR.", "Remise de 10% avec livraison.", "Our rate is 1200 USD."]) {
    assert.equal(classifyHumanAnswerForReuse(text).reusable, false, text);
  }
});

test("explicit general technical facts use a physically separate reusable store", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apsales-evidence-"));
  const stored = await storeReusableFact({ workspace: root, teamText: "We can supply a compatible YD25 engine for this model.", dealState: { part_intent: "engine", engine_code: "YD25" } });
  assert.equal(stored.stored, true);
  const facts = await retrieveReusableFacts({ workspace: root, dealState: { part_intent: "engine", engine_code: "YD25" } });
  assert.equal(facts.length, 1);
  assert.match(facts[0].text, /compatible YD25/);
});
