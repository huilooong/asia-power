import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function load() {
  const mod = path.resolve(__dirname, "../deploy/apsales-live-draft/apsales-vin-card.mjs");
  return import(pathToFileURL(mod).href);
}

test("card: full fields including displacement", async () => {
  const { formatVehicleConfirmationCard } = await load();
  const card = formatVehicleConfirmationCard({
    brand: "NISSAN",
    model: "HARDBODY",
    year: "2021",
    engine_code: "YD25",
    displacement: "2.5L",
  });
  assert.match(card, /^✅ Vehicle confirmed\n/);
  assert.match(card, /Brand: Nissan/);
  assert.match(card, /Model: Hardbody/);
  assert.match(card, /Year: 2021/);
  assert.match(card, /Engine: YD25 \(2\.5L\)/);
  assert.match(card, /Is this correct\? What part are you looking for/);
  assert.ok(!card.includes("undefined"));
  assert.ok(!card.includes("null"));
});

test("card: skip empty displacement line", async () => {
  const { formatVehicleConfirmationCard } = await load();
  const card = formatVehicleConfirmationCard({
    brand: "NISSAN",
    model: "HARDBODY",
    year: "2021",
    engine_code: "YD25289129T",
    displacement: "",
  });
  assert.match(card, /Engine: YD25289129T/);
  assert.ok(!/Displacement:/i.test(card));
  assert.ok(!/\(\s*\)/.test(card));
});

test("card: displacement-only engine line", async () => {
  const { formatVehicleConfirmationCard } = await load();
  const card = formatVehicleConfirmationCard({
    brand: "NISSAN",
    model: "Altima",
    year: "2018",
    displacement: "2.5L",
  });
  assert.match(card, /Displacement: 2\.5L/);
  assert.ok(!/^Engine:/m.test(card));
});

test("card: null when no usable fields", async () => {
  const { formatVehicleConfirmationCard } = await load();
  assert.equal(formatVehicleConfirmationCard({}), null);
  assert.equal(formatVehicleConfirmationCard(null), null);
});
