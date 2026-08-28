#!/usr/bin/env node
/**
 * Apply the powertrain model-image release to the current production catalog
 * without replacing production files that contain newer unrelated fixes.
 *
 * Usage:
 *   node scripts/apply-powertrain-image-release.mjs <public-root> <source-root>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 'powertrain-model-images-v1';

const BASELINE_SHA256 = Object.freeze({
  'engines/index.html': '274f80c986f3d4f58cc237ebb948b764941d1676e828cdf36f4aebf18e743781',
  'gearboxes/index.html': '06ca75c0d390015159dd77d6e83dc274171e4736b378d56d6e63ebf402acc0d3',
  'js/half-cut-directory.js': '7792f3fb97dd7c2a0a405699ca5042c63689625786866d181bb4787c494fd88b',
  'js/ebay-catalog-hub.js': 'aef06066979fa9696aa229d3a7dbc3d42a8fdf68225d415827af4a5e22f8eb79',
  'css/ebay-layout.css': '25ffa20c54aa021e2fea4d364baa9959d4b4b9021288027bbf701ab39f09c6c9',
});

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(root, relativePath, text) {
  fs.writeFileSync(path.join(root, relativePath), text);
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function replaceOnce(text, before, after, label) {
  const count = countOccurrences(text, before);
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return text.replace(before, after);
}

function extractFunction(source, name) {
  const startNeedle = `  function ${name}(`;
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`source function not found: ${name}`);
  const open = source.indexOf('{', start);
  if (open < 0) throw new Error(`source function has no body: ${name}`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`source function has no closing brace: ${name}`);
}

function replaceFunction(target, name, replacement) {
  return replaceOnce(target, extractFunction(target, name), replacement, `replace function ${name}`);
}

function insertBeforeFunction(target, name, addition) {
  const needle = `  function ${name}(`;
  if (countOccurrences(target, needle) !== 1) {
    throw new Error(`insert before ${name}: target function count is not one`);
  }
  return target.replace(needle, `${addition}\n\n${needle}`);
}

function extractRange(source, startNeedle, endNeedle, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`${label}: start marker missing`);
  const end = source.indexOf(endNeedle, start);
  if (end < 0) throw new Error(`${label}: end marker missing`);
  return source.slice(start, end);
}

function assertBaseline(relativePath, current, alreadyApplied) {
  if (alreadyApplied) return;
  const actual = sha256(current);
  const expected = BASELINE_SHA256[relativePath];
  if (actual !== expected) {
    throw new Error(`${relativePath}: production drift detected; expected ${expected}, found ${actual}`);
  }
}

function patchHalfCutDirectory(publicRoot, sourceRoot) {
  const relativePath = 'js/half-cut-directory.js';
  const source = read(sourceRoot, relativePath);
  let current = read(publicRoot, relativePath);
  const alreadyApplied = current.includes('data-image-policy="rights-cleared-model-photo"')
    && current.includes('function formatTransmissionCatalogPrimaryTitle')
    && current.includes("if (partType === 'engine' || partType === 'transmission') return null;");
  assertBaseline(relativePath, current, alreadyApplied);

  if (!alreadyApplied) {
    const oldComment = `  /**
   * Parts catalog photo picker — parallel with listing rules:
   * - Dedicated uploads: labeled part photo, else first real photo
   * - Rule-based half-cuts: original rule (engine needs Engine label; others label or photos[0])
   * - Placeholder only when this returns null (truly no usable photo)
   */`;
    const newComment = `  /**
   * Inventory albums are never used as engine/gearbox catalog imagery. Those
   * categories require a rights-cleared, exact-model record from
   * PowertrainImageCatalog; otherwise the catalog renderer shows a placeholder.
   * Other parts categories retain their existing dedicated-upload behaviour.
   */`;
    current = replaceOnce(current, oldComment, newComment, 'powertrain picker policy comment');
    current = replaceFunction(current, 'pickPartListingPhoto', extractFunction(source, 'pickPartListingPhoto'));
    current = insertBeforeFunction(
      current,
      'normEngineCatalogCode',
      extractFunction(source, 'resolvePowertrainModelImage'),
    );
    current = insertBeforeFunction(
      current,
      'formatEngineCatalogPrimaryTitle',
      extractFunction(source, 'formatTransmissionCatalogPrimaryTitle'),
    );
    current = replaceFunction(
      current,
      'partsCatalogPlaceholderSrc',
      extractFunction(source, 'partsCatalogPlaceholderSrc'),
    );
    current = insertBeforeFunction(
      current,
      'renderPartListingPhoto',
      extractFunction(source, 'renderPowertrainImageSource'),
    );

    let renderPart = extractFunction(source, 'renderPartListingPhoto');
    const photoNeedle = '    const photo = pickPartListingPhoto(display, partType);';
    const preserveOtherVideoCovers = `    if (partType !== 'engine' && partType !== 'transmission') {
      const videoCover = renderListingVideoCover(display, 'ebay-listing-row__photo ebay-listing-row__photo--part');
      if (videoCover) return videoCover;
    }

${photoNeedle}`;
    renderPart = replaceOnce(
      renderPart,
      photoNeedle,
      preserveOtherVideoCovers,
      'preserve non-powertrain video covers',
    );
    current = replaceFunction(current, 'renderPartListingPhoto', renderPart);
    current = replaceOnce(
      current,
      '    formatPartsCatalogPrimaryTitle,\n    formatEngineCatalogPrimaryTitle,',
      '    formatPartsCatalogPrimaryTitle,\n    formatTransmissionCatalogPrimaryTitle,\n    formatEngineCatalogPrimaryTitle,',
      'export transmission title helper',
    );
    current = replaceOnce(
      current,
      '    pickPartListingPhoto,\n    partsCatalogPlaceholderSrc,',
      '    pickPartListingPhoto,\n    resolvePowertrainModelImage,\n    partsCatalogPlaceholderSrc,',
      'export model image resolver',
    );
    write(publicRoot, relativePath, current);
  }

  const finalText = read(publicRoot, relativePath);
  const required = [
    'function resolvePowertrainModelImage',
    'function formatTransmissionCatalogPrimaryTitle',
    'Source / 来源:',
    'data-image-policy="rights-cleared-model-photo"',
    "engine: 'assets/images/powertrain-photo-placeholder.svg'",
    "transmission: 'assets/images/powertrain-photo-placeholder.svg'",
    "if (partType === 'engine' || partType === 'transmission') return null;",
  ];
  required.forEach((marker) => {
    if (!finalText.includes(marker)) throw new Error(`${relativePath}: missing marker ${marker}`);
  });
  return alreadyApplied ? 'unchanged' : 'patched';
}

function patchCatalogHub(publicRoot, sourceRoot) {
  const relativePath = 'js/ebay-catalog-hub.js';
  const source = read(sourceRoot, relativePath);
  let current = read(publicRoot, relativePath);
  const alreadyApplied = current.includes("page === 'gearboxes'")
    && current.includes('formatTransmissionCatalogPrimaryTitle?.(display)');
  assertBaseline(relativePath, current, alreadyApplied);

  if (!alreadyApplied) {
    const start = '    const primaryTitle =';
    const end = '    const priceLabel =';
    const productionTitle = extractRange(current, start, end, 'production primary title');
    const desiredTitle = extractRange(source, start, end, 'source primary title');
    current = replaceOnce(current, productionTitle, desiredTitle, 'gearbox verified model title');
    write(publicRoot, relativePath, current);
  }

  const finalText = read(publicRoot, relativePath);
  if (!finalText.includes('formatTransmissionCatalogPrimaryTitle?.(display)')) {
    throw new Error(`${relativePath}: gearbox title helper missing after patch`);
  }
  return alreadyApplied ? 'unchanged' : 'patched';
}

function patchLayout(publicRoot, sourceRoot) {
  const relativePath = 'css/ebay-layout.css';
  const source = read(sourceRoot, relativePath);
  let current = read(publicRoot, relativePath);
  const alreadyApplied = current.includes('.ap-model-image-credit {');
  assertBaseline(relativePath, current, alreadyApplied);

  if (!alreadyApplied) {
    const creditBlock = extractRange(
      source,
      '.ap-model-image-credit {',
      '/* Half-cut / vehicle list:',
      'source attribution CSS',
    ).trimEnd();
    const containBlock = `.ap-listing-photo--fit-contain .ap-listing-photo__img,
.ap-listing-photo--fit-contain img {
  object-fit: contain;
  object-position: center center;
  background: #eef1f4;
}`;
    current = replaceOnce(
      current,
      containBlock,
      `${containBlock}\n${creditBlock}`,
      'insert source attribution CSS',
    );
    write(publicRoot, relativePath, current);
  }

  const finalText = read(publicRoot, relativePath);
  if (!finalText.includes('.ap-model-image-credit a:focus-visible')) {
    throw new Error(`${relativePath}: attribution link style missing after patch`);
  }
  return alreadyApplied ? 'unchanged' : 'patched';
}

function patchCatalogPage(publicRoot, relativePath) {
  let current = read(publicRoot, relativePath);
  const alreadyApplied = current.includes(`powertrain-image-catalog.js?v=${VERSION}`);
  assertBaseline(relativePath, current, alreadyApplied);

  if (!alreadyApplied) {
    const catalogTag = `  <script src="../js/powertrain-image-catalog.js?v=${VERSION}"></script>`;
    const directoryTag = current.match(/  <script src="\.\.\/js\/half-cut-directory\.js\?v=[^"]+"><\/script>/)?.[0];
    if (!directoryTag) throw new Error(`${relativePath}: half-cut directory script tag missing`);
    current = replaceOnce(current, directoryTag, `${catalogTag}\n${directoryTag}`, `${relativePath} catalog script`);
    current = current.replace(
      /ebay-layout\.css\?v=[^"']+/,
      `ebay-layout.css?v=${VERSION}`,
    );
    current = current.replace(
      /half-cut-directory\.js\?v=[^"']+/,
      `half-cut-directory.js?v=site-media-resilience-v3-20260822-${VERSION}`,
    );
    current = current.replace(
      /ebay-catalog-hub\.js\?v=[^"']+/,
      `ebay-catalog-hub.js?v=site-media-resilience-v3-20260822-${VERSION}`,
    );
    write(publicRoot, relativePath, current);
  }

  const finalText = read(publicRoot, relativePath);
  const required = [
    `ebay-layout.css?v=${VERSION}`,
    `powertrain-image-catalog.js?v=${VERSION}`,
    `half-cut-directory.js?v=site-media-resilience-v3-20260822-${VERSION}`,
    `ebay-catalog-hub.js?v=site-media-resilience-v3-20260822-${VERSION}`,
  ];
  required.forEach((marker) => {
    if (!finalText.includes(marker)) throw new Error(`${relativePath}: missing marker ${marker}`);
  });
  if (countOccurrences(finalText, 'powertrain-image-catalog.js') !== 1) {
    throw new Error(`${relativePath}: powertrain catalog script must appear exactly once`);
  }
  return alreadyApplied ? 'unchanged' : 'patched';
}

export function applyPowertrainImageRelease(publicRoot, sourceRoot) {
  const results = {
    'js/half-cut-directory.js': patchHalfCutDirectory(publicRoot, sourceRoot),
    'js/ebay-catalog-hub.js': patchCatalogHub(publicRoot, sourceRoot),
    'css/ebay-layout.css': patchLayout(publicRoot, sourceRoot),
    'engines/index.html': patchCatalogPage(publicRoot, 'engines/index.html'),
    'gearboxes/index.html': patchCatalogPage(publicRoot, 'gearboxes/index.html'),
  };
  return results;
}

function main() {
  const publicRoot = path.resolve(process.argv[2] || '');
  const sourceRoot = path.resolve(process.argv[3] || '');
  if (!process.argv[2] || !process.argv[3]) {
    throw new Error('Usage: node apply-powertrain-image-release.mjs <public-root> <source-root>');
  }
  const results = applyPowertrainImageRelease(publicRoot, sourceRoot);
  for (const [file, status] of Object.entries(results)) {
    console.log(`[powertrain-images] ${status}: ${file}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();
