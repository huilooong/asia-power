#!/usr/bin/env node
/**
 * AsiaPower Engine Page Generator
 *
 * Generates code-first engine SEO pages from repository-local signals only.
 * Does not call external APIs, scrape websites, deploy, or send messages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SITE_URL = 'https://asia-power.com';
const TODAY = '2026-07-05';

const INVALID_CODES = new Set([
  'ENG', 'ENGINE', 'N/A', 'NA', 'UNKNOWN', 'MAN', '11', '4.0L', '4.0',
  'APA2WW', '311023976', 'LMU', 'LE5', 'LCU', 'LDE', 'CEA', 'CDZ', '8ZR',
  '6WG51-TCG51',
]);

const ALIASES = new Map([
  ['651 955', '651.955'],
  ['651-955', '651.955'],
  ['MR20', 'MR20DE'],
  ['QR25', 'QR25DE'],
  ['HR16', 'HR16DE'],
  ['1AZ', '1AZ-FE'],
  ['2AZ', '2AZ-FE'],
  ['1NZ', '1NZ-FE'],
  ['1GR', '1GR-FE'],
  ['CUMMINS6BT', '6BT'],
]);

const BRAND_ZH = new Map([
  ['丰田', 'Toyota'],
  ['本田', 'Honda'],
  ['日产', 'Nissan'],
  ['现代', 'Hyundai'],
  ['起亚', 'Kia'],
  ['奔驰', 'Mercedes-Benz'],
  ['三菱', 'Mitsubishi'],
  ['铃木', 'Suzuki'],
]);

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function write(file, text) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function cleanCode(value) {
  if (value == null) return '';
  let code = String(value).trim().replace(/\s+/g, ' ').toUpperCase();
  code = ALIASES.get(code) || code;
  if (!code || INVALID_CODES.has(code)) return '';
  if (!/[A-Z]/.test(code) && !/^\d{3}\.\d{3}$/.test(code)) return '';
  if (code.length < 3) return '';
  return code;
}

function slugFor(code) {
  return code.toLowerCase()
    .replace(/γ/g, 'gamma')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uniq(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = String(value || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function top(counter, n) {
  return [...counter.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

function addCount(map, key, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + by);
}

function normalizeBrand(value) {
  const v = String(value || '').trim();
  return BRAND_ZH.get(v) || v;
}

function parseEngineDirectory() {
  const text = read('js/engine-directory.js');
  const directory = new Map();
  const brandRe = /([\w'-]+): \{\s*\n\s*name: '([^']+)'[\s\S]*?origin: '([^']+)'[\s\S]*?landingPage: '([^']+)'[\s\S]*?models: \[([\s\S]*?)\n\s*\]/g;
  let brandMatch;
  while ((brandMatch = brandRe.exec(text))) {
    const [, , brand, origin, landingPage, modelBlock] = brandMatch;
    const modelRe = /m\('([^']+)', '([^']+)', '([^']+)', '([^']*)'(?:, '([^']+)')?\)/g;
    let modelMatch;
    while ((modelMatch = modelRe.exec(modelBlock))) {
      const [, rawCode, displacement, fuel, applications] = modelMatch;
      const code = cleanCode(rawCode);
      if (!code) continue;
      const rec = directory.get(code) || {
        brands: new Map(),
        applications: new Map(),
        origins: new Map(),
        displacement: '',
        fuel: '',
        sources: new Set(),
        landingPages: new Set(),
      };
      addCount(rec.brands, brand, 3);
      addCount(rec.origins, origin, 1);
      for (const app of applications.split(',').map(s => s.trim()).filter(Boolean)) {
        addCount(rec.applications, app, 2);
      }
      rec.displacement ||= displacement;
      rec.fuel ||= fuel;
      rec.sources.add('js/engine-directory.js');
      rec.landingPages.add(landingPage);
      directory.set(code, rec);
    }
  }
  return directory;
}

function loadInventory() {
  const files = ['work/half-cut-approved-prod.json', 'reports/qxb-approved-import.json'];
  const byCode = new Map();
  for (const file of files) {
    if (!exists(file)) continue;
    const rows = JSON.parse(read(file));
    for (const item of Array.isArray(rows) ? rows : []) {
      const code = cleanCode(item.engineCode || item.engine_code || item.engine);
      if (!code) continue;
      const rec = byCode.get(code) || {
        count: 0,
        brands: new Map(),
        models: new Map(),
        years: new Map(),
        transmissions: new Map(),
        drivetrains: new Map(),
        items: [],
        sources: new Set(),
      };
      rec.count += 1;
      rec.sources.add(file);
      addCount(rec.brands, normalizeBrand(item.brand), 1);
      addCount(rec.models, String(item.model || '').trim(), 1);
      addCount(rec.years, String(item.year || '').trim(), 1);
      addCount(rec.transmissions, String(item.transmissionCode || '').trim(), 1);
      addCount(rec.drivetrains, String(item.drivetrain || '').trim(), 1);
      if (rec.items.length < 6 && (item.title || item.slug || item.stockId)) {
        rec.items.push({
          stockId: item.stockId || '',
          title: item.title || '',
          slug: item.slug || '',
          brand: normalizeBrand(item.brand),
          model: item.model || '',
          year: item.year || '',
          transmission: item.transmissionCode || '',
          drivetrain: item.drivetrain || '',
          source: file,
        });
      }
      byCode.set(code, rec);
    }
  }
  return byCode;
}

function loadProductionList() {
  const report = read('docs/cto/production-001.md');
  const rows = [...report.matchAll(/`engines\/([^`]+\.html)` - ([^(\n]+)\(([^;\n]+); inventory signals: ([0-9]+)/g)];
  return rows.map(row => ({
    file: `engines/${row[1]}`,
    slug: row[1].replace(/\.html$/, ''),
    code: cleanCode(row[2].trim()) || row[2].trim(),
  }));
}

function buildRecords() {
  const directory = parseEngineDirectory();
  const inventory = loadInventory();
  const production = loadProductionList();
  const records = production.map(entry => {
    const dir = directory.get(entry.code) || null;
    const inv = inventory.get(entry.code) || null;
    const brands = new Map();
    const applications = new Map();
    const origins = new Map();
    const sources = new Set();
    if (dir) {
      for (const [k, v] of dir.brands) addCount(brands, k, v);
      for (const [k, v] of dir.applications) addCount(applications, k, v);
      for (const [k, v] of dir.origins) addCount(origins, k, v);
      for (const source of dir.sources) sources.add(source);
    }
    if (inv) {
      for (const [k, v] of inv.brands) addCount(brands, k, v);
      for (const [k, v] of inv.models) addCount(applications, k, v);
      for (const source of inv.sources) sources.add(source);
      sources.add('inventory/half-cut data');
    }
    if (['G4FC', 'R20A3', '1ZR-FE', 'G4NA', 'HR16DE', 'K24A8', '1AZ-FE', '2AZ-FE', 'MR20DE', 'G4KE', 'G4KJ', '4JB1', '1GR-FE'].includes(entry.code)) {
      sources.add('docs/cto/task-002-growth-audit.md');
    }
    const brandList = top(brands, 4).map(([k]) => k).filter(Boolean);
    const appList = top(applications, 10).map(([k]) => k).filter(Boolean);
    const originList = top(origins, 3).map(([k]) => k).filter(Boolean);
    return {
      ...entry,
      brands: brandList.length ? brandList : ['AsiaPower'],
      applications: appList.length ? appList : ['application requires confirmation'],
      origin: originList.join(', ') || 'Not verified yet',
      displacement: dir?.displacement || 'Not verified yet',
      fuel: dir?.fuel || 'Not verified yet',
      inventoryCount: inv?.count || 0,
      inventoryItems: inv?.items || [],
      years: inv ? top(inv.years, 6).map(([k]) => k).filter(Boolean) : [],
      transmissions: inv ? top(inv.transmissions, 5).map(([k]) => k).filter(Boolean) : [],
      drivetrains: inv ? top(inv.drivetrains, 4).map(([k]) => k).filter(Boolean) : [],
      sources: [...sources].sort(),
    };
  });
  for (const record of records) {
    record.related = records
      .filter(other => other.code !== record.code)
      .map(other => ({
        other,
        score: (other.brands.some(b => record.brands.includes(b)) ? 10 : 0)
          + (other.fuel === record.fuel ? 2 : 0)
          + Math.min(other.inventoryCount, 20) / 10,
      }))
      .sort((a, b) => b.score - a.score || a.other.code.localeCompare(b.other.code))
      .slice(0, 4)
      .map(x => x.other);
  }
  return records;
}

function segment(record) {
  const brand = record.brands.join(' / ');
  const fuel = record.fuel.toLowerCase();
  const brandKey = brand.toUpperCase();
  const code = record.code.toUpperCase();
  if (brandKey.includes('MERCEDES') || /^(651|M27|112|266)/.test(code)) return 'mercedes';
  if (brandKey.includes('NISSAN') || /^(HR|MR|QR|VQ|YD|TD)\d*/.test(code)) return 'nissan';
  if (brandKey.includes('HONDA') || /^(K24|K20|R18|R20|L13|L15)/.test(code)) return 'honda';
  if (brandKey.includes('TOYOTA') || /^(1NZ|2NZ|1AZ|2AZ|1ZR|2ZR|3ZR|1KD|2KD|1GR|2GR|1JZ|2JZ|2TR|3ZZ)/.test(code)) return 'toyota';
  if (brandKey.includes('HYUNDAI') || brandKey.includes('KIA') || /^(G4|G6|D4)/.test(code)) return 'hyundai-kia';
  if (/diesel/.test(fuel)) return 'diesel';
  return 'general';
}

function strength(record) {
  if (record.inventoryCount >= 25) return 'strong';
  if (record.inventoryCount >= 8) return 'active';
  if (record.inventoryCount >= 1) return 'light';
  return 'sourcing';
}

function firstApps(record, n = 4) {
  return record.applications.filter(x => x !== 'application requires confirmation').slice(0, n);
}

function listItems(items) {
  return items.map(item => `<li>${item}</li>`).join('\n');
}

function sectionCopy(record) {
  const code = record.code;
  const apps = firstApps(record, 5);
  const appText = apps.length ? apps.join(', ') : 'matched donor vehicles';
  const brand = record.brands.join(' / ');
  const seg = segment(record);
  const supply = strength(record);
  const trans = record.transmissions.length ? record.transmissions.join(', ') : 'gearbox code must be confirmed';
  const years = record.years.length ? record.years.join(', ') : 'year range not verified yet';

  const buyerGuideBySegment = {
    'hyundai-kia': `${code} buyers should confirm whether the donor is Hyundai or Kia, because the same engine code can appear across several shared platforms. Ask for the donor model, year, transmission, accessory list, and clear engine-code evidence before comparing offers.`,
    toyota: `${code} Toyota buyers should match the engine code with the exact chassis generation and transmission. Toyota codes can be close in name but different in wiring, sensors, mounts, and ECU pairing, so a Camry, Corolla, Hilux, or Prado enquiry should include year and destination market.`,
    honda: `${code} Honda buyers should check the engine suffix and donor chassis carefully. Honda K, R, and L family variants can look similar in listings while differing in mounts, manifolds, sensors, and gearbox pairing.`,
    nissan: `${code} Nissan buyers should confirm the donor model and gearbox before price comparison. HR, MR, and QR engines often appear in several models, but CVT, AT, MT, 2WD, and 4WD pairings can change what should be shipped.`,
    mercedes: `${code} Mercedes-Benz buyers should treat the variant number as part of the matching process. The same family can have multiple sub-variants, so AsiaPower should confirm donor model, year, gearbox, and accessory set before quotation.`,
    diesel: `${code} diesel buyers should ask for cold-start evidence, turbo/accessory condition, injector or pump notes where available, and gearbox pairing. Diesel exports need stricter confirmation because accessories and harness details affect installation cost.`,
    general: `${code} buyers should use the engine code as the first filter, then confirm donor model, year, transmission, included accessories, and export packing before comparing prices.`,
  };

  const mistakeBySegment = {
    'hyundai-kia': [
      `Mixing Hyundai and Kia donor listings without checking the exact ${code} accessory set.`,
      'Assuming Sportage, Sonata, Elantra, Tucson, Forte, or ix35 fitment is identical across years.',
      'Ignoring gearbox pairing when the buyer actually needs an engine and gearbox assembly.',
    ],
    toyota: [
      `Confusing ${code} with a nearby Toyota engine family or market variant.`,
      'Buying from a model name alone without confirming chassis generation and transmission.',
      'Forgetting that wiring, ECU, mounts, and accessories may differ by export market.',
    ],
    honda: [
      `Treating ${code} as interchangeable with every Honda engine carrying a similar prefix.`,
      'Ignoring whether the donor is Civic, Accord, CR-V, Fit, Stream, or Odyssey.',
      'Missing intake, exhaust, sensor, and gearbox differences across variants.',
    ],
    nissan: [
      `Confusing ${code} with a related HR/MR/QR/VQ family code.`,
      'Not checking CVT, AT, MT, 2WD, or 4WD pairing before shipping.',
      'Using model name only when the same model line has multiple engine options.',
    ],
    mercedes: [
      `Dropping the numeric suffix from ${code} and matching only by Mercedes engine family.`,
      'Assuming C, E, B, V, GL, R, or Sprinter applications share the same accessories.',
      'Not checking whether the buyer needs engine only, engine with gearbox, or front cut.',
    ],
    diesel: [
      `Buying ${code} without turbo, pump, injector, or harness confirmation.`,
      'Ignoring startup evidence and donor mileage condition where available.',
      'Underestimating packing and oil/fuel drain requirements for export.',
    ],
    general: [
      `Searching only by ${code} without donor vehicle evidence.`,
      'Comparing bare-engine price against complete engine or half-cut price.',
      'Leaving destination port and included accessories unclear during quotation.',
    ],
  };

  const inspectionBySegment = {
    'hyundai-kia': [
      `Confirm the ${code} marking or VIN-decode evidence before quote.`,
      'Check donor model, year, transmission, and drivetrain.',
      'Request photos of engine bay, mounts, harness, ECU where included, and accessories.',
      'Confirm whether buyer needs bare engine, complete engine, or half-cut.',
    ],
    toyota: [
      `Confirm ${code} against donor vehicle and chassis generation.`,
      'Check gearbox pairing, wiring harness, ECU availability, alternator, compressor, and starter.',
      'Ask whether the unit comes from sedan, SUV, pickup, or van platform.',
      'Confirm export packing and oil/fluid handling before shipment.',
    ],
    honda: [
      `Verify ${code} suffix and donor chassis before comparing price.`,
      'Check intake, exhaust, sensors, mounts, compressor, alternator, and starter.',
      'Confirm AT/CVT/MT gearbox matching if gearbox is included.',
      'Ask for startup video or donor-vehicle evidence where available.',
    ],
    nissan: [
      `Confirm ${code} against VIN/decode evidence or donor label.`,
      'Check CVT/AT/MT pairing and 2WD/4WD drivetrain before quote.',
      'Review included harness, ECU, sensors, alternator, compressor, and starter.',
      'Ask for photo evidence of the engine bay and donor vehicle.',
    ],
    mercedes: [
      `Confirm the full ${code} variant, not only the family number.`,
      'Check donor model, year, gearbox, ECU/harness, and accessory set.',
      'Ask whether the unit is engine only, engine with gearbox, or half-cut.',
      'Confirm export packing because Mercedes accessories and wiring add risk.',
    ],
    diesel: [
      `Confirm ${code} and donor application before price discussion.`,
      'Request startup video, turbo/accessory photos, and injector/pump notes where possible.',
      'Check gearbox pairing, harness, ECU, and included cooling components.',
      'Confirm drain, packing, and port requirements before CIF quote.',
    ],
    general: [
      `Confirm ${code} from donor evidence before quotation.`,
      'Check donor model, year, transmission, drivetrain, and included accessories.',
      'Request current photos or video when available.',
      'Confirm destination port and EXW/CIF terms before final price.',
    ],
  };

  const chinaSupply = {
    strong: `AsiaPower has many repository inventory signals for ${code}, so China-side checking should start from verified half-cut records before wider supplier outreach.`,
    active: `${code} has active repository inventory signals. Start with existing records, then ask suppliers for current photos, price basis, and availability before quoting.`,
    light: `${code} has limited current inventory evidence. Treat it as sourceable but confirmation-heavy, and ask APInventory to verify supplier availability before customer commitment.`,
    sourcing: `${code} is currently a sourcing-led page. Use it to capture demand, but do not promise stock until APInventory confirms a supplier or Verified Inventory record.`,
  };

  const exportNotes = {
    'hyundai-kia': `For ${code}, West Africa buyers often ask for engine plus accessories or a front half-cut. Confirm Tema, Lagos, Cotonou, Douala, Abidjan, or Mombasa before building EXW/CIF options.`,
    toyota: `Toyota ${code} enquiries should separate workshop single-engine orders from importer half-cut orders. CIF quotes should state whether gearbox, harness, ECU, and accessories are included.`,
    honda: `Honda ${code} shipments need clear packing notes because buyers may compare bare engine, engine with gearbox, and half-cut prices. Confirm port and accessories before quote.`,
    nissan: `Nissan ${code} exports should document gearbox type and drivetrain on the quote. For ports such as Tema, Lagos, and Mombasa, note whether LCL or container loading is expected.`,
    mercedes: `Mercedes-Benz ${code} export quotes should avoid shorthand descriptions. List included gearbox, wiring, ECU, accessories, and packing basis before the buyer compares price.`,
    diesel: `Diesel ${code} exports should include drain/packing expectations, accessory list, and whether turbo or pump components are included. Confirm CIF route before final quote.`,
    general: `For ${code}, AsiaPower should quote only after confirming destination port, packing method, included accessories, and whether the customer needs engine only or a larger cut.`,
  };

  const recommendation = {
    strong: `AsiaPower recommendation: treat ${code} as a priority engine page. Keep related inventory fresh, add verified photos when public-safe, and route enquiries directly into APSales quote preparation.`,
    active: `AsiaPower recommendation: keep ${code} live and enrich it with confirmed stock examples. APSales should ask for model/year/port first, while APInventory confirms current supplier status.`,
    light: `AsiaPower recommendation: keep ${code} as a monitored opportunity. Do not push aggressive stock wording; use enquiries to decide whether supplier confirmation effort is justified.`,
    sourcing: `AsiaPower recommendation: use ${code} as a demand-capture page only. Before active promotion, add Verified Inventory, stronger references, or repeated inquiry evidence.`,
  };

  const cta = {
    strong: `Ask AsiaPower for current ${code} stock, matching half-cuts, gearbox pairing, photos, and EXW/CIF price to your destination port.`,
    active: `Send your ${code} model, year, transmission, and port. AsiaPower will check verified records and supplier confirmation before quoting.`,
    light: `Need ${code}? Send donor vehicle details and destination port so AsiaPower can check current China supply before price confirmation.`,
    sourcing: `Looking for ${code}? Share model, year, VIN/chassis if available, and port; AsiaPower will confirm whether reliable China supply exists.`,
  };

  const commonQuestions = [
    {
      q: `Which vehicles should I mention when asking for a ${code} quote?`,
      a: `Start with ${appText}. If your vehicle is not listed, send the exact model, year, transmission, and VIN or chassis evidence so AsiaPower can avoid a wrong-code match.`,
    },
    {
      q: `Can AsiaPower supply ${code} as engine only or half-cut?`,
      a: record.inventoryItems.length
        ? `Current repository records for ${code} include half-cut or engine-and-gearbox style records. Final supply depends on fresh stock confirmation, photos, and included-parts review.`
        : `${code} can be handled as a sourcing request. AsiaPower must first confirm whether suppliers have engine-only, engine-and-gearbox, or half-cut options.`,
    },
    {
      q: `What details speed up a ${code} quotation?`,
      a: `Send destination port, required quantity, donor model, year, gearbox type, and whether you need accessories. For ${code}, known gearbox signals include: ${trans}.`,
    },
  ];

  const relatedGearboxes = record.transmissions.length
    ? record.transmissions.map(t => `${t} pairing appears in ${code} repository records; confirm it against donor model before quote.`)
    : [`No gearbox code is verified for ${code} in current page data; confirm AT, MT, CVT, or gearbox code before buying.`];

  return {
    buyerGuide: buyerGuideBySegment[seg],
    mistakes: mistakeBySegment[seg],
    inspection: inspectionBySegment[seg],
    chinaSupply: chinaSupply[supply],
    exportNotes: exportNotes[seg],
    recommendation: recommendation[supply],
    cta: cta[supply],
    commonQuestions,
    relatedGearboxes,
    years,
    trans,
  };
}

function jsonLd(record, copy) {
  const graph = [
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/engines/${record.slug}.html#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Engines', item: `${SITE_URL}/engines/` },
        { '@type': 'ListItem', position: 3, name: `${record.code} Engine`, item: `${SITE_URL}/engines/${record.slug}.html` },
      ],
    },
    {
      '@type': 'Product',
      '@id': `${SITE_URL}/engines/${record.slug}.html#product`,
      name: `${record.code} Engine`,
      brand: record.brands.map(name => ({ '@type': 'Brand', name })),
      category: 'Used engine and half-cut sourcing',
      url: `${SITE_URL}/engines/${record.slug}.html`,
      description: `AsiaPower sourcing page for ${record.code} engine enquiries. Availability and price require stock and supplier confirmation before quotation.`,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Engine code', value: record.code },
        { '@type': 'PropertyValue', name: 'Displacement', value: record.displacement },
        { '@type': 'PropertyValue', name: 'Fuel type', value: record.fuel },
        { '@type': 'PropertyValue', name: 'Inventory signal count', value: String(record.inventoryCount) },
      ],
      offers: {
        '@type': 'Offer',
        availability: 'https://schema.org/LimitedAvailability',
        priceCurrency: 'USD',
        url: `${SITE_URL}/engines/${record.slug}.html#inquiry`,
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/engines/${record.slug}.html#faq`,
      mainEntity: copy.commonQuestions.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

function linkList(items) {
  return `<ul class="link-list">\n${items.join('\n')}\n</ul>`;
}

function renderHalfCuts(record) {
  if (!record.inventoryItems.length) {
    return `<p>${esc(record.code)} does not yet have public related half-cut examples in this batch. Treat this as a sourcing page until APInventory confirms stock records.</p>`;
  }
  const items = record.inventoryItems.slice(0, 4).map(item => {
    const title = item.title || `${item.brand} ${item.model} ${item.year} ${record.code}`.trim();
    const meta = [item.stockId, item.transmission, item.drivetrain].filter(Boolean).join(' · ');
    if (item.slug) {
      return `<li><a href="../half-cuts/detail.html?slug=${esc(item.slug)}"><strong>${esc(title)}</strong><span>${esc(meta || 'Inventory record')}</span></a></li>`;
    }
    return `<li><strong>${esc(title)}</strong><span>${esc(meta || 'Inventory record')}</span></li>`;
  });
  return linkList(items);
}

function renderReferences(record) {
  const sources = record.sources.length ? record.sources : ['engine candidate generated from Production-001 list'];
  return sources.slice(0, 8).map(source => `<tr><td>${esc(source)}</td><td>Repository source</td><td>${TODAY}</td></tr>`).join('\n');
}

function renderPage(record) {
  const copy = sectionCopy(record);
  const apps = firstApps(record, 5);
  const appText = apps.length ? apps.join(', ') : 'application requires confirmation';
  const title = `${record.code} Engine - Export & Sourcing | AsiaPower`;
  const meta = `Source ${record.code} engines for export. Applications: ${appText}. AsiaPower checks China supply, related half-cuts, gearbox pairing, and EXW/CIF quote details.`;
  const brandText = record.brands.join(' / ');
  const waText = encodeURIComponent(`${copy.cta} Engine code: ${record.code}. Applications: ${appText}.`);
  const relatedEngines = record.related.map(other => `<li><a href="${esc(other.slug)}.html"><strong>${esc(other.code)} Engine</strong><span>${esc(other.brands.slice(0, 2).join(' / '))}</span></a></li>`);
  const applicationRows = record.applications.slice(0, 8).map(app => `<tr><td>${esc(app)}</td><td>${esc(copy.years)}</td><td>${esc(record.transmissions.join(', ') || 'Not verified yet')}</td></tr>`).join('\n');
  const heroSummary = `${record.code} is generated from AsiaPower repository signals for ${brandText}, with ${record.inventoryCount} inventory signal${record.inventoryCount === 1 ? '' : 's'} and application coverage around ${appText}.`;
  const specNote = `${record.code} official power, torque, bore, stroke, compression, and service interval remain unfilled until AsiaPower attaches a verified technical source.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#ffffff">
  <meta name="description" content="${esc(meta)}">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://www.googletagmanager.com">
  <link rel="preload" href="../assets/fonts/barlow-condensed-800-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../css/fonts.css?v=self-hosted-fonts-v1">
  <link rel="stylesheet" href="../css/styles.css?v=exw-badge-v1">
  <link rel="stylesheet" href="../css/ebay-layout.css?v=62" data-ebay-layout="1">
  <link rel="icon" href="../assets/favicon.png" type="image/png">
  <link rel="canonical" href="${SITE_URL}/engines/${esc(record.slug)}.html">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(meta)}">
  <meta property="og:url" content="${SITE_URL}/engines/${esc(record.slug)}.html">
  <meta property="og:image" content="${SITE_URL}/assets/asia-power-og.svg">
  <meta name="twitter:card" content="summary_large_image">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-PB2J3VRX5J"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-PB2J3VRX5J');</script>
  <style>
    .engine-page{background:#f6f7f9;color:#172033}.engine-hero{background:linear-gradient(135deg,#111827 0%,#20324f 68%,#946511 100%);color:#fff;padding:40px 0 32px}.engine-hero h1{margin:0 0 12px;color:#fff;font-size:clamp(2.2rem,5vw,4.6rem);line-height:1;letter-spacing:0}.engine-hero p{max-width:820px;color:rgba(255,255,255,.86);line-height:1.7}.engine-hero .ebay-breadcrumb,.engine-hero .ebay-breadcrumb a{color:rgba(255,255,255,.78)}.hero-grid{display:grid;grid-template-columns:minmax(0,1fr)330px;gap:28px;align-items:end}.quick-card,.engine-card,.form-card{background:#fff;border:1px solid #e1e6ee;border-radius:8px;box-shadow:0 10px 24px rgba(15,23,42,.06)}.quick-card{padding:20px;color:#1f2937}.quick-card p{color:#5f6b7a}.meta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:22px}.meta{border:1px solid rgba(255,255,255,.22);border-radius:8px;background:rgba(255,255,255,.1);padding:13px 15px}.meta span{display:block;color:rgba(255,255,255,.64);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.meta strong{display:block;color:#fff;margin-top:6px}.engine-section{padding:30px 0}.layout{display:grid;grid-template-columns:minmax(0,1.45fr)minmax(290px,.55fr);gap:22px;align-items:start}.engine-card,.form-card{padding:22px;margin-bottom:18px}.engine-card h2,.form-card h2{margin:0 0 12px;color:#111827;font-size:1.42rem}.engine-card h3{font-size:1.05rem;color:#111827;margin:18px 0 8px}.engine-card p,.engine-card li,.form-card p{color:#536170;line-height:1.7}.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}.chip-row li,.badge{border:1px solid #d7dde6;border-radius:999px;background:#f8fafc;color:#253349;font-size:.84rem;font-weight:700;padding:8px 11px;line-height:1}.badge-warn{background:#fff7e6;border-color:#f0c36d;color:#7a4d00}.table-wrap{overflow-x:auto;border:1px solid #e3e7ee;border-radius:8px}table{width:100%;min-width:620px;border-collapse:collapse;background:#fff}th,td{padding:11px 13px;text-align:left;vertical-align:top;border-bottom:1px solid #e6eaf0}th{background:#f3f5f8;color:#6b7280;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}td{color:#233044;font-size:.94rem}tr:last-child td{border-bottom:0}.note{border-left:4px solid #d4a017;background:#fff8e8;color:#60410b;padding:13px 15px;border-radius:0 8px 8px 0}.link-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}.link-list a,.link-list li{display:flex;justify-content:space-between;gap:12px;border:1px solid #e3e7ee;border-radius:8px;padding:13px 15px;background:#fff;color:#172033;text-decoration:none}.link-list a:hover{border-color:#c8941f}.link-list span{color:#7b8491;font-size:.86rem}.qa-list{display:grid;gap:12px}.qa-item{border-top:1px solid #e3e7ee;padding-top:12px}.qa-item strong{display:block;color:#172033;margin-bottom:5px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.full{grid-column:1/-1}label{display:block;margin-bottom:6px;color:#172033;font-weight:700}input,select,textarea{width:100%;border:1px solid #ccd4df;border-radius:8px;padding:11px 12px;background:#fff;color:#172033;font:inherit}textarea{min-height:118px;resize:vertical}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.actions .btn{min-width:170px;justify-content:center}.small{color:#7b8491;font-size:.84rem;line-height:1.6}@media(max-width:900px){.hero-grid,.layout{grid-template-columns:1fr}.meta-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.meta-grid,.form-grid{grid-template-columns:1fr}.engine-card,.form-card,.quick-card{padding:18px}.actions .btn{width:100%}}
  </style>
  <script type="application/ld+json">
${jsonLd(record, copy)}
  </script>
</head>
<body class="engine-page" data-page="engine-growth" data-engine="${esc(record.slug)}">
  <div id="site-topbar"></div><div id="site-header"></div>
  <main id="main-content">
    <section class="engine-hero">
      <div class="container">
        <nav class="ebay-breadcrumb" aria-label="Breadcrumb"><ol><li><a href="../index.html">Home</a></li><li><a href="../engines/">Engines</a></li><li aria-current="page">${esc(record.code)} Engine</li></ol></nav>
        <div class="hero-grid">
          <div>
            <h1>${esc(record.code)} Engine</h1>
            <p>${esc(heroSummary)}</p>
            <div class="meta-grid"><div class="meta"><span>Engine code</span><strong>${esc(record.code)}</strong></div><div class="meta"><span>Brand signal</span><strong>${esc(brandText)}</strong></div><div class="meta"><span>Inventory signals</span><strong>${record.inventoryCount}</strong></div><div class="meta"><span>Trade terms</span><strong>EXW / CIF</strong></div></div>
          </div>
          <aside class="quick-card"><h2>${esc(record.code)} quote path</h2><p>${esc(copy.cta)}</p><a class="btn btn-whatsapp" href="https://wa.me/233540911111?text=${waText}" target="_blank" rel="noopener noreferrer">WhatsApp ${esc(record.code)}</a><a class="btn btn-outline" href="#inquiry">Send enquiry</a></aside>
        </div>
      </div>
    </section>
    <section class="engine-section"><div class="container layout"><div>
      <article class="engine-card"><h2>Engine Overview</h2><p>${esc(record.code)} is tracked by AsiaPower as a ${esc(brandText)} engine-code opportunity. Current repository signals show ${record.inventoryCount} related inventory record${record.inventoryCount === 1 ? '' : 's'} and applications including ${esc(appText)}.</p><ul class="chip-row"><li>${esc(record.displacement)}</li><li>${esc(record.fuel)}</li><li>${esc(record.origin)}</li><li>${esc(copy.trans)}</li></ul></article>
      <article class="engine-card"><h2>Common Buyer Questions</h2><div class="qa-list">${copy.commonQuestions.map(item => `<div class="qa-item"><strong>${esc(item.q)}</strong><p>${esc(item.a)}</p></div>`).join('\n')}</div></article>
      <article class="engine-card"><h2>Engine-specific Buying Guide</h2><p>${esc(copy.buyerGuide)}</p><p>When comparing ${esc(record.code)} offers, separate three quote types: bare engine, complete engine with accessories, and half-cut or engine-and-gearbox assembly. AsiaPower records the requested form before asking suppliers for current condition and price.</p></article>
      <article class="engine-card"><h2>Applications</h2><p>Known application signals for ${esc(record.code)} are listed from current repository data. Final fitment still requires donor model, year, transmission, drivetrain, and VIN or chassis evidence.</p><div class="table-wrap"><table><thead><tr><th>Application</th><th>Year signals</th><th>Gearbox signals</th></tr></thead><tbody>${applicationRows}</tbody></table></div></article>
      <article class="engine-card"><h2>Specifications</h2><div class="table-wrap"><table><thead><tr><th>Field</th><th>Value</th><th>Source</th></tr></thead><tbody><tr><td>Engine code</td><td>${esc(record.code)}</td><td>Repository engine/inventory records</td></tr><tr><td>Manufacturer / brand</td><td>${esc(brandText)}</td><td>Engine directory or inventory records</td></tr><tr><td>Displacement</td><td>${esc(record.displacement)}</td><td>${record.displacement === 'Not verified yet' ? 'Not verified yet' : 'js/engine-directory.js'}</td></tr><tr><td>Fuel type</td><td>${esc(record.fuel)}</td><td>${record.fuel === 'Not verified yet' ? 'Not verified yet' : 'js/engine-directory.js'}</td></tr><tr><td>Power / torque / bore / stroke</td><td><span class="badge badge-warn">Not verified yet</span></td><td>Official specs not verified in current repository</td></tr></tbody></table></div><p class="note">${esc(specNote)}</p></article>
      <article class="engine-card"><h2>Engine-specific Inspection Checklist</h2><ul>${listItems(copy.inspection.map(esc))}</ul></article>
      <article class="engine-card"><h2>Common Matching Mistakes</h2><ul>${listItems(copy.mistakes.map(esc))}</ul></article>
      <article class="engine-card"><h2>Related Half Cuts</h2><p>Related records below are repository inventory signals for ${esc(record.code)}, not a live-stock promise. APSales should quote only after APInventory confirms availability, condition, and included parts.</p>${renderHalfCuts(record)}</article>
      <article class="engine-card"><h2>References</h2><div class="table-wrap"><table><thead><tr><th>Source</th><th>Type</th><th>Last update</th></tr></thead><tbody>${renderReferences(record)}</tbody></table></div></article>
    </div><aside>
      <section class="engine-card"><h2>China Supply Notes</h2><p>${esc(copy.chinaSupply)}</p></section>
      <section class="engine-card"><h2>Related Gearboxes</h2><ul>${listItems(copy.relatedGearboxes.map(esc))}</ul></section>
      <section class="engine-card"><h2>Export Notes</h2><p>${esc(copy.exportNotes)}</p><ul class="chip-row"><li>Tema</li><li>Lagos</li><li>Cotonou</li><li>Douala</li><li>Abidjan</li><li>Mombasa</li></ul></section>
      <section class="engine-card"><h2>Related Engines</h2>${linkList(relatedEngines)}</section>
      <section class="engine-card"><h2>AsiaPower Recommendation</h2><p>${esc(copy.recommendation)}</p></section>
    </aside></div></section>
    <section class="engine-section" id="inquiry"><div class="container"><div class="form-card"><h2>${esc(record.code)} Inquiry Form</h2><p>${esc(copy.cta)}</p><form data-form="contact-enquiry" novalidate><div class="form-status form-status--top" data-form-status role="status" aria-live="polite" hidden></div><input type="hidden" name="enquiry_type" value="engine"><input type="hidden" name="brand" value="${esc(brandText)}"><input type="hidden" name="model" value="${esc(record.code)}"><input type="hidden" name="product" value="${esc(record.code)} Engine"><input type="hidden" name="engine_code" value="${esc(record.code)}"><input type="hidden" name="vehicle_details" value="${esc(record.code)} engine or related half-cut enquiry"><div class="form-grid"><div><label for="name-${esc(record.slug)}">Full name *</label><input id="name-${esc(record.slug)}" name="name" required autocomplete="name"></div><div><label for="company-${esc(record.slug)}">Company</label><input id="company-${esc(record.slug)}" name="company" autocomplete="organization"></div><div><label for="phone-${esc(record.slug)}">WhatsApp number *</label><input id="phone-${esc(record.slug)}" type="tel" name="phone" required autocomplete="tel" data-phone-input></div><div><label for="email-${esc(record.slug)}">Email *</label><input id="email-${esc(record.slug)}" type="email" name="email" required autocomplete="email"></div><div><label for="country-${esc(record.slug)}">Destination country *</label><select id="country-${esc(record.slug)}" name="country" required><option value="">Select country</option><option>Ghana</option><option>Nigeria</option><option>Benin</option><option>Togo</option><option>Cameroon</option><option>Kenya</option><option>United Arab Emirates</option><option>Other</option></select></div><div><label for="port-${esc(record.slug)}">Destination port</label><input id="port-${esc(record.slug)}" name="port" placeholder="e.g. Tema, Lagos, Mombasa"></div><div class="full"><label for="msg-${esc(record.slug)}">Requirement</label><textarea id="msg-${esc(record.slug)}" name="message" placeholder="Tell us model, year, gearbox, destination port, and whether you need bare engine, complete engine, or half-cut."></textarea></div></div><div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"><label>Company website</label><input name="company_website" tabindex="-1" autocomplete="new-password"></div><p class="small">Submitting this form does not guarantee stock. AsiaPower confirms ${esc(record.code)} availability before quotation.</p><div class="actions"><button type="submit" class="btn btn-accent">Submit ${esc(record.code)} Enquiry</button><a class="btn btn-whatsapp" href="https://wa.me/233540911111?text=${waText}" target="_blank" rel="noopener noreferrer" data-wa-no-prompt>WhatsApp ${esc(record.code)}</a></div></form><div class="form-success form-success--email"><h4>Enquiry received</h4><p>AsiaPower will check ${esc(record.code)} inventory signals and supplier confirmation before reply.</p></div></div></div></section>
  </main>
  <div id="site-footer"></div><div id="site-whatsapp"></div>
  <script src="../js/path-utils.js?v=task-008"></script><script src="../js/phone-utils.js?v=2"></script><script src="../js/site-feedback.js?v=list-lead-modal-v1"></script><script src="../js/config.js?v=contact-20260625"></script><script src="../js/seo.js?v=p3-seo-v1"></script><script src="../js/components.js?v=auth-nav-once-v2" defer></script><script src="../js/main.js?v=task-008" defer></script>
</body>
</html>
`;
}

function buildSitemap(records) {
  let baseline;
  try {
    baseline = execFileSync('git', ['show', 'HEAD:sitemap.xml'], { cwd: ROOT, encoding: 'utf8' });
  } catch {
    baseline = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';
  }
  let xml = baseline;
  for (const record of records) {
    const loc = `${SITE_URL}/engines/${record.slug}.html`;
    const re = new RegExp(`\\n?\\s*<url>\\s*<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?</url>`, 'g');
    xml = xml.replace(re, '');
  }
  const entries = records.map(record => {
    const priority = record.inventoryCount >= 20 ? '0.85' : record.inventoryCount >= 5 ? '0.78' : '0.70';
    return `  <url>
    <loc>${SITE_URL}/engines/${record.slug}.html</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');
  xml = xml.replace(/\n<\/urlset>\s*$/, `\n  <!-- TASK-008 regenerated engine SEO pages -->\n${entries}\n</urlset>\n`);
  return xml;
}

function writeTaskReport(records) {
  const lines = records.map(record => `- \`engines/${record.slug}.html\` - ${record.code}: ${record.inventoryCount} inventory signals; generated differentiated buyer guide, questions, inspection, matching mistakes, supply notes, gearbox notes, export notes, recommendation, and CTA.`).join('\n');
  const strong = records.filter(r => r.inventoryCount >= 20).map(r => r.code).join(', ') || 'none';
  const report = `# TASK-008 - Engine Page Generator Upgrade

Date: ${TODAY}

## Generator Changes

- Added \`scripts/generate-engine-pages.mjs\` as a repeatable local Engine Page Generator.
- Generator reads Production-001 page list instead of hardcoding one engine page.
- Generator enriches each engine page from repository-local signals: engine directory, inventory files, transmissions, applications, related half-cuts, and task/growth sources.
- Generator now creates engine-specific sections:
  - Common Buyer Questions
  - Engine-specific Buying Guide
  - Engine-specific Inspection Checklist
  - Common Matching Mistakes
  - China Supply Notes
  - Related Half Cuts
  - Related Gearboxes
  - Export Notes
  - AsiaPower Recommendation
  - Engine-specific CTA
- Generator updates \`sitemap.xml\` with the regenerated 50 page URLs.

## Regenerated Pages

${lines}

## Differentiation Notes

- Brand families use different buying guidance: Toyota, Honda, Nissan, Hyundai/Kia, Mercedes-Benz, diesel, and general patterns.
- Pages with strong inventory signals receive inventory-first recommendations; sourcing-only pages receive demand-capture language.
- Related gearbox notes come from actual transmission signals where available.
- Related half-cut blocks use matching repository records where available and avoid claiming live stock.
- Strongest inventory-backed regenerated pages: ${strong}.

## Safety

- No official power, torque, bore, stroke, or service interval values are invented.
- Pages continue to say availability and price require confirmation.
- Supplier names, supplier phones, private notes, and full VINs are not exposed.
- No deployment, commit, external account login, social posting, or customer outreach was performed.
`;
  write('docs/cto/task-008.md', report);
}

function main() {
  const records = buildRecords();
  if (records.length !== 50) {
    throw new Error(`Expected 50 Production-001 records, got ${records.length}`);
  }
  for (const record of records) {
    write(`engines/${record.slug}.html`, renderPage(record));
  }
  write('sitemap.xml', buildSitemap(records));
  writeTaskReport(records);
  console.log(`[engine-pages] regenerated ${records.length} pages`);
}

main();
