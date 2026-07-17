import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function load() {
  const mod = path.resolve(__dirname, "../deploy/apsales-live-draft/apsales-internal-staff.mjs");
  return import(pathToFileURL(mod).href);
}

test("parseInternalStaffNumbers: env list + fallback", async () => {
  const { parseInternalStaffNumbers } = await load();
  assert.deepEqual(parseInternalStaffNumbers("", "+233549135916"), ["+233549135916"]);
  assert.deepEqual(parseInternalStaffNumbers("+233549135916,+8613800138000", "+233549135916"), [
    "+233549135916",
    "+8613800138000",
  ]);
});

test("isInternalStaffNumber: Ghana support hits; customer misses", async () => {
  const { isInternalStaffNumber, parseInternalStaffNumbers } = await load();
  const staff = parseInternalStaffNumbers(null, "+233549135916");
  assert.equal(isInternalStaffNumber("+233549135916", staff), true);
  assert.equal(isInternalStaffNumber("233549135916", staff), true);
  assert.equal(isInternalStaffNumber("+233543709670", staff), false);
  assert.equal(isInternalStaffNumber("", staff), false);
});
