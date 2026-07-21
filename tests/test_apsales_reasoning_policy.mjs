import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildEvidenceBoundedFallback } from "../deploy/apsales-live-draft/apsales-reasoning-policy.mjs";

test("1NZ empty-inventory fallback reasons usefully instead of only saying confirming", () => {
  const reply = buildEvidenceBoundedFallback({ engine_code: "1NZ", part_intent: "engine" });
  assert.match(reply, /1NZ/);
  assert.match(reply, /engine family/i);
  assert.match(reply, /model and year/i);
  assert.doesNotMatch(reply, /team.*confirm|confirm.*team/i);
});

test("bridge prompt grants reasoning authority and defines closing-only handoff", () => {
  const source = fs.readFileSync(new URL("../deploy/apsales-live-draft/bridge.mjs", import.meta.url), "utf8");
  assert.match(source, /Reason before escalating/);
  assert.match(source, /That honest fallback is a normal customer reply, not a human handoff/);
  assert.match(source, /needs_address_or_pickup_handoff/);
  assert.doesNotMatch(source, /If inventory_matches is empty or has no good match, do not invent a number — say you'll confirm the price with the team/);
});
