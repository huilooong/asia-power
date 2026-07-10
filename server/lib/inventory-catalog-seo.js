'use strict';

const { seoTitle, canonicalUrl, displayTitle, listingTypeLabel } = require('./half-cut-seo');

const STATUS_RANK = { Available: 0, Reserved: 1, 'In Transit': 2 };

function activeItems(catalog) {
  return (catalog?.approved || []).filter((item) => item?.slug && item.status !== 'Sold');
}

function resolveDetailPath(item) {
  if (item?.vehicleCategory === 'truck') return '/trucks/detail.html';
  if (item?.vehicleCategory === 'machinery') return '/machinery/detail.html';
  return '/half-cuts/detail.html';
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const rankA = STATUS_RANK[a.status] ?? 9;
    const rankB = STATUS_RANK[b.status] ?? 9;
    if (rankA !== rankB) return rankA - rankB;
    const dateA = Date.parse(a.approvedAt || a.updatedAt || 0) || 0;
    const dateB = Date.parse(b.approvedAt || b.updatedAt || 0) || 0;
    return dateB - dateA;
  });
}

function slugify(value) {
  return String(value || 'other')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';
}

function listItemLabel(item) {
  return seoTitle(item).replace(/\s*\|\s*AsiaPower\s*$/, '').trim();
}

function variantLabel(item) {
  const parts = [item.brand, item.model].filter(Boolean);
  if (item.engineCode) parts.push(item.engineCode);
  if (item.transmissionCode) parts.push(item.transmissionCode);
  const type = listingTypeLabel(item);
  if (type && type !== 'Half Cut') parts.push(type);
  return parts.join(' — ').replace(/\s+/g, ' ').trim();
}

function aggregateByBrand(items) {
  const map = new Map();
  items.forEach((item) => {
    const brand = item.brand || 'Other';
    if (!map.has(brand)) {
      map.set(brand, { brand, items: [], variants: new Map() });
    }
    const entry = map.get(brand);
    entry.items.push(item);
    const variantKey = [
      item.model || '',
      item.engineCode || '',
      item.transmissionCode || '',
      item.truckPartType || '',
      item.machineryType || '',
    ].join('|');
    if (!entry.variants.has(variantKey)) {
      entry.variants.set(variantKey, item);
    }
  });
  return Array.from(map.values())
    .map((entry) => ({
      brand: entry.brand,
      items: sortItems(entry.items),
      variants: sortItems(Array.from(entry.variants.values())),
      count: entry.items.length,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildItemListElements(items, siteUrl, detailPathResolver = resolveDetailPath) {
  return items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: listItemLabel(item),
    url: canonicalUrl(siteUrl, item.slug, detailPathResolver(item)),
  }));
}

function topBrandNames(brands, limit = 12) {
  return brands.slice(0, limit).map((entry) => entry.brand).join(', ');
}

function summarizeBrandVariants(entry, limit = 6) {
  return entry.variants.slice(0, limit).map((item) => {
    const bits = [item.model, item.engineCode, item.transmissionCode].filter(Boolean);
    const type = listingTypeLabel(item);
    if (type && !['Half Cut', 'Truck Half Cut'].includes(type)) bits.push(type);
    return bits.join(' / ');
  }).join('; ');
}

function buildHalfCutDescription({ items, brands }) {
  const brandLine = topBrandNames(brands);
  const engineCount = new Set(items.map((item) => item.engineCode).filter(Boolean)).size;
  return `Live half-cut export inventory — ${items.length} listings across ${brands.length} brands (${brandLine}). `
    + `${engineCount} engine codes with matched transmissions. EXW China pricing, CIF worldwide.`;
}

function buildTruckDescription({ items, brands }) {
  const cabs = items.filter((item) => item.truckPartType === 'cab').length;
  const halfCuts = items.filter((item) => item.truckPartType === 'vehicle' || !item.truckPartType).length;
  const engines = items.filter((item) => item.truckPartType === 'engine').length;
  return `Truck export inventory — ${items.length} units across ${brands.length} brands (${topBrandNames(brands)}). `
    + `${cabs} driver cabs, ${halfCuts} half-cuts/powertrain sets${engines ? `, ${engines} engine units` : ''}. FOB/CIF from China.`;
}

function buildMachineryDescription({ items, brands }) {
  return `Construction machinery export catalog — ${items.length} live units (${topBrandNames(brands, 8)}). `
    + 'Wheel loaders, excavators and cranes with engine startup video on selected stock. FOB Tianjin / CIF your port.';
}

function buildEngineDirectoryDescription({ items, brands }) {
  const codes = new Set(items.map((item) => item.engineCode).filter(Boolean));
  return `Engine codes sourced from live half-cut and truck inventory — ${codes.size} engine variants across `
    + `${brands.length} brands (${topBrandNames(brands)}). Matched to vehicle model and export listing.`;
}

function buildGearboxDirectoryDescription({ items, brands }) {
  const codes = new Set(items.map((item) => item.transmissionCode).filter(Boolean));
  return `Gearbox and transmission codes from live export inventory — ${codes.size} transmission variants across `
    + `${brands.length} brands (${topBrandNames(brands)}). Auto, CVT and manual units from verified half-cut stock.`;
}

function buildFaqPage({ pageUrl, catalogKey, items, brands }) {
  const questions = [];

  if (catalogKey === 'halfcuts') {
    questions.push(
      {
        q: 'Which half-cut brands are currently in stock?',
        a: `AsiaPower currently lists ${items.length} half-cut units across ${brands.length} brands including ${topBrandNames(brands, 15)}. Inventory updates daily from our China export network.`,
      },
      {
        q: 'What engine and transmission combinations are available?',
        a: brands.slice(0, 8).map((entry) => `${entry.brand}: ${summarizeBrandVariants(entry)}`).join(' '),
      },
      {
        q: 'Do you export half-cuts to Africa and Southeast Asia?',
        a: 'Yes. We ship to Ghana, Nigeria, Kenya, Tanzania, Mozambique and Southeast Asian ports. EXW Zhengzhou and CIF destination port pricing available on enquiry.',
      }
    );
  } else if (catalogKey === 'trucks') {
    const cabBrands = brands.filter((entry) => entry.items.some((item) => item.truckPartType === 'cab'));
    questions.push(
      {
        q: 'What truck brands and part types do you stock?',
        a: `${items.length} truck listings across ${brands.length} brands (${topBrandNames(brands, 12)}). `
          + `Includes driver cabs (${cabBrands.map((b) => b.brand).slice(0, 8).join(', ')}), half-cuts and engine sets.`,
      },
      {
        q: 'What is the difference between a truck driver cab and a truck half-cut?',
        a: 'A driver cab is the front cab assembly. A truck half-cut includes cab with engine, transmission and front chassis components. Both are available from our live inventory with EXW export pricing.',
      },
      {
        q: 'Which truck engine codes are listed?',
        a: brands.slice(0, 10).map((entry) => {
          const engines = [...new Set(entry.items.map((item) => item.engineCode).filter(Boolean))].slice(0, 5);
          return `${entry.brand}: ${engines.join(', ')}`;
        }).join('; '),
      }
    );
  } else if (catalogKey === 'machinery') {
    questions.push(
      {
        q: 'What construction machinery is available for export?',
        a: brands.map((entry) => `${entry.brand} ${summarizeBrandVariants(entry, 4)}`).join('; '),
      },
      {
        q: 'Do machinery units include engine startup video?',
        a: 'Selected stock includes whole-vehicle startup video before dismantling. Request video and inspection report on enquiry for any listed unit.',
      }
    );
  } else if (catalogKey === 'engines') {
    questions.push(
      {
        q: 'Which engine codes are available from current inventory?',
        a: brands.slice(0, 12).map((entry) => {
          const codes = [...new Set(entry.items.map((item) => item.engineCode).filter(Boolean))].slice(0, 8);
          return `${entry.brand}: ${codes.join(', ')}`;
        }).join('; '),
      },
      {
        q: 'Are engines sold separately or with half-cuts?',
        a: 'Both. Engine codes listed here are matched to live half-cut and truck listings. Individual engine sets can be dismantled from stock on confirmation.',
      }
    );
  } else if (catalogKey === 'gearboxes') {
    questions.push(
      {
        q: 'Which transmission codes are in current export stock?',
        a: brands.slice(0, 12).map((entry) => {
          const codes = [...new Set(entry.items.map((item) => item.transmissionCode).filter(Boolean))].slice(0, 8);
          return `${entry.brand}: ${codes.join(', ')}`;
        }).join('; '),
      },
      {
        q: 'Can gearboxes be matched to a specific engine code?',
        a: 'Yes. Transmission codes in this directory are sourced from the same vehicles as listed engine codes — specify chassis, engine or stock ID for a matched set.',
      }
    );
  }

  if (!questions.length) return null;

  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: questions.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.a,
      },
    })),
  };
}

function buildCatalogSeoGraph({ items, siteUrl, catalogKey, config }) {
  const base = String(siteUrl || 'https://asia-power.com').replace(/\/$/, '');
  const pageUrl = `${base}${config.path}`;
  const brands = aggregateByBrand(items);
  const graph = [];

  graph.push({
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: config.pageTitle,
    description: config.buildDescription({ items, brands }),
    mainEntity: { '@id': `${pageUrl}#inventory-list` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name: config.breadcrumbLabel, item: pageUrl },
      ],
    },
  });

  const listItems = config.mode === 'engine-variants' || config.mode === 'transmission-variants'
    ? brands.flatMap((entry) => entry.variants.map((item) => item))
    : items;

  graph.push({
    '@type': 'ItemList',
    '@id': `${pageUrl}#inventory-list`,
    name: config.listTitle,
    numberOfItems: listItems.length,
    itemListElement: buildItemListElements(
      listItems,
      siteUrl,
      config.mode === 'engine-variants' || config.mode === 'transmission-variants'
        ? resolveDetailPath
        : () => config.detailPath || '/half-cuts/detail.html'
    ),
  });

  brands.forEach((entry) => {
    const brandItems = config.mode === 'engine-variants' || config.mode === 'transmission-variants'
      ? entry.variants
      : entry.items;
    graph.push({
      '@type': 'ItemList',
      '@id': `${pageUrl}#brand-${slugify(entry.brand)}`,
      name: `${entry.brand} ${config.brandListSuffix}`,
      numberOfItems: brandItems.length,
      itemListElement: buildItemListElements(
        brandItems,
        siteUrl,
        config.mode === 'engine-variants' || config.mode === 'transmission-variants'
          ? resolveDetailPath
          : () => config.detailPath || '/half-cuts/detail.html'
      ),
    });
  });

  const faq = buildFaqPage({ pageUrl, catalogKey, items, brands });
  if (faq) graph.push(faq);

  return { '@context': 'https://schema.org', '@graph': graph };
}

const CATALOG_CONFIGS = {
  halfcuts: {
    path: '/half-cuts/',
    template: 'half-cuts/index.html',
    detailPath: '/half-cuts/detail.html',
    filter: (item) => (item.vehicleCategory || 'passenger') === 'passenger',
    pageTitle: 'Half-Cut Inventory by Brand | AsiaPower',
    listTitle: 'AsiaPower Half-Cut Inventory',
    brandListSuffix: 'Half-Cut Inventory',
    breadcrumbLabel: 'Half-Cuts',
    buildDescription: buildHalfCutDescription,
  },
  trucks: {
    path: '/trucks/',
    template: 'trucks/index.html',
    detailPath: '/trucks/detail.html',
    filter: (item) => item.vehicleCategory === 'truck',
    pageTitle: 'Truck Inventory by Brand | AsiaPower',
    listTitle: 'AsiaPower Truck Inventory',
    brandListSuffix: 'Truck Inventory',
    breadcrumbLabel: 'Trucks',
    buildDescription: buildTruckDescription,
  },
  machinery: {
    path: '/machinery/',
    template: 'machinery/index.html',
    detailPath: '/machinery/detail.html',
    filter: (item) => item.vehicleCategory === 'machinery',
    pageTitle: 'Construction Machinery Inventory | AsiaPower',
    listTitle: 'AsiaPower Machinery Inventory',
    brandListSuffix: 'Machinery Inventory',
    breadcrumbLabel: 'Machinery',
    buildDescription: buildMachineryDescription,
  },
  engines: {
    path: '/engines/',
    template: 'engines/index.html',
    filter: (item) => !!item.engineCode,
    mode: 'engine-variants',
    pageTitle: 'Engine Inventory by Brand | AsiaPower',
    listTitle: 'AsiaPower Engine Code Directory',
    brandListSuffix: 'Engine Variants',
    breadcrumbLabel: 'Engines',
    buildDescription: buildEngineDirectoryDescription,
  },
  gearboxes: {
    path: '/gearboxes/',
    template: 'gearboxes/index.html',
    filter: (item) => !!item.transmissionCode,
    mode: 'transmission-variants',
    pageTitle: 'Gearbox Inventory by Brand | AsiaPower',
    listTitle: 'AsiaPower Transmission Code Directory',
    brandListSuffix: 'Transmission Variants',
    breadcrumbLabel: 'Gearboxes',
    buildDescription: buildGearboxDirectoryDescription,
  },
};

function selectCatalogItems(catalog, catalogKey) {
  const config = CATALOG_CONFIGS[catalogKey];
  if (!config) return [];
  return sortItems(activeItems(catalog).filter(config.filter));
}

function buildCatalogJsonLd(catalog, siteUrl, catalogKey) {
  const config = CATALOG_CONFIGS[catalogKey];
  if (!config) return null;
  const items = selectCatalogItems(catalog, catalogKey);
  return buildCatalogSeoGraph({ items, siteUrl, catalogKey, config });
}

module.exports = {
  CATALOG_CONFIGS,
  activeItems,
  selectCatalogItems,
  buildCatalogJsonLd,
  aggregateByBrand,
  resolveDetailPath,
  variantLabel,
  displayTitle,
};
