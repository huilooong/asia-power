#!/usr/bin/env node
/**
 * Local tests for AsiaPower PWA install UX (no browser required for core logic).
 * Run: node scripts/test-pwa-install.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function pass(name) {
  console.log('PASS -', name);
}
function fail(name, detail) {
  failed += 1;
  console.error('FAIL -', name, detail || '');
}

function assert(cond, name, detail) {
  if (cond) pass(name);
  else fail(name, detail);
}

// --- Static asset / source checks ---
const jsPath = path.join(ROOT, 'js/pwa-install.js');
const cssPath = path.join(ROOT, 'css/pwa-install.css');
const indexPath = path.join(ROOT, 'index.html');
const appPath = path.join(ROOT, 'app.html');
const manifestPath = path.join(ROOT, 'manifest.json');

const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const appHtml = fs.readFileSync(appPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert(js.includes('AsiaPowerPwaInstall'), 'exports AsiaPowerPwaInstall API');
assert(js.includes('ap-pwa-fab') && js.includes('ap-pwa-sheet'), 'builds FAB + sheet');
assert(!/button\.disabled\s*=\s*true[\s\S]{0,80}添加到桌面/.test(js), 'fallback CTA is not a disabled dead button');
assert(js.includes('beforeinstallprompt') && js.includes('prompt()'), 'native install prompt path present');
assert(js.includes('Add to Home Screen') || js.includes('添加到主屏幕'), 'iOS steps present');
assert(css.includes('.ap-pwa-fab') && css.includes('.ap-pwa-sheet__panel'), 'CSS for FAB + sheet');
assert(indexHtml.includes('pwa-install-v2') && indexHtml.includes('css/pwa-install.css'), 'homepage wires v2 assets');
assert(appHtml.includes('id="app-page-install"') && appHtml.includes('pwa-install-v2'), 'app.html install CTA wired');
assert(manifest.display === 'standalone', 'manifest standalone');
assert(manifest.theme_color === '#0a1628', 'manifest theme_color app navy');
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest icons present');

for (const icon of ['assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png']) {
  assert(fs.existsSync(path.join(ROOT, icon)), `icon exists ${icon}`);
}

// --- DOM simulation (minimal) ---
function createDomEnv(userAgent) {
  const listeners = {};
  const bodyChildren = [];
  const body = {
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    appendChild(el) { bodyChildren.push(el); return el; },
  };
  const document = {
    documentElement: { lang: 'zh-CN' },
    body,
    readyState: 'complete',
    head: {
      appendChild() {},
      querySelector() { return null; },
    },
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        type: '',
        className: '',
        hidden: false,
        disabled: false,
        innerHTML: '',
        textContent: '',
        style: {},
        attributes: {},
        children: [],
        classList: {
          _set: new Set(),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          contains(c) { return this._set.has(c); },
        },
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        querySelector(sel) {
          if (sel.includes('data-ap-pwa-install')) {
            return this._primary || (this._primary = {
              textContent: '',
              disabled: false,
              focus() {},
            });
          }
          if (sel.includes('data-ap-pwa-hint')) {
            return this._hint || (this._hint = { textContent: '' });
          }
          if (sel.includes('data-ap-pwa-steps')) {
            return this._steps || (this._steps = { innerHTML: '', scrollIntoView() {} });
          }
          if (sel.includes('ap-pwa-fab-title')) {
            return this._title || (this._title = { textContent: '' });
          }
          if (sel.includes('ap-pwa-fab-sub')) {
            return this._sub || (this._sub = { textContent: '' });
          }
          return null;
        },
        querySelectorAll() { return []; },
        addEventListener(type, fn) {
          this._listeners = this._listeners || {};
          (this._listeners[type] = this._listeners[type] || []).push(fn);
        },
        closest(sel) {
          if (sel.includes('data-ap-pwa-install') && this.hasAttribute('data-ap-pwa-install')) return this;
          if (sel.includes('data-ap-pwa-close') && this.hasAttribute('data-ap-pwa-close')) return this;
          return null;
        },
        hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
      };
      return el;
    },
    querySelector(sel) {
      if (sel.includes('data-ap-pwa-css')) return { rel: 'stylesheet' };
      return null;
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
  };
  const windowObj = {
    document,
    navigator: {
      userAgent,
      serviceWorker: {
        register() { return Promise.resolve({ scope: '/' }); },
      },
      standalone: false,
    },
    matchMedia(q) {
      return { matches: String(q).includes('standalone') ? false : false };
    },
    localStorage: (() => {
      const map = new Map();
      return {
        getItem(k) { return map.has(k) ? map.get(k) : null; },
        setItem(k, v) { map.set(k, String(v)); },
        removeItem(k) { map.delete(k); },
      };
    })(),
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    dispatchEvent(evt) {
      const list = listeners[evt.type] || [];
      list.forEach((fn) => fn(evt));
      return true;
    },
    setTimeout: global.setTimeout,
    SitePaths: { href: (p) => '/' + p.replace(/^\//, '') },
  };
  return { window: windowObj, document, listeners, bodyChildren };
}

async function runDomTests() {
  // Evaluate script in a Function sandbox with mocked window/document
  const source = fs.readFileSync(jsPath, 'utf8');
  const env = createDomEnv('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  const fn = new Function('window', 'document', 'navigator', 'localStorage', `${source}\nreturn window.AsiaPowerPwaInstall;`);
  const api = fn(env.window, env.document, env.window.navigator, env.window.localStorage);
  assert(!!api, 'API available after boot');
  assert(api.detectPlatform().ios === true, 'detects iOS Safari UA');
  assert(api.isStandalone() === false, 'not standalone by default');

  api.openSheet();
  const sheet = env.bodyChildren.find((el) => el.className === 'ap-pwa-sheet');
  assert(!!sheet && sheet.hidden === false, 'openSheet shows install sheet');
  assert(sheet.getAttribute('role') === 'dialog', 'sheet is a dialog');

  // FAB must be enabled (not a dead disabled control)
  const fab = env.bodyChildren.find((el) => el.className && String(el.className).includes('ap-pwa-fab'));
  assert(!!fab, 'FAB created');
  assert(fab.disabled !== true, 'FAB is clickable (not disabled)');
  assert(fab.hidden === false, 'FAB visible on homepage-like boot');

  // Native prompt path
  const env2 = createDomEnv('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
  const fn2 = new Function('window', 'document', 'navigator', 'localStorage', `${source}\nreturn window.AsiaPowerPwaInstall;`);
  const api2 = fn2(env2.window, env2.document, env2.window.navigator, env2.window.localStorage);
  let prompted = false;
  const fakeEvent = {
    type: 'beforeinstallprompt',
    preventDefault() {},
    prompt() { prompted = true; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  };
  env2.window.dispatchEvent(fakeEvent);
  assert(!!api2.getDeferredPrompt(), 'captures beforeinstallprompt');
  api2.openSheet();
  api2._test.runInstall();
  assert(prompted === true, 'runInstall calls native prompt when available');
}

await runDomTests();

// --- HTTP smoke for local file server serving assets ---
await new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/manifest+json',
      '.png': 'image/png',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  server.listen(0, '127.0.0.1', async () => {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    try {
      for (const p of [
        '/js/pwa-install.js',
        '/css/pwa-install.css',
        '/manifest.json',
        '/assets/icons/icon-192.png',
        '/index.html',
        '/app.html',
      ]) {
        const res = await fetch(base + p);
        assert(res.status === 200, `local HTTP 200 ${p}`);
      }
      const html = await (await fetch(base + '/index.html')).text();
      assert(html.includes('pwa-install-v2'), 'index served with pwa-install-v2');
    } catch (err) {
      fail('local HTTP smoke', err.message);
    } finally {
      server.close();
      resolve();
    }
  });
});

console.log(failed ? `\nTOTAL FAIL ${failed}` : '\nTOTAL FAIL 0');
process.exit(failed ? 1 : 0);
