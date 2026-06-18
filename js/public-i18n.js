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
    'home.title': { zh: '中国动力总成供应<br><em>连接全球买家</em>' },
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
    'hc.inventoryDisclaimer': { zh: '库存以最终确认为准。照片、价格及运费均在询价后确认。' },
    'hc.viewDetails': { zh: '查看详情' },
    'hc.requestPrice': { zh: '索取价格' },
    'hc.requestPhotos': { zh: '索取照片' },
    'hc.checkAvailability': { zh: '确认现货' },
    'hc.requestSimilar': { zh: '索取类似车源' },
    'hc.photos': { zh: '照片' },
    'hc.video': { zh: '视频' },
    'home.whyEyebrow': { zh: '为什么选择 AsiaPower' },
    'home.whyTitle': { zh: '为专业全球贸易而生' },
    'home.pillar1Title': { zh: '可信赖' },
    'home.pillar1Desc': { zh: '每台配件均附检验报告、压缩测试及出口单证。透明采购，验证供应商。' },
    'home.pillar2Title': { zh: '规模' },
    'home.pillar2Desc': { zh: '已向五大区域出口 6,000+ 台套。支持单台 LCL 与整柜批量采购。' },
    'home.pillar3Title': { zh: '供应网络' },
    'home.pillar3Desc': { zh: '200+ 验证供应商覆盖日本、韩国及中国 — 经郑州出口渠道整合。' },
    'home.pillar4Title': { zh: '全球出口' },
    'home.pillar4Desc': { zh: 'FOB/CIF 发运至非洲、中东、南美、加勒比及中亚。专业出口包装与物流。' },
    'home.pillar5Title': { zh: '专业采购' },
    'home.pillar5Desc': { zh: '24 小时内 B2B 报价。批量价格、客户管理及稳定复购供应。' },
    'home.modelEyebrow': { zh: '商业模式' },
    'home.modelTitle': { zh: 'AsiaPower 如何运作' },
    'home.modelLead': { zh: '中国采购平台 — 非零售门店。我们整合供应、检验品质并出口至全球买家。' },
    'home.model1Title': { zh: '中国供应网络' },
    'home.model1Desc': { zh: '验证拆解场与出口商，经郑州及沿海枢纽整合。' },
    'home.model2Title': { zh: '车辆应用' },
    'home.model2Desc': { zh: '日系、韩系及中国品牌 — 支持 Toyota、Hyundai、BYD、Honda、Nissan 等 30+ 品牌。' },
    'home.model3Title': { zh: '全球买家' },
    'home.model3Desc': { zh: '非洲、中东、美洲及中亚的进口商、维修厂、车队及经销商。' },
    'home.supplyEyebrow': { zh: '供应范围' },
    'home.supplyTitle': { zh: '四大产品线 · 一个采购平台' },
    'home.supplyLead': { zh: 'AsiaPower 不是电商目录。按品牌浏览各车系发动机、变速箱、底盘件及半车 — 或联系我们定制采购。' },
    'home.catEngines': { zh: '发动机' },
    'home.catEnginesDesc': { zh: '汽油、柴油及混动。压缩测试，附出口单证。' },
    'home.catGearboxes': { zh: '变速箱' },
    'home.catGearboxesDesc': { zh: '自动、手动、CVT 及四驱。换挡测试，出口包装。' },
    'home.catChassis': { zh: '底盘件' },
    'home.catChassisDesc': { zh: '悬架、转向、制动、车桥及差速器，按应用采购。' },
    'home.catHalfCuts': { zh: '半车' },
    'home.catHalfCutsDesc': { zh: '前切、后切、鼻切及完整半车，用于翻新与拆解项目。' },
    'home.viewCategory': { zh: '查看目录 →' },
    'home.brandsEyebrow': { zh: '从这里开始' },
    'home.brandsTitle': { zh: '支持品牌' },
    'home.brandsLead': { zh: '品牌是主要入口。选择车辆品牌，查看该品牌的发动机、变速箱、底盘件及半车。' },
    'home.viewAllBrands': { zh: '查看全部 50+ 品牌' },
    'home.processEyebrow': { zh: '采购流程' },
    'home.processTitle': { zh: '从询价到全球交付' },
    'home.process1Title': { zh: '选择品牌与产品' },
    'home.process1Desc': { zh: '浏览品牌目录，或发送车辆品牌、车型、年份及发动机代号。' },
    'home.process2Title': { zh: '获取报价' },
    'home.process2Desc': { zh: '24 小时内 FOB/CIF 报价，含检验照片及兼容性确认。' },
    'home.process3Title': { zh: '检验与确认' },
    'home.process3Desc': { zh: '从供应网络调货，完整检验并附照片及视频记录。' },
    'home.process4Title': { zh: '出口发运' },
    'home.process4Desc': { zh: '专业包装及完整出口单证。整柜或 LCL 至目的港。' },
    'home.reachEyebrow': { zh: '全球覆盖' },
    'home.reachTitle': { zh: '服务全球买家' },
    'home.reachLead': { zh: 'AsiaPower 从中国向五大区域出口。郑州（中国）及阿克拉（加纳）办公室支持全球沟通。' },
    'home.regionAfrica': { zh: '非洲' },
    'home.regionMiddleEast': { zh: '中东' },
    'home.regionSouthAmerica': { zh: '南美' },
    'home.regionCaribbean': { zh: '加勒比' },
    'home.regionCentralAsia': { zh: '中亚' },
    'home.faqEyebrow': { zh: '常见问题' },
    'home.faqTitle': { zh: '常见问题' },
    'home.faq1Q': { zh: 'AsiaPower 是什么？' },
    'home.faq1A': { zh: 'AsiaPower 是全球动力总成采购平台 — 非零售汽配店。我们为 B2B 买家对接中国供应网络，覆盖日系、韩系及中国品牌，并提供检验、出口单证及国际运输。' },
    'home.faq2Q': { zh: '如何找到我车辆品牌的配件？' },
    'home.faq2A': { zh: '从品牌页开始。选择车辆品牌（例如 Toyota），浏览该品牌的发动机、变速箱、底盘件及半车。发送报价请求并附上发动机代号或 VIN 以便精准采购。' },
    'home.faq3Q': { zh: '是否支持国际运输？' },
    'home.faq3A': { zh: '支持。我们提供 FOB/CIF 发运至全球港口，包括非洲、中东、南美、加勒比及中亚。所有订单规模均支持整柜及 LCL。' },
    'home.ctaTitle': { zh: '准备采购动力总成配件？' },
    'home.ctaLead': { zh: '发送您的需求 — 24 小时内提供有竞争力的 FOB/CIF 报价。' },
    'home.contactTeam': { zh: '联系采购团队' },
    'home.enginesAvail': { zh: '发动机库存' },
    'home.gearboxesAvail': { zh: '变速箱库存' },
    'home.halfCutsAvail': { zh: '半车资源' },
    'brands.searchPlaceholder': { zh: '搜索品牌或发动机型号（如 G4KD、2TR、K24A）…' },
    'brands.showing': { zh: '显示' },
    'brands.of': { zh: '共' },
    'brands.brandsWord': { zh: '个品牌' },
    'brands.featuredEyebrow': { zh: '重点渠道' },
    'brands.featuredTitle': { zh: '重点品牌' },
    'brands.featuredLead': { zh: '高出货量采购渠道，专属供应商对接、更快报价及出口方案。' },
    'brands.allEyebrow': { zh: '全面覆盖' },
    'brands.allTitle': { zh: '全部支持品牌' },
    'brands.allLead': { zh: '全球动力总成采购完整品牌索引 — 选择任意品牌索取发动机、变速箱、底盘件或半车。' },
    'catalog.browseLeadEngines': { zh: '从品牌目录开始，浏览发动机、变速箱、底盘件及半车。' },
    'catalog.browseLeadGearboxes': { zh: '从品牌目录开始，按车辆品牌查看变速箱列表。' },
    'contact.title': { zh: '联系我们' },
    'contact.lead': { zh: '发送发动机或变速箱询价。所有 B2B 请求 24 小时内回复 FOB/CIF 报价。' },
    'contact.eyebrow': { zh: '取得联系' },
    'contact.sectionTitle': { zh: '我们随时为您服务' },
    'contact.sectionLead': { zh: '通过 WhatsApp、邮件或询价表联系我们。中国办公室负责采购与出口；加纳办公室服务西非客户。' },
    'contact.whatsapp': { zh: 'WhatsApp' },
    'contact.whatsappNote': { zh: '最快回复 — 周一至周六' },
    'contact.email': { zh: '邮箱' },
    'contact.emailNote': { zh: '报价、合作及一般咨询' },
    'contact.chinaOffice': { zh: '🇨🇳 中国办公室' },
    'contact.ghanaOffice': { zh: '🇬🇭 加纳办公室' },
    'contact.formTitle': { zh: '发送 WhatsApp 询价' },
    'contact.formLead': { zh: '填写车辆详情，然后在 WhatsApp 继续沟通以获取最快报价。' },
    'contact.faqEyebrow': { zh: '常见问题' },
    'contact.faqTitle': { zh: '联系前须知' },
    'brand.navOverview': { zh: '概览' },
    'brand.navCategories': { zh: '分类' },
    'brand.navEngines': { zh: '发动机' },
    'brand.navHalfCuts': { zh: '半车' },
    'brand.navQuote': { zh: '获取报价' },
    'brand.allBrands': { zh: '全部品牌' },
    'brand.whatsappInquiry': { zh: 'WhatsApp 咨询' },
    'brand.requestQuote': { zh: '获取报价' },
    'brand.browseCatalog': { zh: '查看目录 →' },
    'brand.overviewEyebrow': { zh: '品牌概览' },
    'brand.powertrainSourcing': { zh: '动力总成采购' },
    'brand.point1': { zh: '发动机、变速箱、底盘件及半车' },
    'brand.point2': { zh: 'FOB/CIF 出口至全球目的地' },
    'brand.point3': { zh: '可按需提供检验单证' },
    'brand.point4': { zh: '现货取决于供应网络及当前库存' },
    'brand.engineModelsListed': { zh: '已列发动机型号' },
    'brand.productCategories': { zh: '产品分类' },
    'brand.vehicleOrigin': { zh: '车辆来源' },
    'brand.categoriesEyebrow': { zh: '产品线' },
    'brand.categoriesTitle': { zh: '可用产品分类' },
    'brand.categoriesLead': { zh: '四大采购分类 — 选择产品线索取 FOB/CIF 报价。' },
    'brand.categoriesLeadStart': { zh: '四大采购分类：' },
    'brand.categoriesLeadEnd': { zh: '选择产品线索取 FOB/CIF 报价。' },
    'brand.enginesTitle': { zh: '发动机' },
    'brand.gearboxesTitle': { zh: '变速箱' },
    'brand.chassisTitle': { zh: '底盘件' },
    'brand.halfCutsTitle': { zh: '半车' },
    'brand.availableOnRequest': { zh: '可按需供应' },
    'brand.availabilityNote': { zh: '现货取决于供应网络及当前库存。' },
    'brand.engineCatalogEyebrow': { zh: '发动机目录' },
    'brand.popularEnginesTitle': { zh: '热门发动机型号' },
    'brand.popularEnginesLead': { zh: '全球出口常询发动机代号。所有型号均可按需供应 — 发送代号获取 FOB/CIF 报价。' },
    'brand.halfCutEyebrow': { zh: '半车库存' },
    'brand.halfCutListings': { zh: '半车列表' },
    'brand.halfCutLead': { zh: '半车出口参考列表 — 报价前需确认现货。' },
    'brand.halfCutEmpty': { zh: '暂无半车列表。请发送您的需求。' },
    'brand.requestHalfCut': { zh: '索取半车' },
    'brand.viewAllHalfCuts': { zh: '查看全部半车库存 →' },
    'brand.quoteEyebrow': { zh: '立即开始' },
    'brand.quoteTitle': { zh: '索取采购报价' },
    'brand.quoteLead': { zh: '发送发动机代号、VIN、车型或整柜需求。采购团队 24 小时内回复 FOB/CIF 报价。' },
    'brand.globalSourcing': { zh: '全球动力总成采购' },
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
    if (page === 'contact') return true;
    if (path.endsWith('/brands.html') || /\/brands\/[^/]+\.html/.test(path)) return true;
    if (path.endsWith('/contact.html')) return true;
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

  function translateStatus(status) {
    const map = {
      Available: 'hc.available',
      Reserved: 'hc.reserved',
      'In Transit': 'hc.inTransit',
      Sold: 'hc.sold',
    };
    const key = map[status];
    return key ? t(key, status) : status;
  }

  function inventoryDisclaimer() {
    return t('hc.inventoryDisclaimer', 'Inventory is subject to final confirmation. Photos, price and shipping cost are confirmed on request before export.');
  }

  initDocumentLang();

  window.PublicI18n = {
    getLang,
    setLang,
    t,
    translateNavLabel,
    translateStatus,
    inventoryDisclaimer,
    applyDataI18n,
    renderLangSwitcher,
    bindLangSwitcher,
    showSwitcher: isSwitchablePublicPage,
    isSwitchablePublicPage,
    isInternalPage,
  };
})();
