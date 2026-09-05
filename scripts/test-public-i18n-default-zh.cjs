#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '../js/public-i18n.js'), 'utf8');

function loadI18n({ search = '', storage = {}, pathname = '/', page = 'home' } = {}) {
  const store = { ...storage };
  const localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
  };
  const documentElement = {
    lang: 'en',
    dir: 'ltr',
    classList: { toggle() {} },
  };
  const emptyList = [];
  const document = {
    body: {
      dataset: { page },
      querySelector() { return null; },
      querySelectorAll() { return emptyList; },
    },
    documentElement,
    querySelector() { return null; },
    querySelectorAll() { return emptyList; },
    addEventListener() {},
  };
  class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    }
  }
  const windowObj = {
    location: { pathname, search, href: `https://asia-power.com${pathname}${search}` },
    localStorage,
    addEventListener() {},
    dispatchEvent() {},
    CustomEvent,
    document,
  };
  windowObj.window = windowObj;
  const ctx = {
    window: windowObj,
    document,
    localStorage,
    URLSearchParams,
    CustomEvent,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { i18n: ctx.window.PublicI18n, store, documentElement };
}

const fresh = loadI18n();
assert.strictEqual(fresh.i18n.DEFAULT_LANG, 'zh', 'default language must be Simplified Chinese');
assert.strictEqual(fresh.i18n.getLang(), 'zh', 'first visit with empty storage uses zh');
assert.strictEqual(fresh.i18n.t('nav.home', 'Home'), '首页');
assert.strictEqual(fresh.documentElement.lang, 'zh-CN');

const storedEn = loadI18n({ storage: { 'asiapower.lang': 'en' } });
assert.strictEqual(storedEn.i18n.getLang(), 'en', 'saved EN preference still works');
assert.strictEqual(storedEn.i18n.t('nav.home', 'Home'), 'Home');

const urlZh = loadI18n({ search: '?lang=zh-CN', storage: { 'asiapower.lang': 'en' } });
assert.strictEqual(urlZh.i18n.getLang(), 'zh', '?lang=zh-CN overrides stored EN');
assert.strictEqual(urlZh.store['asiapower.lang'], 'zh', '?lang= persists into localStorage');

const urlEn = loadI18n({ search: '?lang=en' });
assert.strictEqual(urlEn.i18n.getLang(), 'en');

const adminPage = loadI18n({ pathname: '/admin/leads.html', page: 'admin-leads' });
assert.strictEqual(adminPage.i18n.getLang(), 'zh', 'admin chrome follows Chinese default');

console.log('ok: default Simplified Chinese + EN switcher + ?lang= override');
