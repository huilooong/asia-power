#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_REPORT = path.join(ROOT, 'docs/cto/production-001.md');
const OUTPUT_REPORT = path.join(ROOT, 'docs/cto/task-008-page-validation.md');

function readProductionPages() {
  const report = fs.readFileSync(SOURCE_REPORT, 'utf8');
  const generatedSection = report.split('## Data Sources Used')[0] || report;
  const matches = [...generatedSection.matchAll(/`(engines\/[^`]+\.html)`/g)];
  return matches.map((match) => match[1]);
}

function hasJsonLd(html) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) return false;
  return blocks.every((block) => {
    try {
      JSON.parse(block[1].trim());
      return true;
    } catch {
      return false;
    }
  });
}

function checkPage(pagePath) {
  const absolutePath = path.join(ROOT, pagePath);
  const result = {
    page: pagePath,
    exists: fs.existsSync(absolutePath),
    title: false,
    metaDescription: false,
    canonical: false,
    jsonLd: false,
    whatsappCta: false,
  };

  if (!result.exists) {
    result.pass = false;
    return result;
  }

  const html = fs.readFileSync(absolutePath, 'utf8');
  result.title = /<title>[^<]+<\/title>/i.test(html);
  result.metaDescription = /<meta\s+name=["']description["']\s+content=["'][^"']+["']\s*\/?>/i.test(html);
  result.canonical = /<link\s+rel=["']canonical["']\s+href=["'][^"']+["']\s*\/?>/i.test(html);
  result.jsonLd = hasJsonLd(html);
  result.whatsappCta = /https:\/\/wa\.me\//i.test(html) || /WhatsApp/i.test(html);
  result.pass = result.exists && result.title && result.metaDescription && result.canonical && result.jsonLd && result.whatsappCta;
  return result;
}

function status(value) {
  return value ? 'PASS' : 'FAIL';
}

function writeConsole(results) {
  for (const result of results) {
    const missing = [
      ['file', result.exists],
      ['title', result.title],
      ['meta description', result.metaDescription],
      ['canonical', result.canonical],
      ['JSON-LD', result.jsonLd],
      ['WhatsApp CTA', result.whatsappCta],
    ]
      .filter(([, ok]) => !ok)
      .map(([name]) => name);

    const suffix = missing.length ? ` - missing: ${missing.join(', ')}` : '';
    console.log(`${status(result.pass)} ${result.page}${suffix}`);
  }

  const total = results.length;
  const passed = results.filter((result) => result.pass).length;
  const failed = total - passed;
  console.log('');
  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
}

function writeMarkdown(results) {
  const total = results.length;
  const passed = results.filter((result) => result.pass).length;
  const failed = total - passed;
  const lines = [
    '# TASK-008 Page Validation',
    '',
    '## Scope',
    '',
    'This report validates the Production-001 engine pages listed in `docs/cto/production-001.md`.',
    '',
    'The validation checks whether each page file exists and contains:',
    '',
    '- `<title>`',
    '- Meta description',
    '- Canonical link',
    '- Valid JSON-LD block',
    '- WhatsApp CTA',
    '',
    'No page content was modified by this validation.',
    '',
    '## Summary',
    '',
    `- Total: ${total}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    '',
    '## Page Results',
    '',
    '| Page | Result | File | Title | Meta Description | Canonical | JSON-LD | WhatsApp CTA |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const result of results) {
    lines.push([
      `| \`${result.page}\``,
      status(result.pass),
      status(result.exists),
      status(result.title),
      status(result.metaDescription),
      status(result.canonical),
      status(result.jsonLd),
      `${status(result.whatsappCta)} |`,
    ].join(' | '));
  }

  lines.push('');
  lines.push('## Conclusion');
  lines.push('');
  lines.push(failed === 0 ? 'All Production-001 engine pages passed the required TASK-008 validation checks.' : 'One or more Production-001 engine pages failed the required TASK-008 validation checks.');
  lines.push('');

  fs.mkdirSync(path.dirname(OUTPUT_REPORT), { recursive: true });
  fs.writeFileSync(OUTPUT_REPORT, lines.join('\n'), 'utf8');
}

const pages = readProductionPages();
const results = pages.map(checkPage);
writeConsole(results);

if (process.argv.includes('--write-doc')) {
  writeMarkdown(results);
  console.log('');
  console.log(`Report: ${path.relative(ROOT, OUTPUT_REPORT)}`);
}
