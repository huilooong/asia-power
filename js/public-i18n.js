/**
 * AsiaPower — Public website language (EN default, optional ZH).
 * Does not apply to supplier portal or admin review.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'asiapower.lang';
  const DEFAULT_LANG = 'en';

  const STRINGS = {
    'nav.home': { zh: '首页' },
    'nav.brands': { zh: '品牌' },
    'nav.supplier': { zh: '供应商门户' },
    'nav.contact': { zh: '联系我们' },
    'nav.requestQuote': { zh: '获取报价' },
    'nav.openMenu': { zh: '打开菜单' },
    'nav.closeMenu': { zh: '关闭菜单' },
    'skipLink': { zh: '跳转到主要内容' },
    'topbar.badge': { zh: '全球动力总成采购' },
    'topbar.tagline': { zh: '中国供应网络 → 全球买家' },
    'footer.ctaTitle': { zh: '需要全球发运的动力总成配件？' },
    'footer.ctaLead': { zh: '发送车辆详情 — 我们将在 24 小时内回复 FOB/CIF 报价。' },
    'footer.whatsapp': { zh: 'WhatsApp 联系' },
    'footer.nav': { zh: '导航' },
    'footer.startHere': { zh: '快速入口' },
    'footer.brandDirectory': { zh: '品牌目录' },
    'footer.supplierPortal': { zh: '供应商门户' },
    'footer.requestQuote': { zh: '获取报价' },
    'footer.offices': { zh: '办公地址' },
    'footer.about': {
      zh: 'AsiaPower 是全球动力总成采购平台 — 为进口商、维修厂和车队运营商对接中国验证供应网络，覆盖日系、韩系及中国品牌应用。',
    },
    'footer.popularEngines': { zh: '热门发动机型号' },
    'footer.popularBrands': { zh: '热门品牌' },
    'footer.productCatalog': { zh: '产品目录' },
    'footer.rights': { zh: '版权所有。' },
    'footer.supplierReg': { zh: '供应商注册' },
    'whatsapp.label': { zh: 'WhatsApp 咨询' },
    'catalog.home': { zh: '首页' },
    'catalog.brands': { zh: '品牌' },
    'catalog.engines': { zh: '发动机' },
    'catalog.gearboxes': { zh: '变速箱' },
    'catalog.halfCuts': { zh: '半车' },
    'catalog.chassis': { zh: '底盘件' },
    'catalog.browseByBrand': { zh: '按品牌浏览' },
    'catalog.viewBrands': { zh: '查看品牌' },
    'home.eyebrow': { zh: '全球动力总成采购平台' },
    'home.title': { zh: '中国动力总成采购<br><em>服务全球买家</em>' },
    'home.lead': {
      zh: 'AsiaPower 为全球进口商、维修厂和车队运营商对接中国验证供应网络 — 提供发动机、变速箱、底盘件及半车，覆盖日系、韩系及中国品牌应用。',
    },
    'home.capabilityTitle': { zh: '规模化全球采购' },
    'home.enginesAvail': { zh: '可用发动机' },
    'home.gearboxesAvail': { zh: '可用变速箱' },
    'home.halfCutsAvail': { zh: '可用半车' },
    'home.exportNetwork': { zh: '全球出口网络' },
    'home.marketsLabel': { zh: '目标市场' },
    'home.whatsappQuote': { zh: 'WhatsApp 获取报价' },
    'home.browseBrands': { zh: '浏览品牌' },
    'brands.label': { zh: '主要入口' },
    'brands.title': { zh: '品牌目录' },
    'brands.lead': {
      zh: '选择车辆品牌，查看发动机、变速箱、底盘件及半车。AsiaPower 通过中国验证供应网络采购日系、韩系、中美欧多品牌应用。',
    },
    'brands.vehicleBrands': { zh: '车辆品牌' },
    'brands.productLines': { zh: '产品线' },
    'brands.globalExport': { zh: '全球出口' },
    'engines.title': { zh: '发动机型号目录' },
    'engines.lead': { zh: '按品牌分组的公开发动机型号目录。支持全球出口 — 可索取 FOB/CIF 报价。' },
    'engines.countLabel': { zh: '个发动机型号' },
    'engines.allBrands': { zh: '全部品牌' },
    'engines.petrol': { zh: '汽油' },
    'engines.diesel': { zh: '柴油' },
    'engines.hybrid': { zh: '混动' },
    'gearboxes.title': { zh: '变速箱目录' },
    'gearboxes.lead': { zh: '自动、手动、CVT 及四驱变速箱，支持全球出口。按品牌浏览或索取 FOB/CIF 报价。' },
    'gearboxes.catalogLabel': { zh: '公开变速箱目录' },
    'gearboxes.all': { zh: '全部' },
    'gearboxes.automatic': { zh: '自动' },
    'gearboxes.manual': { zh: '手动' },
    'gearboxes.4wd': { zh: '四驱' },
    'chassis.title': { zh: '底盘件目录' },
    'chassis.lead': { zh: '悬架、转向、制动、车桥及差速器 — 按品牌采购，支持全球出口。' },
    'chassis.catalogLabel': { zh: '公开底盘件目录' },
    'chassis.suspension': { zh: '悬架' },
    'chassis.steering': { zh: '转向' },
    'chassis.brakes': { zh: '制动' },
    'chassis.browseLead': { zh: '查看该品牌全部底盘件分类。' },
    'halfcuts.title': { zh: '半车目录' },
    'halfcuts.lead': {
      zh: '按品牌、车型、发动机代号、变速箱代号或库存编号搜索半车。可索取价格、照片及出口运输方案。',
    },
    'halfcuts.browseLead': { zh: '查看该品牌全部半车选项。' },
    'hc.searchPlaceholder': { zh: '搜索库存编号、品牌、车型、发动机或变速箱…' },
    'hc.brand': { zh: '品牌' },
    'hc.allBrands': { zh: '全部品牌' },
    'hc.all': { zh: '全部' },
    'hc.available': { zh: '现货' },
    'hc.reserved': { zh: '预留' },
    'hc.inTransit': { zh: '在途' },
    'hc.sold': { zh: '已售' },
    'hc.showing': { zh: '显示' },
    'hc.of': { zh: '共' },
    'hc.halfCuts': { zh: '台半车' },
    'hc.photosOnRequest': { zh: '照片备索' },
    'hc.noMatch': { zh: '没有匹配的半车。' },
    'hc.sendRequest': { zh: '发送您的需求' },
    'spec.brand': { zh: '品牌' },
    'spec.model': { zh: '车型' },
    'spec.year': { zh: '年份' },
    'spec.engine': { zh: '发动机' },
    'spec.transmission': { zh: '变速箱' },
    'spec.mileage': { zh: '里程' },
    'spec.vin': { zh: 'VIN' },
  };

  const NAV_ID_KEYS = {
    home: 'nav.home',
    brands: 'nav.brands',
    supplier: 'nav.supplier',
    contact: 'nav.contact',
  };

  function getPageId() {
    const page = document.body?.dataset?.page || '';
    if (page) {
      if (page.startsWith('brand-')) return 'brands';
      if (page.startsWith('engine-')) return 'engines';
      return page;
    }
    const file = window.location.pathname.split('/').pop() || 'index.html';
    const map = {
      'index.html': 'home',
      'brands.html': 'brands',
    };
    return map[file] || '';
  }

  function isInternalPage() {
    const page = document.body?.dataset?.page || '';
    if (page === 'supplier-upload' || page === 'admin-review' || page === 'supplier') return true;
    const path = window.location.pathname;
    return path.includes('/admin/') || path.includes('/supplier-portal/half-cut-upload');
  }

  function isSwitchablePublicPage() {
    if (isInternalPage()) return false;
    const page = document.body?.dataset?.page || '';
    const path = window.location.pathname;
    if (page === 'home') return true;
    if (page === 'brands' || page.startsWith('brand-')) return true;
    if (page === 'engines' || page === 'engine-detail') return true;
    if (page === 'gearboxes') return true;
    if (page === 'chassis') return true;
    if (page === 'halfcuts' || page === 'halfcut-detail') return true;
    if (path.endsWith('/brands.html') || /\/brands\/[^/]+\.html/.test(path)) return true;
    if (/\/engines(\/|$)/.test(path)) return true;
    if (/\/gearboxes(\/|$)/.test(path)) return true;
    if (/\/chassis-parts(\/|$)/.test(path)) return true;
    if (/\/half-cuts(\/|$)/.test(path)) return true;
    if (path === '/' || path.endsWith('/index.html')) {
      return !path.includes('/engines/') && !path.includes('/gearboxes/')
        && !path.includes('/half-cuts/') && !path.includes('/chassis-parts/');
    }
    return false;
  }

  function normalizeLang(value) {
    return value === 'zh' ? 'zh' : 'en';
  }

  function getLang() {
    if (!isSwitchablePublicPage()) return DEFAULT_LANG;
    try {
      return normalizeLang(localStorage.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_LANG;
    }
  }

  function setLang(lang) {
    const next = normalizeLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    window.dispatchEvent(new CustomEvent('asiapower:langchange', { detail: { lang: next } }));
  }

  function t(key, fallback) {
    if (getLang() !== 'zh') return fallback || key;
    return STRINGS[key]?.zh || fallback || key;
  }

  function translateNavLabel(item) {
    const key = NAV_ID_KEYS[item.id];
    return key ? t(key, item.label) : item.label;
  }

  function applyDataI18n(root) {
    if (getLang() !== 'zh') {
      (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
        if (el.dataset.i18nEn != null) {
          if (el.dataset.i18nHtml === 'true') el.innerHTML = el.dataset.i18nEn;
          else el.textContent = el.dataset.i18nEn;
        }
      });
      (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        if (el.dataset.i18nPlaceholderEn != null) el.placeholder = el.dataset.i18nPlaceholderEn;
      });
      return;
    }

    (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (el.dataset.i18nEn == null) {
        el.dataset.i18nEn = el.dataset.i18nHtml === 'true' ? el.innerHTML : el.textContent;
      }
      const text = STRINGS[key]?.zh;
      if (!text) return;
      if (el.dataset.i18nHtml === 'true') el.innerHTML = text.replace(/\n/g, '<br>');
      else el.textContent = text;
    });

    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (el.dataset.i18nPlaceholderEn == null) el.dataset.i18nPlaceholderEn = el.placeholder;
      const text = STRINGS[key]?.zh;
      if (text) el.placeholder = text;
    });
  }

  function renderLangSwitcher() {
    if (!isSwitchablePublicPage()) return '';
    const lang = getLang();
    return `
      <div class="lang-switcher" role="group" aria-label="Language">
        <button type="button" class="lang-switcher__btn${lang === 'en' ? ' is-active' : ''}" data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
        <button type="button" class="lang-switcher__btn${lang === 'zh' ? ' is-active' : ''}" data-lang="zh" aria-pressed="${lang === 'zh'}">中文</button>
      </div>`;
  }

  function bindLangSwitcher(root) {
    if (!isSwitchablePublicPage()) return;
    (root || document).querySelectorAll('.lang-switcher__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        if (next && next !== getLang()) setLang(next);
      });
    });
  }

  function initDocumentLang() {
    if (isSwitchablePublicPage()) {
      document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
    }
  }

  initDocumentLang();

  window.PublicI18n = {
    getLang,
    setLang,
    t,
    translateNavLabel,
    applyDataI18n,
    renderLangSwitcher,
    bindLangSwitcher,
    showSwitcher: isSwitchablePublicPage,
    isSwitchablePublicPage,
    isInternalPage,
  };
})();
