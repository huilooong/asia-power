/**
 * AsiaPower — Construction machinery brand & equipment type catalog
 */
(function () {
  'use strict';

  const TYPE_LABELS = {
    'wheel-loader': 'Wheel Loader',
    excavator: 'Excavator',
    bulldozer: 'Bulldozer',
    forklift: 'Forklift',
    roller: 'Roller / Compactor',
    'motor-grader': 'Motor Grader',
    crane: 'Mobile Crane',
    'backhoe-loader': 'Backhoe Loader',
    tractor: 'Tractor',
    other: 'Construction Equipment',
  };

  const GROUP_LABELS = {
    china: 'Chinese brands · 中国品牌',
    japan: 'Japanese · 日系',
    korea: 'Korean · 韩系',
    western: 'Western · 欧美',
    other: 'Other brands · 其他',
  };

  /** @type {Record<string, string[]>} */
  const COMMON_MODELS = {
    Lonking: ['LG855N', 'LG956N', 'LG953N', 'CDM856', 'CDM936N'],
    SDLG: ['L956F', 'L968F', 'E6210F', 'E680F', 'LG936L'],
    'LiuGong': ['856H', '890H', '920E', '936E', 'CLG856H'],
    XCMG: ['LW500KN', 'LW600KN', 'XE215C', 'XE370CA', 'XS143J'],
    Sany: ['SYL956H5', 'SY215C', 'SY375H', 'SSR120C'],
    Shantui: ['SL50W', 'SL60W-2', 'SD16', 'SD22'],
    Komatsu: ['WA380', 'WA470', 'PC200', 'PC300', 'D65'],
    Caterpillar: ['950 GC', '966M', '320', '336', 'D6'],
    'Volvo CE': ['L120H', 'L150H', 'EC210', 'EC300'],
    Hitachi: ['ZW220', 'ZX200', 'ZX350'],
    Doosan: ['DL300', 'DX225', 'DX300'],
    JCB: ['457', '3CX', '4CX'],
    Case: ['621G', 'CX210', 'CX350'],
    Bobcat: ['L95', 'T770', 'E35'],
    Kubota: ['R530', 'U55', 'KX057'],
  };

  const BRANDS = [
    { name: 'Lonking', group: 'china' },
    { name: 'SDLG', group: 'china' },
    { name: 'LiuGong', group: 'china' },
    { name: 'XCMG', group: 'china' },
    { name: 'Sany', group: 'china' },
    { name: 'Shantui', group: 'china' },
    { name: 'Foton Lovol', group: 'china' },
    { name: 'Dongfanghong', group: 'china' },
    { name: 'SEM', group: 'china' },
    { name: 'Komatsu', group: 'japan' },
    { name: 'Hitachi', group: 'japan' },
    { name: 'Kobelco', group: 'japan' },
    { name: 'Kubota', group: 'japan' },
    { name: 'Hyundai CE', group: 'korea' },
    { name: 'Doosan', group: 'korea' },
    { name: 'Caterpillar', group: 'western' },
    { name: 'Volvo CE', group: 'western' },
    { name: 'JCB', group: 'western' },
    { name: 'Case', group: 'western' },
    { name: 'Bobcat', group: 'western' },
    { name: 'Liebherr', group: 'western' },
  ];

  const ALIASES = {
    龙工: 'Lonking',
    lonking: 'Lonking',
    临工: 'SDLG',
    柳工: 'LiuGong',
    徐工: 'XCMG',
    三一: 'Sany',
    山推: 'Shantui',
    东方红: 'Dongfanghong',
    dongfanghong: 'Dongfanghong',
    YTO: 'Dongfanghong',
    yto: 'Dongfanghong',
    卡特: 'Caterpillar',
    小松: 'Komatsu',
    日立: 'Hitachi',
  };

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function resolveBrand(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (ALIASES[text]) return ALIASES[text];
    const lower = text.toLowerCase();
    if (ALIASES[lower]) return ALIASES[lower];
    const hit = BRANDS.find((b) => b.name.toLowerCase() === lower);
    return hit ? hit.name : text;
  }

  function brandToSlug(brand) {
    return slugify(resolveBrand(brand));
  }

  function getBrands() {
    return BRANDS.map((b) => ({ name: b.name, slug: brandToSlug(b.name), group: b.group }));
  }

  function getBrandOptionGroups() {
    const groups = { china: [], japan: [], korea: [], western: [], other: [] };
    BRANDS.forEach((b) => {
      const key = groups[b.group] ? b.group : 'other';
      groups[key].push(b.name);
    });
    return groups;
  }

  function getModels(brand) {
    const name = resolveBrand(brand);
    return COMMON_MODELS[name] ? COMMON_MODELS[name].slice() : [];
  }

  function typeLabel(type) {
    return TYPE_LABELS[type] || TYPE_LABELS.other;
  }

  function allTypes() {
    return Object.entries(TYPE_LABELS).map(([id, label]) => ({ id, label }));
  }

  window.MachineryBrandCatalog = {
    TYPE_LABELS,
    GROUP_LABELS,
    COMMON_MODELS,
    getBrands,
    getBrandOptionGroups,
    getModels,
    resolveBrand,
    brandToSlug,
    typeLabel,
    allTypes,
  };
})();
