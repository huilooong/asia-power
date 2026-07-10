/**
 * AsiaPower — Engine Model Directory
 * Public catalog data grouped by brand. No inventory quantities.
 */
(function () {
  'use strict';

  /** Standard export availability labels for every catalog model */
  const EXPORT_STATUS = [
    'Available',
    'Ready for Export',
    'EXW Available',
    'CIF Available',
  ];

  function m(code, displacement, fuel, applications, type) {
    return { code, displacement, fuel, applications, type: type || fuel.toLowerCase() };
  }

  const ENGINE_DIRECTORY = {
    toyota: {
      name: 'Toyota',
      slug: 'toyota',
      origin: 'Japan',
      landingPage: 'brands/toyota.html',
      models: [
        m('1NZ-FE', '1.8L', 'Petrol', 'Corolla, Fielder, Axio, Yaris'),
        m('2NZ-FE', '1.3L', 'Petrol', 'Vitz, Platz, Belta'),
        m('1ZZ-FE', '1.8L', 'Petrol', 'Corolla, Wish, Allion'),
        m('3ZZ-FE', '1.6L', 'Petrol', 'Corolla, RunX, Allex'),
        m('2AZ-FE', '2.4L', 'Petrol', 'Camry, RAV4, Alphard'),
        m('2ZR-FE', '1.8L', 'Petrol', 'Corolla, Auris, Prius (non-hybrid)'),
        m('3ZR-FE', '2.0L', 'Petrol', 'RAV4, Noah, Voxy'),
        m('2TR-FE', '2.7L', 'Petrol', 'Hilux, Fortuner, Land Cruiser Prado'),
        m('1KD-FTV', '3.0L', 'Diesel', 'Hilux, Fortuner, Land Cruiser Prado', 'diesel'),
        m('2KD-FTV', '2.5L', 'Diesel', 'Hilux, Innova, Fortuner', 'diesel'),
        m('1GR-FE', '4.0L', 'Petrol', 'Land Cruiser, Prado, FJ Cruiser'),
        m('2GR-FE', '3.5L', 'Petrol', 'Camry, Highlander, Alphard, Lexus RX'),
        m('1JZ-GE', '2.5L', 'Petrol', 'Crown, Mark II, Chaser'),
        m('1JZ-GTE', '2.5L', 'Petrol', 'Supra, Chaser, Mark II turbo'),
        m('2JZ-GE', '3.0L', 'Petrol', 'Crown, Aristo, Soarer'),
        m('1HZ', '4.2L', 'Diesel', 'Land Cruiser 80/100 series', 'diesel'),
        m('1HD-FTE', '4.2L', 'Diesel', 'Land Cruiser 100 series turbo', 'diesel'),
      ],
    },
    hyundai: {
      name: 'Hyundai',
      slug: 'hyundai',
      origin: 'Korea',
      landingPage: 'brands/hyundai.html',
      models: [
        m('G4FC', '1.6L', 'Petrol', 'Elantra, i30, Accent'),
        m('G4FG', '1.6L', 'Petrol', 'Elantra, i30, Creta'),
        m('G4NA', '2.0L', 'Petrol', 'Tucson, Sonata, ix35'),
        m('G4KD', '2.0L', 'Petrol', 'Optima, Sportage, Sorento'),
        m('G4KE', '2.4L', 'Petrol', 'Sonata, Tucson, Santa Fe'),
        m('D4FB', '1.6L', 'Diesel', 'i30, Accent, Elantra CRDi', 'diesel'),
        m('D4HB', '2.2L', 'Diesel', 'Santa Fe, Sorento, Starex', 'diesel'),
        m('D4HA', '2.0L', 'Diesel', 'Tucson, Sportage diesel', 'diesel'),
        m('G6BA', '2.7L', 'Petrol', 'Santa Fe, Sonata, Grandeur'),
        m('G6DC', '3.3L', 'Petrol', 'Palisade, Grandeur, Azera'),
        m('G4FJ', '1.6L', 'Petrol', 'Tucson, Elantra, Kona'),
      ],
    },
    kia: {
      name: 'Kia',
      slug: 'kia',
      origin: 'Korea',
      landingPage: 'brands/kia.html',
      models: [
        m('G4FC', '1.6L', 'Petrol', 'Cerato, Rio, Soul'),
        m('G4KD', '2.0L', 'Petrol', 'Optima, Sportage, Sorento'),
        m('G4NA', '2.0L', 'Petrol', 'Sportage, Optima, Forte'),
        m('G4FJ', '1.6L', 'Petrol', 'Cerato, Seltos, Stonic'),
        m('D4FB', '1.6L', 'Diesel', 'Cerato, Rio diesel variants', 'diesel'),
        m('D4HA', '2.0L', 'Diesel', 'Sportage, Sorento diesel', 'diesel'),
        m('G6DC', '3.3L', 'Petrol', 'Carnival, Sorento, K900'),
        m('G4KE', '2.4L', 'Petrol', 'Optima, Sportage, Sorento'),
      ],
    },
    byd: {
      name: 'BYD',
      slug: 'byd',
      origin: 'China',
      landingPage: 'brands/byd.html',
      models: [
        m('BYD476ZQA', '1.5L', 'Hybrid', 'Song, Qin, Tang hybrid platforms', 'hybrid'),
        m('BYD487ZQA', '1.5L', 'Petrol', 'Song, Qin, Tang turbo models'),
        m('BYD483ZQB', '1.5L', 'Petrol', 'F3, G3, older BYD platforms'),
        m('BYD371QA', '1.0L', 'Petrol', 'F0, small car applications'),
        m('BYD472QA', '2.0L', 'Petrol', 'S6, S7 SUV platforms'),
        m('BYD488ZQA', '1.5L', 'Petrol', 'Han, Tang, newer DM-i platforms'),
      ],
    },
    nissan: {
      name: 'Nissan',
      slug: 'nissan',
      origin: 'Japan',
      landingPage: 'brands/nissan.html',
      models: [
        m('HR15DE', '1.5L', 'Petrol', 'Tiida, Note, Sunny'),
        m('HR16DE', '1.6L', 'Petrol', 'Tiida, Note, Juke'),
        m('HR16', '1.6L', 'Petrol', 'Tiida, Note, Sunny'),
        m('MR20', '2.0L', 'Petrol', 'Qashqai, X-Trail, Sentra'),
        m('QR25', '2.5L', 'Petrol', 'X-Trail, Altima, Navara petrol'),
        m('QR25DE', '2.5L', 'Petrol', 'X-Trail, Altima, Navara petrol'),
        m('VQ35', '3.5L', 'Petrol', '350Z, Murano, Pathfinder'),
        m('VQ25', '2.5L', 'Petrol', 'Teana, Skyline, Fairlady'),
        m('YD25', '2.5L', 'Diesel', 'Navara, NP300, Frontier', 'diesel'),
        m('CD20', '2.0L', 'Diesel', 'Primera, X-Trail diesel', 'diesel'),
        m('TD27', '2.7L', 'Diesel', 'Patrol, Terrano, older Navara', 'diesel'),
        m('VQ40', '3.5L', 'Petrol', 'Navara, Pathfinder V6'),
      ],
    },
    honda: {
      name: 'Honda',
      slug: 'honda',
      origin: 'Japan',
      landingPage: 'brands/honda.html',
      models: [
        m('L15A', '1.5L', 'Petrol', 'Fit, Jazz, City'),
        m('R18A', '1.8L', 'Petrol', 'Civic, City, Stream'),
        m('K20A', '2.0L', 'Petrol', 'Accord, Civic, CR-V'),
        m('K24A', '2.4L', 'Petrol', 'Accord, CR-V, Odyssey'),
        m('J35A', '3.5L', 'Petrol', 'Pilot, Odyssey, Ridgeline'),
        m('N22A', '2.2L', 'Diesel', 'CR-V, Accord diesel', 'diesel'),
        m('L13B', '1.3L', 'Hybrid', 'Fit Hybrid, Jazz Hybrid', 'hybrid'),
        m('K20C', '2.0L', 'Petrol', 'Civic Type R, Accord turbo'),
      ],
    },
    mazda: {
      name: 'Mazda',
      slug: 'mazda',
      origin: 'Japan',
      landingPage: 'brands/mazda.html',
      models: [
        m('LF-VE', '2.0L', 'Petrol', 'Mazda 3, Mazda 6, Axela'),
        m('L5-VE', '2.5L', 'Petrol', 'Mazda 6, CX-5, Atenza'),
        m('PE-VPS', '2.0L', 'Petrol', 'CX-5, Mazda 3 Skyactiv-G'),
        m('PY-VPS', '2.5L', 'Petrol', 'CX-5, Mazda 6 Skyactiv-G'),
        m('SH-VPTS', '2.2L', 'Diesel', 'CX-5, Mazda 6 Skyactiv-D', 'diesel'),
        m('RF-Turbo', '2.0L', 'Petrol', 'Mazda 3, CX-30 turbo models'),
        m('F2', '2.0L', 'Petrol', 'BT-50, older Mazda platforms'),
        m('WL-T', '2.5L', 'Diesel', 'BT-50, B-Series', 'diesel'),
      ],
    },
    mitsubishi: {
      name: 'Mitsubishi',
      slug: 'mitsubishi',
      origin: 'Japan',
      landingPage: 'brands/mitsubishi.html',
      models: [
        m('4A91', '1.5L', 'Petrol', 'Mirage, Attrage, Colt'),
        m('4B11', '2.0L', 'Petrol', 'Lancer, ASX, Outlander'),
        m('4B12', '2.4L', 'Petrol', 'Outlander, Lancer, Galant Fortis'),
        m('4D56', '2.5L', 'Diesel', 'Pajero, Triton, L200', 'diesel'),
        m('6B31', '3.0L', 'Petrol', 'Outlander, Pajero Sport'),
        m('4G63', '2.0L', 'Petrol', 'Lancer Evolution, Galant'),
        m('4G64', '2.4L', 'Petrol', 'Pajero, L200, Delica'),
        m('4N15', '2.4L', 'Diesel', 'Triton, Pajero Sport, L200', 'diesel'),
      ],
    },
    subaru: {
      name: 'Subaru',
      slug: 'subaru',
      origin: 'Japan',
      landingPage: 'brands/subaru.html',
      models: [
        m('EJ20', '2.0L', 'Petrol', 'Impreza, Forester, Legacy boxer'),
        m('EJ25', '2.5L', 'Petrol', 'Forester, Outback, Legacy boxer'),
        m('FB25', '2.5L', 'Petrol', 'Forester, Outback, XV FB boxer'),
        m('FA20', '2.0L', 'Petrol', 'WRX, BRZ turbo variants'),
        m('EE20', '2.0L', 'Diesel', 'Forester, Legacy diesel boxer', 'diesel'),
        m('FB20', '2.0L', 'Petrol', 'Impreza, XV, Crosstrek'),
      ],
    },
    geely: {
      name: 'Geely',
      slug: 'geely',
      origin: 'China',
      landingPage: 'brands/geely.html',
      models: [
        m('JLγ-FE', '1.5L', 'Petrol', 'Emgrand, Boyue, Coolray'),
        m('1.5TD', '1.5L', 'Petrol', 'Binyue, Xingyue, newer Geely models'),
        m('1.8L NA', '1.8L', 'Petrol', 'Emgrand EC7, GC7'),
        m('2.0TD', '2.0L', 'Petrol', 'Tugella, Xingyue L, larger SUVs'),
        m('JLH-3G15TD', '1.5L', 'Petrol', 'Coolray, Binyue, Atlas Pro'),
        m('4G18', '1.8L', 'Petrol', 'Emgrand, older Geely platforms'),
      ],
    },
    chery: {
      name: 'Chery',
      slug: 'chery',
      origin: 'China',
      landingPage: 'brands/chery.html',
      models: [
        m('SQRE4T15B', '1.5L', 'Petrol', 'Tiggo, Arrizo, Exeed turbo'),
        m('ACTECO 1.6L', '1.6L', 'Petrol', 'Tiggo 3, A3, older platforms'),
        m('F4J16', '1.6L', 'Petrol', 'Tiggo 7, Tiggo 8, newer models'),
        m('SQRE4G15', '1.5L', 'Petrol', 'Tiggo 2, QQ, entry-level models'),
        m('SQRF4J16', '1.6L', 'Petrol', 'Tiggo 8 Pro, Arrizo 8'),
        m('E4T15B', '1.5L', 'Petrol', 'Exeed, Tiggo 7 Pro turbo'),
      ],
    },
    'great-wall': {
      name: 'Great Wall',
      slug: 'great-wall',
      origin: 'China',
      landingPage: 'brands/great-wall.html',
      models: [
        m('4G69', '2.4L', 'Petrol', 'Haval H5, Wingle, Steed'),
        m('GW4C20', '2.0L', 'Petrol', 'Haval H6, H2 turbo'),
        m('GW4D20', '2.0L', 'Diesel', 'Wingle, Steed, P-Series', 'diesel'),
      ],
    },
    ssangyong: {
      name: 'SsangYong',
      slug: 'ssangyong',
      origin: 'Korea',
      landingPage: 'brands/ssangyong.html',
      models: [
        m('D20DT', '2.0L', 'Diesel', 'Korando, Rexton, Musso', 'diesel'),
        m('G20DT', '2.0L', 'Diesel', 'Rexton, Kyron diesel', 'diesel'),
        m('D22DT', '2.2L', 'Diesel', 'Rexton, Musso', 'diesel'),
      ],
    },
    mg: {
      name: 'MG',
      slug: 'mg',
      origin: 'China',
      landingPage: 'brands/mg.html',
      models: [
        m('15S4C', '1.5L', 'Petrol', 'MG ZS, MG5, MG3'),
        m('20T4E5', '2.0L', 'Petrol', 'MG HS, MG7 turbo'),
        m('18K4G', '1.8L', 'Petrol', 'MG6, older MG platforms'),
      ],
    },
  };

  function getBrandEngines(slug) {
    return ENGINE_DIRECTORY[slug] || null;
  }

  function getAllBrands() {
    return Object.values(ENGINE_DIRECTORY);
  }

  function totalModelCount() {
    return Object.values(ENGINE_DIRECTORY).reduce((n, b) => n + b.models.length, 0);
  }

  function normCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  }

  function ensureBrand(slug) {
    if (ENGINE_DIRECTORY[slug]) return ENGINE_DIRECTORY[slug];
    const brand = window.BRAND_CATALOG?.[slug];
    ENGINE_DIRECTORY[slug] = {
      name: brand?.name || slug,
      slug,
      origin: brand?.origin || '',
      landingPage: brand ? `brands/${slug}.html` : 'brands.html',
      models: [],
    };
    return ENGINE_DIRECTORY[slug];
  }

  function mergeLearnedEngines(map) {
    if (!map || typeof map !== 'object') return;
    Object.entries(map).forEach(([slug, entries]) => {
      if (!Array.isArray(entries) || !entries.length) return;
      const brand = ensureBrand(slug);
      const known = new Set(brand.models.map((item) => normCode(item.code)));
      entries.forEach((entry) => {
        const code = String(entry.code || entry).trim();
        if (!code || known.has(normCode(code))) return;
        known.add(normCode(code));
        const apps = entry.model
          ? `${entry.model}${entry.year ? ` (${entry.year})` : ''} applications`
          : 'Half-cut inventory reference';
        brand.models.push(m(code, '—', 'Petrol', apps, 'petrol'));
      });
      brand.models.sort((a, b) => a.code.localeCompare(b.code, undefined, { sensitivity: 'base' }));
    });
  }

  window.ENGINE_DIRECTORY = ENGINE_DIRECTORY;
  window.ENGINE_EXPORT_STATUS = EXPORT_STATUS;
  window.getBrandEngines = getBrandEngines;
  window.getAllEngineBrands = getAllBrands;
  window.getEngineModelCount = totalModelCount;
  window.mergeLearnedEngines = mergeLearnedEngines;
})();
