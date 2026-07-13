#!/usr/bin/env node
/**
 * OPS-003 — Post-Release Public Validation (parser-based).
 *
 * Fetches live public URLs through Cloudflare, parses HTML/JS/hrefs,
 * and fails the release when WhatsApp / title / config / SW drift.
 *
 * Usage:
 *   node scripts/post-release-validation.mjs [--base-url=https://asia-power.com] [--release-id=REL-...] [--out-dir=docs/tasks/ops-003]
 *   node scripts/lib/post-release-validation.mjs  (imported by Release Manager)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

export const EXPECTED_WHATSAPP = (process.env.APSALES_PUBLIC_WHATSAPP || '8616638801930').replace(/\D/g, '');
export const FORBIDDEN_WHATSAPP = ['233540911111', '8618603773077'];

const DEFAULT_PAGES = [
  { id: 'homepage', url: '/', kind: 'html', requireHomeHybrid: true },
  { id: 'contact', url: '/contact.html', kind: 'html' },
  { id: 'brand', url: '/brands.html', kind: 'html' },
  { id: 'engine', url: '/engines/index.html', kind: 'html' },
  { id: 'gearbox', url: '/gearboxes/index.html', kind: 'html' },
  { id: 'half_cut', url: '/half-cuts/index.html', kind: 'html' },
  { id: 'supplier_portal', url: '/supplier-portal.html', kind: 'html' },
  { id: 'config_js', url: '/js/config.js', kind: 'config' },
  { id: 'sw_js', url: '/sw.js', kind: 'sw' },
  { id: 'robots', url: '/robots.txt', kind: 'text' },
  { id: 'sitemap', url: '/sitemap.xml', kind: 'xml' },
];

/**
 * @param {string} baseUrl
 * @param {string} rel
 */
function absUrl(baseUrl, rel) {
  const base = baseUrl.replace(/\/$/, '');
  if (!rel) return base + '/';
  if (rel.startsWith('http')) return rel;
  return base + (rel.startsWith('/') ? rel : `/${rel}`);
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 */
async function fetchText(url, init = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'AsiaPower-ReleaseManager-OPS003/1.0',
      ...(init.headers || {}),
    },
    ...init,
  });
  const body = await res.text();
  const headers = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  return { status: res.status, headers, body, url: res.url || url };
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  if (!m) return '';
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1] : '';
}

function extractWaMe(html) {
  const nums = [];
  const re = /(?:https?:)?\/\/wa\.me\/(\d+)/gi;
  let m;
  while ((m = re.exec(html))) nums.push(m[1]);
  return [...new Set(nums)];
}

function extractConfigScriptSrc(html) {
  const m = html.match(/<script[^>]+src=["']([^"']*config\.js[^"']*)["']/i);
  return m ? m[1] : '';
}

function extractSwRegister(htmlOrJs) {
  const m = htmlOrJs.match(/serviceWorker\.register\(\s*['"]([^'"]+)['"]/i)
    || htmlOrJs.match(/register\(\s*['"](\/?sw\.js[^'"]*)['"]/i);
  return m ? m[1] : '';
}

function extractWhatsappFromConfig(js) {
  const m = js.match(/whatsapp\s*:\s*['"](\d+)['"]/);
  return m ? m[1] : '';
}

function extractReleaseIdFromConfig(js) {
  const m = js.match(/releaseId\s*:\s*['"]([^'"]+)['"]/)
    || js.match(/\/\*\s*RELEASE_ID:\s*([^\s*]+)\s*\*\//);
  return m ? m[1] : '';
}

function extractCacheVersion(swJs) {
  const m = swJs.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : '';
}

function hasLogo(html) {
  return /logo\.(png|webp|svg)|ASIAPOWER\.logo|class=["'][^"']*logo/i.test(html);
}

function hasJsonLd(html) {
  return /application\/ld\+json/i.test(html);
}

function hasSiteWhatsappMount(html) {
  return /id=["']site-whatsapp["']/.test(html);
}

/**
 * @param {{ baseUrl?: string, releaseId?: string, pages?: typeof DEFAULT_PAGES }} opts
 */
export async function runPublicPostReleaseValidation(opts = {}) {
  const baseUrl = (opts.baseUrl || process.env.SITE_URL || 'https://asia-power.com').replace(/\/$/, '');
  const releaseId = opts.releaseId || '';
  const pages = opts.pages || DEFAULT_PAGES;
  /** @type {any[]} */
  const checks = [];
  /** @type {Record<string, any>} */
  const pageResults = {};

  const push = (name, status, detail, extra = {}) => {
    checks.push({ name, status, detail, ...extra });
  };

  // --- HTML / asset pages ---
  for (const page of pages) {
    const url = absUrl(baseUrl, page.url);
    let fetched;
    try {
      fetched = await fetchText(url);
    } catch (err) {
      push(`${page.id}_fetch`, 'fail', String(err && err.message ? err.message : err));
      pageResults[page.id] = { url, error: String(err) };
      continue;
    }

    const { status, headers, body } = fetched;
    const cache = {
      cache_control: headers['cache-control'] || '',
      cf_cache_status: headers['cf-cache-status'] || '',
      etag: headers.etag || '',
      age: headers.age || '',
      last_modified: headers['last-modified'] || '',
    };
    pageResults[page.id] = { url, http_status: status, cache };

    if (status >= 400) {
      push(`${page.id}_http`, 'fail', `HTTP ${status} ${url}`);
      continue;
    }
    push(`${page.id}_http`, 'pass', `HTTP ${status}`);

    if (page.kind === 'html') {
      const title = extractTitle(body);
      const canonical = extractCanonical(body);
      const wa = extractWaMe(body);
      const configSrc = extractConfigScriptSrc(body);
      pageResults[page.id] = {
        ...pageResults[page.id],
        title,
        canonical,
        wa_me: wa,
        config_script_src: configSrc,
        has_logo: hasLogo(body),
        has_json_ld: hasJsonLd(body),
        has_site_whatsapp: hasSiteWhatsappMount(body),
      };

      if (!title || title.length < 8) {
        push(`${page.id}_title`, 'fail', `missing/short title: ${title || '(empty)'}`);
      } else if (page.requireHomeHybrid && !/AsiaPower/i.test(title)) {
        push(`${page.id}_title`, 'fail', `unexpected homepage title: ${title}`);
      } else if (page.requireHomeHybrid && !/home-v4-hybrid|page-home-v4/i.test(body)) {
        push(`${page.id}_home_marker`, 'fail', 'homepage missing home-v4-hybrid marker (possible MVP/old shell)');
      } else {
        push(`${page.id}_title`, 'pass', title.slice(0, 80));
      }

      if (page.id === 'homepage' || page.id === 'contact') {
        if (!canonical || !/asia-power\.com/i.test(canonical)) {
          push(`${page.id}_canonical`, 'fail', `canonical missing or wrong: ${canonical || '(none)'}`);
        } else {
          push(`${page.id}_canonical`, 'pass', canonical);
        }
      } else {
        push(`${page.id}_canonical`, canonical ? 'pass' : 'skip', canonical || 'no canonical (optional)');
      }

      // Static wa.me must be expected if present
      const badStatic = wa.filter((n) => FORBIDDEN_WHATSAPP.includes(n) || (n !== EXPECTED_WHATSAPP && n.length >= 10));
      const goodStatic = wa.filter((n) => n === EXPECTED_WHATSAPP);
      if (wa.length && !goodStatic.length) {
        push(`${page.id}_whatsapp_static`, 'fail', `wa.me numbers=${wa.join(',')}; expected ${EXPECTED_WHATSAPP}`);
      } else if (badStatic.length) {
        push(`${page.id}_whatsapp_static`, 'fail', `forbidden wa.me ${badStatic.join(',')}`);
      } else if (goodStatic.length) {
        push(`${page.id}_whatsapp_static`, 'pass', `wa.me/${EXPECTED_WHATSAPP}`);
      } else {
        push(`${page.id}_whatsapp_static`, 'skip', 'no static wa.me (float may use config)');
      }

      if (!hasLogo(body) && page.id === 'homepage') {
        push(`${page.id}_logo`, 'fail', 'logo signal not found');
      } else {
        push(`${page.id}_logo`, hasLogo(body) ? 'pass' : 'skip', hasLogo(body) ? 'logo present' : 'no logo signal');
      }

      if (page.id === 'homepage' || page.id === 'contact') {
        push(`${page.id}_jsonld`, hasJsonLd(body) ? 'pass' : 'fail', hasJsonLd(body) ? 'JSON-LD present' : 'JSON-LD missing');
      }

      push(
        `${page.id}_float_mount`,
        hasSiteWhatsappMount(body) ? 'pass' : 'skip',
        hasSiteWhatsappMount(body) ? '#site-whatsapp present' : 'no float mount',
      );

      // Resolve config actually loaded by this page
      if (configSrc) {
        const configUrl = absUrl(baseUrl, configSrc.replace(/^\.\.\//, '/').replace(/^\.\//, '/'));
        // Fix relative ../js/config.js from /engines/
        let resolved = configSrc;
        if (configSrc.startsWith('../')) {
          const pagePath = page.url.replace(/^\//, '');
          const dir = pagePath.includes('/') ? pagePath.replace(/\/[^/]+$/, '/') : '';
          resolved = path.posix.normalize(`/${dir}${configSrc}`);
        } else if (!configSrc.startsWith('/') && !configSrc.startsWith('http')) {
          resolved = `/${configSrc}`;
        } else {
          resolved = configSrc.startsWith('http') ? configSrc : configSrc;
        }
        const cfgAbs = resolved.startsWith('http') ? resolved : absUrl(baseUrl, resolved);
        try {
          const cfg = await fetchText(cfgAbs);
          const waCfg = extractWhatsappFromConfig(cfg.body);
          pageResults[page.id].resolved_config_url = cfgAbs;
          pageResults[page.id].resolved_config_whatsapp = waCfg;
          pageResults[page.id].resolved_config_cache = {
            cache_control: cfg.headers['cache-control'] || '',
            cf_cache_status: cfg.headers['cf-cache-status'] || '',
            etag: cfg.headers.etag || '',
          };
          if (waCfg !== EXPECTED_WHATSAPP) {
            push(
              `${page.id}_config_whatsapp`,
              'fail',
              `page loads ${cfgAbs} → whatsapp='${waCfg || '?'}' (expected ${EXPECTED_WHATSAPP})`,
            );
          } else {
            push(`${page.id}_config_whatsapp`, 'pass', `float will use wa.me/${waCfg} via ${cfgAbs}`);
          }
          if (FORBIDDEN_WHATSAPP.some((f) => cfg.body.includes(f))) {
            push(`${page.id}_config_forbidden`, 'fail', `resolved config still contains forbidden WhatsApp`);
          }
        } catch (err) {
          push(`${page.id}_config_fetch`, 'fail', String(err && err.message ? err.message : err));
        }
      }
    }

    if (page.kind === 'config') {
      const waCfg = extractWhatsappFromConfig(body);
      const rid = extractReleaseIdFromConfig(body);
      pageResults[page.id].whatsapp = waCfg;
      pageResults[page.id].release_id = rid;
      // Bare config.js is the CF poison path — must be correct OR we fail hard
      if (waCfg !== EXPECTED_WHATSAPP) {
        push(
          'config_js_whatsapp',
          'fail',
          `bare /js/config.js whatsapp='${waCfg || '?'}' (expected ${EXPECTED_WHATSAPP}) — likely Cloudflare cache poison`,
        );
      } else {
        push('config_js_whatsapp', 'pass', `whatsapp=${waCfg}`);
      }
      if (FORBIDDEN_WHATSAPP.some((f) => body.includes(f))) {
        push('config_js_forbidden', 'fail', 'forbidden legacy WhatsApp still in bare config.js');
      }
      // Cache policy warning (not fail if WhatsApp correct)
      const cc = cache.cache_control || '';
      if (/immutable/i.test(cc) && /max-age=31536000/i.test(cc)) {
        push(
          'config_js_cache_policy',
          'fail',
          `dangerous Cache-Control on config.js: ${cc} (APCONTACT incident class)`,
        );
      } else {
        push('config_js_cache_policy', 'pass', cc || '(no cache-control)');
      }
      push('config_js_cf', 'pass', `cf=${cache.cf_cache_status || 'n/a'} age=${cache.age || '0'}`);
      if (releaseId && rid && rid !== releaseId && rid !== 'local-dev') {
        push('config_js_release_id', 'fail', `config releaseId=${rid} != deploy ${releaseId}`);
      } else if (rid) {
        push('config_js_release_id', 'pass', `releaseId=${rid}`);
      } else {
        push('config_js_release_id', 'skip', 'releaseId not stamped yet (OPS-003 phase-2)');
      }
    }

    if (page.kind === 'sw') {
      const ver = extractCacheVersion(body);
      pageResults[page.id].cache_version = ver;
      if (!ver) {
        push('sw_version', 'fail', 'CACHE_VERSION not found in sw.js');
      } else {
        push('sw_version', 'pass', `CACHE_VERSION=${ver}`);
      }
      // If SW still precaches bare /js/config.js without query — warn/fail
      if (/['"]\/js\/config\.js['"]/.test(body) && !/\/js\/config\.js\?/.test(body)) {
        push('sw_precache_config', 'fail', 'sw.js still precaches bare /js/config.js (CF poison risk)');
      } else {
        push('sw_precache_config', 'pass', 'no bare config.js precache (or versioned)');
      }
      const cc = cache.cache_control || '';
      if (/immutable/i.test(cc) && /max-age=31536000/i.test(cc)) {
        push('sw_cache_policy', 'fail', `dangerous Cache-Control on sw.js: ${cc}`);
      } else {
        push('sw_cache_policy', 'pass', cc || '(no cache-control)');
      }
    }

    if (page.kind === 'text') {
      if (!/sitemap|user-agent|disallow|allow/i.test(body)) {
        push('robots_content', 'fail', 'robots.txt looks empty/invalid');
      } else {
        push('robots_content', 'pass', `bytes=${body.length}`);
      }
    }

    if (page.kind === 'xml') {
      if (!/<urlset|<sitemapindex/i.test(body)) {
        push('sitemap_content', 'fail', 'sitemap.xml missing urlset/sitemapindex');
      } else {
        push('sitemap_content', 'pass', `bytes=${body.length}`);
      }
    }
  }

  // --- pwa-install registration path (homepage chain) ---
  try {
    const home = await fetchText(absUrl(baseUrl, '/'));
    const pwaSrc = (home.body.match(/<script[^>]+src=["']([^"']*pwa-install\.js[^"']*)["']/i) || [])[1];
    if (pwaSrc) {
      let resolved = pwaSrc;
      if (!resolved.startsWith('http') && !resolved.startsWith('/')) resolved = `/${resolved}`;
      const pwa = await fetchText(resolved.startsWith('http') ? resolved : absUrl(baseUrl, resolved));
      const reg = extractSwRegister(pwa.body);
      pageResults.pwa_install = { src: resolved, sw_register: reg };
      if (reg === '/sw.js') {
        push('sw_register', 'fail', 'pwa-install registers bare /sw.js (CF poison risk)');
      } else if (reg) {
        push('sw_register', 'pass', `registers ${reg}`);
        const swUrl = absUrl(baseUrl, reg);
        const sw = await fetchText(swUrl);
        const ver = extractCacheVersion(sw.body);
        if (!ver) push('sw_register_body', 'fail', `registered SW missing CACHE_VERSION (${swUrl})`);
        else push('sw_register_body', 'pass', `${swUrl} → ${ver}`);
      } else {
        push('sw_register', 'skip', 'no register() found in pwa-install');
      }
    } else {
      push('sw_register', 'skip', 'homepage does not load pwa-install.js');
    }
  } catch (err) {
    push('sw_register', 'fail', String(err && err.message ? err.message : err));
  }

  const failed = checks.filter((c) => c.status === 'fail');
  return {
    status: failed.length ? 'fail' : 'pass',
    base_url: baseUrl,
    release_id: releaseId,
    expected_whatsapp: EXPECTED_WHATSAPP,
    checked_at: new Date().toISOString(),
    checks,
    pages: pageResults,
    fail_count: failed.length,
    pass_count: checks.filter((c) => c.status === 'pass').length,
  };
}

/**
 * Attempt Cloudflare purge for critical assets. Never throws.
 * @param {{ zoneId?: string, token?: string, files?: string[], baseUrl?: string }} opts
 */
export async function attemptCloudflarePurge(opts = {}) {
  const baseUrl = (opts.baseUrl || 'https://asia-power.com').replace(/\/$/, '');
  const zoneId = opts.zoneId || process.env.CLOUDFLARE_ZONE_ID || '';
  const token = opts.token || process.env.CLOUDFLARE_API_TOKEN || '';
  const files = opts.files || [
    `${baseUrl}/js/config.js`,
    `${baseUrl}/js/components.js`,
    `${baseUrl}/sw.js`,
    `${baseUrl}/js/pwa-install.js`,
    `${baseUrl}/`,
    `${baseUrl}/index.html`,
    `${baseUrl}/contact.html`,
  ];

  if (!zoneId || !token) {
    return {
      status: 'manual_action_required',
      detail: 'CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN missing — Manual Action Required: purge config.js, sw.js, components.js in Cloudflare dashboard',
      files,
    };
  }

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    });
    const data = await res.json();
    if (data && data.success) {
      return { status: 'pass', detail: `purged ${files.length} URLs`, files, result: data.result };
    }
    const errMsg = (data && data.errors && data.errors[0] && data.errors[0].message) || `HTTP ${res.status}`;
    return {
      status: 'manual_action_required',
      detail: `Cloudflare purge failed (${errMsg}) — Manual Action Required: purge config.js / sw.js / components.js in dashboard`,
      files,
      errors: data && data.errors,
    };
  } catch (err) {
    return {
      status: 'manual_action_required',
      detail: `Cloudflare purge error: ${err && err.message ? err.message : err} — Manual Action Required`,
      files,
    };
  }
}

/**
 * Stamp releaseId into local js/config.js (in-memory deploy copy path).
 * Does not change WhatsApp / SEO / page markup.
 * @param {string} root
 * @param {string} releaseId
 */
export function stampReleaseIdIntoConfig(root, releaseId) {
  const cfgPath = path.join(root, 'js', 'config.js');
  if (!fs.existsSync(cfgPath)) return { ok: false, detail: 'js/config.js missing' };
  let text = fs.readFileSync(cfgPath, 'utf8');
  if (/releaseId\s*:/.test(text)) {
    text = text.replace(/releaseId\s*:\s*['"][^'"]*['"]/, `releaseId: '${releaseId}'`);
  } else {
    // Insert after opening ASIAPOWER = {
    text = text.replace(
      /(const\s+ASIAPOWER\s*=\s*\{)/,
      `$1\n  releaseId: '${releaseId}',`,
    );
  }
  if (!/\/\*\s*RELEASE_ID:/.test(text)) {
    text = `${text.replace(/\s*$/, '')}\n/* RELEASE_ID: ${releaseId} */\n`;
  } else {
    text = text.replace(/\/\*\s*RELEASE_ID:\s*[^*]+\*\//, `/* RELEASE_ID: ${releaseId} */`);
  }
  fs.writeFileSync(cfgPath, text);
  return { ok: true, detail: `stamped releaseId=${releaseId} into js/config.js` };
}

export function writeValidationReports(outDir, report, purge) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'post-release-validation.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify({ report, purge }, null, 2)}\n`);

  const lines = (title, body) => {
    fs.writeFileSync(path.join(outDir, title), body.endsWith('\n') ? body : `${body}\n`);
  };

  lines(
    'production-health.md',
    [
      `# OPS-003 Production Health`,
      ``,
      `- Checked at: ${report.checked_at}`,
      `- Base URL: ${report.base_url}`,
      `- Release: ${report.release_id || '(n/a)'}`,
      `- Status: **${report.status.toUpperCase()}**`,
      `- Pass: ${report.pass_count} / Fail: ${report.fail_count}`,
      `- Expected WhatsApp: ${report.expected_whatsapp}`,
      ``,
      `## Checks`,
      ``,
      ...report.checks.map((c) => `- **${c.status.toUpperCase()}** \`${c.name}\`: ${c.detail}`),
      ``,
      purge
        ? `## Cloudflare purge\n\n- Status: **${purge.status}**\n- ${purge.detail}\n`
        : '',
    ].join('\n'),
  );

  lines(
    'release-validation.md',
    [
      `# OPS-003 Release Validation`,
      ``,
      `Parser-based public validation (not HTTP-200-only).`,
      ``,
      `| Field | Value |`,
      `|---|---|`,
      `| release_id | ${report.release_id || '—'} |`,
      `| status | ${report.status} |`,
      `| base_url | ${report.base_url} |`,
      `| expected_whatsapp | ${report.expected_whatsapp} |`,
      ``,
      `Failed checks: ${report.fail_count}`,
      ``,
      ...report.checks.filter((c) => c.status === 'fail').map((c) => `- FAIL \`${c.name}\`: ${c.detail}`),
      report.fail_count ? '' : '- (none)',
    ].join('\n'),
  );

  lines(
    'cache-validation.md',
    [
      `# OPS-003 Cache Validation`,
      ``,
      ...Object.entries(report.pages || {}).map(([id, p]) => {
        const c = p.cache || {};
        return [
          `## ${id}`,
          ``,
          `- URL: ${p.url || ''}`,
          `- CF-Cache-Status: ${c.cf_cache_status || '—'}`,
          `- Cache-Control: ${c.cache_control || '—'}`,
          `- ETag: ${c.etag || '—'}`,
          `- Age: ${c.age || '—'}`,
          `- Last-Modified: ${c.last_modified || '—'}`,
          p.resolved_config_url
            ? `- Resolved config: ${p.resolved_config_url} (whatsapp=${p.resolved_config_whatsapp})`
            : '',
          '',
        ].filter(Boolean).join('\n');
      }),
      purge ? `\n## Purge attempt\n\n- ${purge.status}: ${purge.detail}\n` : '',
    ].join('\n'),
  );

  lines(
    'public-validation.md',
    [
      `# OPS-003 Public Validation`,
      ``,
      `| Page | Title / Version | WhatsApp |`,
      `|---|---|---|`,
      ...['homepage', 'contact', 'brand', 'engine', 'gearbox', 'half_cut', 'supplier_portal'].map((id) => {
        const p = (report.pages || {})[id] || {};
        const wa = (p.wa_me && p.wa_me.length)
          ? p.wa_me.map((n) => `wa.me/${n}`).join(', ')
          : (p.resolved_config_whatsapp ? `float→${p.resolved_config_whatsapp}` : '—');
        return `| ${id} | ${(p.title || p.cache_version || '').toString().slice(0, 60)} | ${wa} |`;
      }),
      `| config.js | releaseId=${(report.pages?.config_js || {}).release_id || '—'} | ${(report.pages?.config_js || {}).whatsapp || '—'} |`,
      `| sw.js | ${(report.pages?.sw_js || {}).cache_version || '—'} | — |`,
    ].join('\n'),
  );

  return { jsonPath, outDir };
}

// CLI
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain || process.argv[1]?.endsWith('post-release-validation.mjs')) {
  const args = process.argv.slice(2);
  const get = (k, def = '') => {
    const hit = args.find((a) => a.startsWith(`${k}=`));
    return hit ? hit.slice(k.length + 1) : def;
  };
  const baseUrl = get('--base-url', process.env.SITE_URL || 'https://asia-power.com');
  const releaseId = get('--release-id', '');
  const outDir = path.resolve(ROOT, get('--out-dir', 'docs/tasks/ops-003'));

  const report = await runPublicPostReleaseValidation({ baseUrl, releaseId });
  const purge = await attemptCloudflarePurge({ baseUrl });
  writeValidationReports(outDir, report, purge);

  console.log(`[ops-003] status=${report.status} pass=${report.pass_count} fail=${report.fail_count}`);
  console.log(`[ops-003] purge=${purge.status}: ${purge.detail}`);
  console.log(`[ops-003] reports → ${outDir}`);
  for (const c of report.checks.filter((x) => x.status === 'fail')) {
    console.log(`  FAIL ${c.name}: ${c.detail}`);
  }
  process.exit(report.status === 'pass' ? 0 : 1);
}
