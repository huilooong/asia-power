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

test("explicit general technical facts use a physically separate reusable store", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apsales-evidence-"));
  const stored = await storeReusableFact({ workspace: root, teamText: "We can supply a compatible YD25 engine for this model.", dealState: { part_intent: "engine", engine_code: "YD25" } });
  assert.equal(stored.stored, true);
  const facts = await retrieveReusableFacts({ workspace: root, dealState: { part_intent: "engine", engine_code: "YD25" } });
  assert.equal(facts.length, 1);
  assert.match(facts[0].text, /compatible YD25/);
});
