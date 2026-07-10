#!/usr/bin/env node
/**
 * Build browser lexicon bundle for vehicle title i18n.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const kb = path.join(root, 'data', 'knowledge-base');

const brandDict = JSON.parse(fs.readFileSync(path.join(kb, 'brand-dictionary.json'), 'utf8'));
const modelDict = JSON.parse(fs.readFileSync(path.join(kb, 'model-dictionary.json'), 'utf8'));

const brands = {};
Object.entries(brandDict).forEach(([cn, rec]) => {
  if (rec?.english) brands[cn] = rec.english;
});

const models = {};
Object.entries(modelDict).forEach(([brandSlug, modelsForBrand]) => {
  Object.entries(modelsForBrand || {}).forEach(([modelKey, rec]) => {
    const english = rec?.english || null;
    if (english) models[`${brandSlug}:${modelKey}`] = english;
    if (rec?.chinese) models[`${brandSlug}:${rec.chinese}`] = english || modelKey;
  });
});

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const terms = require('../server/lib/half-cut-vehicle-title-i18n.js').TRIM_TERMS;

const payload = { brands, models, terms };
const outPath = path.join(root, 'js', 'vehicle-title-lexicon.bundle.js');
const body = `window.VehicleTitleLexicon = ${JSON.stringify(payload)};\n`;
fs.writeFileSync(outPath, body);
console.log(`Wrote ${outPath} (${Object.keys(brands).length} brands, ${Object.keys(models).length} model keys)`);
