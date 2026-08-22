/**
 * AsiaPower official make-name presentation policy (V1).
 *
 * Make is an identity field, never free-form copy:
 * - English, French and Arabic retain the official Latin trademark in uppercase.
 * - Chinese uses the reviewed official/common manufacturer name below.
 * - Unknown makes retain their source spelling and are uppercased; they are never
 *   machine-translated, transliterated or semantically guessed.
 * - Source inventory objects, URLs, form values, metadata and JSON-LD are untouched.
 *
 * FANGCHENGBAO source authority:
 * - Chinese: https://www.fangchengbao.com/brand-center.html (方程豹)
 * - English: BYD official releases / reports use FANGCHENGBAO.
 */
(function () {
  'use strict';

  const LANGS = ['en', 'zh', 'fr', 'ar'];

  /**
   * [official Latin trademark, reviewed Chinese display name, additional aliases]
   * French and Arabic deliberately keep the official Latin trademark. Brand
   * identity must not be run through general-purpose translation.
   */
  const OFFICIAL_BRAND_ROWS = [
    ['ACURA', '讴歌'],
    ['ALFA ROMEO', '阿尔法·罗密欧'],
    ['AION', '广汽埃安'],
    ['ASTON MARTIN', '阿斯顿·马丁'],
    ['AUDI', '奥迪'],
    ['BAIC', '北京汽车'],
    ['BAOJUN', '宝骏'],
    ['BEIBEN', '北奔重汽'],
    ['BENTLEY', '宾利'],
    ['BMW', '宝马'],
    ['BUICK', '别克'],
    ['BYD', '比亚迪'],
    ['CADILLAC', '凯迪拉克'],
    ['CAMC', '华菱汽车'],
    ['CHANGAN', '长安'],
    ['CHANGAN KUAYUE', '长安跨越'],
    ['CHERY', '奇瑞'],
    ['CHERY JAGUAR LAND ROVER', '奇瑞捷豹路虎'],
    ['CHEVROLET', '雪佛兰'],
    ['CHRYSLER', '克莱斯勒'],
    ['CITROËN', '雪铁龙', ['Citroen']],
    ['DAEWOO', '大宇'],
    ['DAIHATSU', '大发'],
    ['DENZA', '腾势', ['腾势']],
    ['DODGE', '道奇'],
    ['DONGFANGHONG', '东方红'],
    ['DONGFENG', '东风'],
    ['EXEED', '星途'],
    ['FANGCHENGBAO', '方程豹', ['Fang Cheng Bao', '方程豹']],
    ['FAW', '一汽'],
    ['FIAT', '菲亚特'],
    ['FORD', '福特'],
    ['FOTON', '福田'],
    ['GAC', '广汽'],
    ['GEELY', '吉利'],
    ['GENERAL MOTORS', '通用汽车'],
    ['GENESIS', '捷尼赛思'],
    ['GEOMETRY', '几何汽车'],
    ['GMC', 'GMC'],
    ['GOLDEN DRAGON', '金旅客车'],
    ['GREAT WALL', '长城'],
    ['GWM', '长城'],
    ['HAVAL', '哈弗'],
    ['HAWTAI', '华泰汽车'],
    ['HINO', '日野'],
    ['HONDA', '本田'],
    ['HONGQI', '红旗'],
    ['HONGYAN', '上汽红岩'],
    ['HOWO', '豪沃', ['Howo']],
    ['HYUNDAI', '现代'],
    ['HYUNDAI TRUCKS', '现代商用车'],
    ['INFINITI', '英菲尼迪'],
    ['ISUZU', '五十铃'],
    ['IVECO', '依维柯'],
    ['JAC', '江淮'],
    ['JAECOO', 'JAECOO'],
    ['JAGUAR', '捷豹'],
    ['JEEP', 'JEEP', ['Jeep']],
    ['JETOUR', '捷途'],
    ['JINBEI', '金杯'],
    ['JMC', '江铃'],
    ['KIA', '起亚'],
    ['KING LONG', '金龙客车'],
    ['LAND ROVER', '路虎'],
    ['LEAPMOTOR', '零跑汽车'],
    ['LEXUS', '雷克萨斯'],
    ['LI AUTO', '理想汽车'],
    ['LIEBAO', '猎豹汽车'],
    ['LINCOLN', '林肯'],
    ['LONKING', '龙工'],
    ['LOVOL', '雷沃'],
    ['LYNK & CO', '领克'],
    ['MAN', '曼恩'],
    ['MAXUS', '上汽大通MAXUS'],
    ['MAZDA', '马自达'],
    ['MERCEDES-BENZ', '梅赛德斯-奔驰', ['Mercedes Benz']],
    ['MG', '名爵'],
    ['MINI', 'MINI'],
    ['MITSUBISHI', '三菱'],
    ['NIO', '蔚来'],
    ['NISSAN', '日产'],
    ['OMODA', '欧萌达'],
    ['ORA', '欧拉'],
    ['PEUGEOT', '标致'],
    ['PORSCHE', '保时捷'],
    ['RAM', 'RAM'],
    ['RENAULT', '雷诺'],
    ['ROEWE', '荣威'],
    ['ROLLS-ROYCE', '劳斯莱斯'],
    ['SAIC', '上汽集团'],
    ['SANY', '三一'],
    ['SCANIA', '斯堪尼亚'],
    ['SEAT', '西雅特'],
    ['SHAANXI AUTO', '陕汽'],
    ['SHACMAN', '陕汽重卡'],
    ['SINOTRUK', '中国重汽'],
    ['SKODA', '斯柯达', ['Škoda']],
    ['SSANGYONG', '双龙汽车', ['SsangYong']],
    ['SUBARU', '斯巴鲁'],
    ['SUZUKI', '铃木'],
    ['TANK', '坦克'],
    ['TESLA', '特斯拉'],
    ['TOYOTA', '丰田'],
    ['VOLKSWAGEN', '大众'],
    ['VOLVO', '沃尔沃'],
    ['WULING', '五菱'],
    ['XPENG', '小鹏汽车', ['Xpeng']],
    ['YUTONG', '宇通客车'],
    ['ZEEKR', '极氪'],
  ];

  // Product-family tokens which must be uppercase but are not treated as makes.
  const UPPERCASE_ONLY = ['Range Rover'];
  const SKIP_SELECTOR = [
    'script', 'style', 'noscript', 'textarea', 'code', 'pre', 'template',
    '[contenteditable="true"]', '[data-brand-display="off"]'
  ].join(',');
  const BRAND_CONTEXT_SELECTOR = [
    '[data-brand]', '[data-brand-name]', '[data-brand-slug]', '[data-brand-halfcut-list]',
    '[itemprop="brand"]', 'a[href*="/brands/"]', 'a[href*="brand="]',
    '.pcard', '.showcase-card', '.ebay-card', '.ebay-listing-row', '.ebay-vehicle-card',
    '.engine-model', '.brand-card', '.brand-tile', '.brand-engine-card', '.hc-item-detail',
    '.product-card', '.inventory-card', '#filter-make', '#filter-brand',
    'select[name*="brand" i]', 'select[name*="make" i]', 'h1', 'h2', 'h3', 'h4'
  ].join(',');

  const registry = new Map();
  const aliasIndex = new Map();
  const searchableBrands = new Set();
  const nodeState = new WeakMap();
  let brandPattern = null;
  let observer = null;

  function normalizeAlias(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function titleCaseMark(mark) {
    return String(mark || '').toLocaleLowerCase('en-US').replace(/(^|[\s&-])([a-zà-öø-ÿ])/g,
      (_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('en-US')}`);
  }

  function makeEntry(mark, zh, extraAliases) {
    const official = String(mark || '').trim().toUpperCase();
    const entry = Object.freeze({
      en: official,
      zh: String(zh || official).trim(),
      fr: official,
      ar: official,
    });
    registry.set(official, entry);

    const aliases = new Set([official, titleCaseMark(official), ...(extraAliases || [])]);
    aliases.forEach((alias) => {
      const value = String(alias || '').trim();
      if (!value) return;
      aliasIndex.set(normalizeAlias(value), entry);
      // Chinese aliases are valid for direct field lookup, but are not scanned
      // across arbitrary prose (e.g. 现代 / 大众 have ordinary meanings).
      if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value)) searchableBrands.add(value);
    });
    return entry;
  }

  OFFICIAL_BRAND_ROWS.forEach(([mark, zh, aliases]) => makeEntry(mark, zh, aliases));
  UPPERCASE_ONLY.forEach((value) => searchableBrands.add(value));

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function rebuildPattern() {
    const alternatives = Array.from(searchableBrands)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    brandPattern = alternatives.length
      ? new RegExp(`(^|[^A-Za-z0-9])(${alternatives.join('|')})(?=$|[^A-Za-z0-9])`, 'gi')
      : null;
  }

  function getLang() {
    const fromI18n = window.PublicI18n?.getLang?.();
    if (LANGS.includes(fromI18n)) return fromI18n;
    try {
      const stored = window.localStorage?.getItem?.('asiapower.lang');
      if (LANGS.includes(stored)) return stored;
    } catch {
      // Storage can be unavailable in privacy mode.
    }
    const htmlLang = String(document.documentElement?.lang || '').toLowerCase();
    if (htmlLang.startsWith('zh')) return 'zh';
    if (htmlLang.startsWith('fr')) return 'fr';
    if (htmlLang.startsWith('ar')) return 'ar';
    return 'en';
  }

  function officialBrandName(value, lang) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const entry = aliasIndex.get(normalizeAlias(raw));
    if (!entry) return raw.toUpperCase();
    const target = LANGS.includes(lang) ? lang : 'en';
    return entry[target];
  }

  function registerBrand(value) {
    const brand = String(value || '').trim();
    if (!brand || brand.length > 64 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(brand)) return false;
    const before = searchableBrands.size;
    searchableBrands.add(brand);
    if (searchableBrands.size !== before) brandPattern = null;
    return searchableBrands.size !== before;
  }

  function registerBrandsFromPage(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('[data-brand]').forEach((element) => registerBrand(element.getAttribute('data-brand')));
    const lists = [window.HALF_CUT_LIST, window.HALF_CUTS, window.INVENTORY_ITEMS];
    lists.forEach((list) => {
      if (Array.isArray(list)) list.forEach((item) => registerBrand(item?.brand || item?.make));
    });
  }

  function localizeBrandTokens(value, lang) {
    const text = String(value ?? '');
    if (!text) return text;
    if (!brandPattern) rebuildPattern();
    return brandPattern
      ? text.replace(brandPattern, (_match, prefix, make) => `${prefix}${officialBrandName(make, lang || getLang())}`)
      : text;
  }

  function uppercaseBrandTokens(value) {
    return localizeBrandTokens(value, 'en');
  }

  function shouldSkipTextNode(node) {
    const parent = node?.parentElement;
    return !parent || Boolean(parent.closest(SKIP_SELECTOR));
  }

  function isBrandContext(node) {
    return Boolean(node?.parentElement?.closest?.(BRAND_CONTEXT_SELECTOR));
  }

  function processTextNode(node) {
    if (shouldSkipTextNode(node)) return false;
    const previous = nodeState.get(node);
    // If another renderer changed the text, accept that new value as source.
    // Otherwise reuse the pre-localization source so language switching is lossless.
    const source = previous && node.nodeValue === previous.rendered
      ? previous.source
      : node.nodeValue;
    const lang = getLang();
    // Chinese aliases are applied only where the DOM identifies a make/product
    // context. This prevents ordinary words such as "man", "seat" or "tank"
    // from being mistaken for automotive makes in editorial copy.
    const displayLang = lang === 'zh' && !isBrandContext(node) ? 'en' : lang;
    const next = localizeBrandTokens(source, displayLang);
    nodeState.set(node, { source, rendered: next });
    if (next === node.nodeValue) return false;
    node.nodeValue = next;
    return true;
  }

  function processRoot(root) {
    if (!root) return 0;
    registerBrandsFromPage(root.nodeType === 1 || root.nodeType === 9 ? root : root.parentElement);
    if (root.nodeType === 3) return processTextNode(root) ? 1 : 0;
    if (!root.ownerDocument && root.nodeType !== 9) return 0;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node = walker.nextNode();
    while (node) {
      if (processTextNode(node)) count += 1;
      node = walker.nextNode();
    }
    return count;
  }

  function isPublicPage() {
    const page = document.body?.dataset?.page || '';
    const path = window.location.pathname || '';
    return !page.startsWith('admin-')
      && page !== 'supplier-upload'
      && !path.includes('/admin/')
      && !path.includes('/supplier-portal/half-cut-upload')
      && !path.includes('/supplier-portal/truck-upload')
      && !path.includes('/supplier-portal/passenger-parts-upload');
  }

  function start() {
    if (!document.body || !isPublicPage()) return;
    processRoot(document.body);
    observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'characterData') processTextNode(record.target);
        record.addedNodes?.forEach((node) => processRoot(node));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('asiapower:langchange', () => processRoot(document.body));
  }

  window.AsiaPowerBrandDisplay = {
    OFFICIAL_BRAND_NAMES: Object.freeze(Object.fromEntries(registry)),
    officialBrandName,
    localizeBrandTokens,
    uppercaseBrandTokens,
    registerBrand,
    processRoot,
    stop() {
      observer?.disconnect();
      observer = null;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
