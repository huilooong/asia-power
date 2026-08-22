import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listVisualV1HtmlFiles, parsePorcelainPath } from '../scripts/lib/release-manager.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fromHead(rel) {
  const result = spawnSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, `cannot read HEAD:${rel}`);
  return result.stdout;
}

function titleText(html) {
  return (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((value) => new RegExp(`\\bname=["']${name}["']`, 'i').test(value));
  return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
}

function canonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((value) => /\brel=["']canonical["']/i.test(value));
  return tag?.match(/\bhref=["']([^"']*)["']/i)?.[1] || '';
}

function jsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim());
}

test('site-wide visual shell preserves title text, description, canonical and JSON-LD', () => {
  for (const rel of listVisualV1HtmlFiles(ROOT)) {
    const before = fromHead(rel);
    const after = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(titleText(after), titleText(before), `${rel} title text`);
    assert.equal(metaContent(after, 'description'), metaContent(before, 'description'), `${rel} description`);
    assert.equal(canonicalHref(after), canonicalHref(before), `${rel} canonical`);
    assert.deepEqual(jsonLd(after), jsonLd(before), `${rel} JSON-LD`);
  }
});

test('candidate diff touches no business data and only the allowlisted API brand/security files', () => {
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(status.status, 0);
  const changed = status.stdout.split('\n').filter(Boolean).map(parsePorcelainPath).filter(Boolean);
  const denied = changed.filter((rel) => /^(server|data|uploads|deploy\/inventory-site-server|assets\/home-v4-inventory-snapshot\.json)/.test(rel)
    && !['server/lib/vin/zh-en-seed.js', 'server/lib/security-paths.js'].includes(rel));
  assert.deepEqual(denied, [], `business/data boundary violated: ${denied.join(', ')}`);
});
