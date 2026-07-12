/**
 * AsiaPower — eBay-style catalog hub (all sidebar categories)
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q') || '';
  if (window.SitePaths?.isSupplierUploadSearch?.(qParam)) {
    window.location.replace(window.SitePaths.supplierPortalHref());
    return;
  }

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function base() {
    return window.SitePaths?.base?.() || '../';
  }

  const TRANSMISSIONS = [
    { id: 'all', labelKey: 'filter.transmission', label: 'Transmission' },
    { id: 'automatic', labelKey: 'filter.automatic', label: 'Automatic' },
    { id: 'manual', labelKey: 'filter.manual', label: 'Manual' },
  ];

  const BODY_TYPES = [
    { id: 'all', labelKey: 'filter.allBodyTypes', label: 'All body types' },
    { id: 'sedan', labelKey: 'filter.sedan', label: 'Sedan', match: /sedan|camry|accord|corolla|elantra|altima|civic|malibu/i },
    { id: 'suv', labelKey: 'filter.suv', label: 'SUV', match: /suv|tucson|sportage|cr-v|rav4|x-trail|prado|fortuner|pajero|rx350|glc|x5/i },
    { id: 'pickup', labelKey: 'filter.pickup', label: 'Pickup', match: /pickup|hilux|navara|triton|ranger/i },
    { id: 'van', labelKey: 'filter.van', label: 'Van', match: /van|hiace|carnival|express/i },
  ];

  const STATUS_OPTIONS = [
    { id: 'all', labelKey: 'filter.availability', label: 'Availability' },
    { id: 'available', labelKey: 'hc.available', label: 'Available' },
    { id: 'reserved', labelKey: 'hc.reserved', label: 'Reserved' },
    { id: 'in-transit', labelKey: 'hc.inTransit', label: 'In Transit' },
    { id: 'sold', labelKey: 'hc.sold', label: 'Sold' },
  ];

  const TRUCK_LISTING_TYPES = [
    { id: 'all', labelKey: 'filter.listingType', label: 'Listing type' },
    { id: 'halfcut', labelKey: 'filter.truckHalfCut', label: 'Truck half-cut' },
    { id: 'cab', labelKey: 'filter.driverCab', label: 'Driver cab' },
  ];

  const TRUCK_SUBMODULES = [
    { id: 'all', labelKey: 'trucks.submoduleAll', label: 'All' },
    { id: 'whole', labelKey: 'trucks.submoduleWhole', label: 'Whole vehicle' },
    { id: 'engine', labelKey: 'trucks.submoduleEngine', label: 'Engine' },
    { id: 'axle', labelKey: 'trucks.submoduleAxle', label: 'Axle' },
    { id: 'head', labelKey: 'trucks.submoduleHead', label: 'Truck head' },
  ];

  const TRUCK_ENGINE_PART_RE = /\b(engine only|engine assembly|complete engine|裸发|裸机|发动机总成|发动机)\b/i;
  const TRUCK_AXLE_PART_RE = /\b(axle|axles|drive axle|rear axle|front axle|axle assembly|车轴|驱动桥|前桥|后桥)\b/i;

  const MACHINERY_TYPES = [
    { id: 'all', labelKey: 'filter.equipmentType', label: 'Equipment type' },
    { id: 'excavator', labelKey: 'filter.excavator', label: 'Excavator', match: /excavator|挖掘机/i },
    { id: 'loader', labelKey: 'filter.loader', label: 'Loader', match: /loader|装载机/i },
    { id: 'crane', labelKey: 'filter.crane', label: 'Crane', match: /crane|起重/i },
    { id: 'roller', labelKey: 'filter.roller', label: 'Roller', match: /roller|压路/i },
  ];

  const PRICE_RANGES = [
    { id: 'all', labelKey: 'filter.price', label: 'Price', min: null, max: null },
    { id: 'under-1000', labelKey: 'filter.priceUnder1000', label: 'Under $1,000', min: null, max: 999 },
    { id: '1000-5000', labelKey: 'filter.price1000to5000', label: '$1,000 – $5,000', min: 1000, max: 5000 },
    { id: '5000-10000', labelKey: 'filter.price5000to10000', label: '$5,000 – $10,000', min: 5000, max: 10000 },
    { id: '10000-20000', labelKey: 'filter.price10000to20000', label: '$10,000 – $20,000', min: 10000, max: 20000 },
    { id: '20000+', labelKey: 'filter.price20000plus', label: '$20,000+', min: 20000, max: null },
  ];

  const PRIORITY_MAKE_SLUGS = [
    'toyota', 'honda', 'nissan', 'hyundai', 'kia', 'ford', 'chevrolet',
    'volkswagen', 'bmw', 'mercedes-benz', 'byd', 'lexus', 'mazda', 'mitsubishi',
  ];

  const SORT_OPTIONS = {
    inventory: [
      { id: 'best', labelKey: 'filter.bestMatch', label: 'Best Match' },
      { id: 'year-desc', labelKey: 'filter.yearNewest', label: 'Year: newest first' },
      { id: 'listed-desc', labelKey: 'filter.listedNewest', label: 'Listed: newest first' },
      { id: 'price-asc', labelKey: 'filter.priceLowest', label: 'Price: lowest first' },
    ],
    usedCars: [
      { id: 'best', labelKey: 'filter.bestMatch', label: 'Best Match' },
      { id: 'year-desc', labelKey: 'filter.yearNewest', label: 'Year: newest first' },
      { id: 'price-asc', labelKey: 'filter.priceLowest', label: 'Price: lowest first' },
    ],
  };

  const FILTER_LABELS = {
    year: { key: 'filter.year', label: 'Year' },
    brand: { key: 'filter.make', label: 'Make' },
    price: { key: 'filter.price', label: 'Price' },
    trans: { key: 'filter.transmission', label: 'Transmission' },
    body: { key: 'filter.bodyType', label: 'Body type' },
    status: { key: 'filter.availability', label: 'Availability' },
    listing: { key: 'filter.listingType', label: 'Listing type' },
    equip: { key: 'filter.equipmentType', label: 'Equipment type' },
  };

  function localizeOption(option) {
    if (!option) return option;
    if (option.labelKey) return { ...option, label: t(option.labelKey, option.label) };
    return option;
  }

  function localizeOptions(options) {
    return (options || []).map(localizeOption);
  }

  function filterLabel(key) {
    const meta = FILTER_LABELS[key];
    return meta ? t(meta.key, meta.label) : key;
  }

  const CATEGORY_META = {
    'used-cars': {
      titleKey: 'ebay.catUsedCars',
      title: 'Export Used Cars',
      unit: 'results',
      brandSegment: 'passenger',
      cardMode: 'vehicle',
      defaultStatus: 'all',
      sorts: SORT_OPTIONS.usedCars,
    },
    halfcuts: {
      titleKey: 'ebay.catHalfCuts',
      subtitleKey: 'ebay.catHalfCutsSubtitle',
      title: 'Half-Cuts',
      unit: 'results',
      brandSegment: 'passenger',
      cardMode: 'halfcut',
      defaultStatus: 'available',
      sorts: SORT_OPTIONS.inventory,
    },
    trucks: {
      titleKey: 'ebay.catTrucks',
      title: 'Trucks',
      unit: 'results',
      brandSegment: 'truck',
      cardMode: 'halfcut',
      defaultStatus: 'available',
      sorts: SORT_OPTIONS.inventory,
    },
    machinery: {
      titleKey: 'ebay.catMachinery',
      title: 'Construction Machinery',
      unit: 'results',
      brandSegment: 'machinery',
      cardMode: 'halfcut',
      defaultStatus: 'available',
      sorts: SORT_OPTIONS.inventory,
    },
  };

  const PARTS_PAGES = {
    engines: { labelKey: 'catalog.engines', label: 'Engines', href: 'engines/', typeLabelKey: 'filter.fuelType', typeLabel: 'Fuel type' },
    gearboxes: { labelKey: 'catalog.gearboxes', label: 'Gearboxes', href: 'gearboxes/', typeLabelKey: 'filter.transmissionType', typeLabel: 'Transmission type' },
    chassis: { labelKey: 'catalog.chassis', label: 'Chassis parts', href: 'chassis-parts/', typeLabelKey: 'filter.partType', typeLabel: 'Part type' },
    frontcuts: { labelKey: 'parts.submoduleFrontCut', label: 'Front cut', href: 'front-cuts/', typeLabelKey: 'filter.partType', typeLabel: 'Part type' },
  };

  const ENGINE_FUEL_FILTERS = [
    { id: 'all', labelKey: 'filter.fuelType', label: 'Fuel type' },
    { id: 'petrol', labelKey: 'engines.petrol', label: 'Petrol' },
    { id: 'diesel', labelKey: 'engines.diesel', label: 'Diesel' },
    { id: 'hybrid', labelKey: 'engines.hybrid', label: 'Hybrid' },
  ];

  function modelSlug(model) {
    return String(model || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function modelsFromInventory(items, brandSlug) {
    const map = new Map();
    (items || []).forEach((item) => {
      if (brandSlug && item.brandSlug !== brandSlug) return;
      const name = String(item.model || '').trim();
      if (!name) return;
      const slug = modelSlug(name);
      if (!slug) return;
      const existing = map.get(slug);
      if (existing) existing.count += 1;
      else map.set(slug, { slug, name, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  function syncSidebarModels(category, state, allItems) {
    const brand = state.brand;
    document.querySelectorAll('[data-ebay-sidebar-models]').forEach((wrap) => {
      const listEl = wrap.querySelector('[data-ebay-model-list]');
      const titleEl = wrap.querySelector('[data-ebay-sidebar-models-title]');
      if (!brand || !listEl) {
        wrap.hidden = true;
        return;
      }

      const meta = CATEGORY_META[category] || CATEGORY_META.halfcuts;
      const brandSegment = window.HalfCutUtils?.brandSegmentForCategory?.(category) || meta.brandSegment;
      const brands = window.getHalfCutBrands?.(brandSegment) || [];
      const brandInfo = brands.find((b) => b.slug === brand);
      const brandName = brandInfo?.name || brand;
      const models = modelsFromInventory(allItems, brand);

      if (!models.length) {
        wrap.hidden = true;
        return;
      }

      wrap.hidden = false;
      if (titleEl) {
        titleEl.textContent = `${brandName} · ${t('ebay.modelsInStock', 'Models in stock')}`;
      }

      const params = stateToParams(state);
      const allModelsUrl = halfCutHubUrl(category, { ...params, brand, model: '' });
      let html = `<li><a href="${allModelsUrl}" class="ebay-sidebar__fo${!state.model ? ' is-active' : ''}"><span class="ebay-sidebar__fo-box" aria-hidden="true"></span><span class="ebay-sidebar__fo-n">${t('ebay.allModels', 'All models')}</span></a></li>`;
      html += models.map((m) => {
        const url = halfCutHubUrl(category, { ...params, brand, model: m.slug });
        const active = state.model === m.slug ? ' is-active' : '';
        return `<li><a href="${url}" class="ebay-sidebar__fo${active}"><span class="ebay-sidebar__fo-box" aria-hidden="true"></span><span class="ebay-sidebar__fo-n">${escapeHtml(m.name)}</span><span class="ebay-sidebar__fo-c">${m.count}</span></a></li>`;
      }).join('');
      listEl.innerHTML = html;
    });
  }

  function syncSidebarBrands(category, state, allItems) {
    const counts = brandCounts(allItems);
    const meta = CATEGORY_META[category] || CATEGORY_META.halfcuts;
    const brandSegment = window.HalfCutUtils?.brandSegmentForCategory?.(category) || meta.brandSegment;
    const brands = window.getHalfCutBrands?.(brandSegment) || [];
    const top = brands
      .map((b) => ({ ...b, count: counts[b.slug] || 0 }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);

    document.querySelectorAll('[data-ebay-sidebar-brands]').forEach((wrap) => {
      const listEl = wrap.querySelector('[data-ebay-brand-list]');
      if (!listEl || !top.length) {
        wrap.hidden = true;
        return;
      }
      wrap.hidden = false;
      const params = stateToParams(state);
      listEl.innerHTML = top.map((b) => {
        const url = halfCutHubUrl(category, { ...params, brand: b.slug, model: '' });
        const active = state.brand === b.slug ? ' is-active' : '';
        return `<li><a href="${url}" class="ebay-sidebar__fo${active}"><span class="ebay-sidebar__fo-box" aria-hidden="true"></span><span class="ebay-sidebar__fo-n">${escapeHtml(b.name)}</span><span class="ebay-sidebar__fo-c">${b.count}</span></a></li>`;
      }).join('');
    });
  }

  function categoryHubBase(category) {
    if (category === 'trucks') return `${base()}trucks/`;
    if (category === 'machinery') return `${base()}machinery/`;
    if (category && category !== 'halfcuts') return `${base()}half-cuts/?cat=${encodeURIComponent(category)}`;
    return `${base()}half-cuts/`;
  }

  function halfCutHubUrl(category, params) {
    const p = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    const qs = p.toString();
    const hubBase = categoryHubBase(category);
    if (!qs) return hubBase;
    const sep = hubBase.includes('?') ? '&' : '?';
    return `${hubBase}${sep}${qs}`;
  }

  function truckListingToPart(listing) {
    if (listing === 'halfcut') return 'whole';
    if (listing === 'cab') return 'head';
    return 'all';
  }

  function resolveTruckPartMeta(item) {
    if (window.HalfCutUploadLayer?.resolveListingMeta) {
      return window.HalfCutUploadLayer.resolveListingMeta(item);
    }
    return {
      truckPartType: item?.truckPartType || '',
      vehicleCondition: item?.vehicleCondition || '',
    };
  }

  function truckPartSearchText(item) {
    return [
      item?.title,
      item?.vehicleCondition,
      item?.shortDescription,
      item?.model,
      item?.engineCode,
    ].join(' ');
  }

  function matchesTruckPart(item, part) {
    if (!part || part === 'all') return true;
    const meta = resolveTruckPartMeta(item);
    const truckPartType = String(meta.truckPartType || item?.truckPartType || '').trim();
    const text = truckPartSearchText(item);

    if (part === 'whole') return truckPartType === 'vehicle';
    if (part === 'head') return truckPartType === 'cab';
    if (part === 'engine') {
      if (truckPartType === 'engine') return true;
      return TRUCK_ENGINE_PART_RE.test(text) && truckPartType !== 'vehicle' && truckPartType !== 'cab';
    }
    if (part === 'axle') {
      if (truckPartType === 'axle') return true;
      return TRUCK_AXLE_PART_RE.test(text);
    }
    return false;
  }

  function countTruckSubmodules(items) {
    const counts = { all: items.length, whole: 0, engine: 0, axle: 0, head: 0 };
    (items || []).forEach((item) => {
      TRUCK_SUBMODULES.forEach((sub) => {
        if (sub.id !== 'all' && matchesTruckPart(item, sub.id)) counts[sub.id] += 1;
      });
    });
    return counts;
  }

  function brandCounts(items) {
    const counts = {};
    items.forEach((item) => {
      const slug = item.brandSlug || String(item.brand || '').toLowerCase().replace(/\s+/g, '-');
      counts[slug] = (counts[slug] || 0) + 1;
    });
    return counts;
  }

  function matchesTransmission(item, trans) {
    if (!trans || trans === 'all') return true;
    const code = String(item.transmissionCode || item.transmission || '').toLowerCase();
    const title = String(item.title || '').toLowerCase();
    if (trans === 'automatic') return /auto|at|cvt|dct|8at|6at|9at/i.test(code + title);
    if (trans === 'manual') return /manual|mt|6mt|5mt/i.test(code + title);
    return true;
  }

  function matchesBodyType(item, bodyId) {
    if (!bodyId || bodyId === 'all') return true;
    const type = BODY_TYPES.find((b) => b.id === bodyId);
    if (!type?.match) return true;
    return type.match.test(`${item.title || ''} ${item.model || ''}`);
  }

  function matchesTruckListing(item, listing) {
    if (!listing || listing === 'all') return true;
    const part = truckListingToPart(listing);
    if (part !== 'all') return matchesTruckPart(item, part);
    return true;
  }

  function matchesMachineryType(item, equip) {
    if (!equip || equip === 'all') return true;
    const type = MACHINERY_TYPES.find((e) => e.id === equip);
    if (!type?.match) return true;
    return type.match.test(`${item.title || ''} ${item.model || ''}`);
  }

  function matchesStatus(item, status) {
    if (!status || status === 'all') return true;
    const slug = window.HalfCutUtils?.statusSlug?.(item.status) || String(item.status || '').toLowerCase();
    return slug === status;
  }

  function matchesYear(item, year) {
    if (!year || year === 'all') return true;
    const y = Number(item.year);
    if (!Number.isFinite(y)) return false;
    return String(y) === String(year);
  }

  function matchesPriceRange(item, priceId) {
    if (!priceId || priceId === 'all') return true;
    const range = PRICE_RANGES.find((r) => r.id === priceId);
    if (!range) return true;
    const amount = window.HalfCutUtils?.parsePriceUsd?.(item);
    if (amount == null) return false;
    if (range.min != null && amount < range.min) return false;
    if (range.max != null && amount > range.max) return false;
    return true;
  }

  function matchesEnginePartPriceRange(item, priceId, partType) {
    if (!priceId || priceId === 'all') return true;
    const range = PRICE_RANGES.find((r) => r.id === priceId);
    if (!range) return true;
    const u = window.HalfCutUtils;
    let amount = u?.catalogPartPriceAmount?.(item, partType);
    if (amount == null) {
      const ratio = u?.PART_PRICE_RATIOS?.[partType] ?? 1;
      const whole = u?.parsePriceUsd?.(item);
      if (whole == null) return false;
      amount = Math.round(whole * ratio);
    }
    if (range.min != null && amount < range.min) return false;
    if (range.max != null && amount > range.max) return false;
    return true;
  }

  function matchesEngineFuel(item, fuelId) {
    if (!fuelId || fuelId === 'all') return true;
    const fuel = window.HalfCutUtils?.resolveEngineFuelType?.(item) || '';
    if (!fuel) return false;
    const needle = String(fuelId).toLowerCase();
    return fuel === needle || fuel.includes(needle);
  }

  function engineFuelOptionsFromItems(items) {
    const fuels = new Set();
    (items || []).forEach((item) => {
      const fuel = window.HalfCutUtils?.resolveEngineFuelType?.(item);
      if (!fuel) return;
      if (fuel.includes('diesel')) fuels.add('diesel');
      else if (fuel.includes('hybrid')) fuels.add('hybrid');
      else if (fuel.includes('petrol') || fuel.includes('gasoline')) fuels.add('petrol');
    });
    const base = [{ id: 'all', labelKey: 'filter.fuelType', label: 'Fuel type' }];
    const dynamic = ENGINE_FUEL_FILTERS.filter((opt) => opt.id !== 'all' && fuels.has(opt.id));
    return localizeOptions(dynamic.length ? [...base, ...dynamic] : base);
  }

  function renderInventoryMakeFilterSelect(state, brands, items) {
    const counts = brandCounts(items || []);
    const makeOptions = buildMakeOptionsLocalized(brands, counts);
    const options = makeOptions.map((o) => {
      const val = o.id ?? '';
      const selected = String(state.brand || '') === String(val) ? ' selected' : '';
      return `<option value="${val}"${selected}>${o.label}</option>`;
    }).join('');
    return `<label class="ebay-cars-filter${state.brand ? ' is-active' : ''}">
      <select data-parts-filter="brand" aria-label="${t('filter.make', 'Make')}">${options}</select>
    </label>`;
  }

  function yearOptionsFromItems(items) {
    const years = new Set();
    (items || []).forEach((item) => {
      const y = Number(item.year);
      if (Number.isFinite(y) && y >= 1980 && y <= new Date().getFullYear() + 1) years.add(y);
    });
    return [
      { id: 'all', labelKey: 'filter.year', label: 'Year' },
      ...Array.from(years).sort((a, b) => b - a).map((y) => ({ id: String(y), label: String(y) })),
    ];
  }

  function yearOptionsFromItemsLocalized(items) {
    return localizeOptions(yearOptionsFromItems(items));
  }

  function buildMakeOptions(brands, counts) {
    const bySlug = new Map((brands || []).map((b) => [b.slug, b]));
    const inStock = (slug) => (counts[slug] || 0) > 0;
    const priority = [
      ...PRIORITY_MAKE_SLUGS,
      ...(window.ASIAPOWER?.featuredBrandSlugs || []),
    ];
    const ordered = [];
    const seen = new Set();

    priority.forEach((slug) => {
      const brand = bySlug.get(slug);
      if (brand && !seen.has(slug) && inStock(slug)) {
        ordered.push(brand);
        seen.add(slug);
      }
    });

    (brands || [])
      .filter((b) => !seen.has(b.slug) && inStock(b.slug))
      .sort((a, b) => {
        const ca = counts[a.slug] || 0;
        const cb = counts[b.slug] || 0;
        if (cb !== ca) return cb - ca;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      })
      .forEach((b) => ordered.push(b));

    return [
      { id: '', labelKey: 'filter.make', label: 'Make' },
      ...ordered.map((b) => ({
        id: b.slug,
        label: `${b.name} (${counts[b.slug]})`,
      })),
    ];
  }

  function buildMakeOptionsLocalized(brands, counts) {
    return localizeOptions(buildMakeOptions(brands, counts));
  }

  function matchesSearch(item, query) {
    if (!query) return true;
    const u = window.HalfCutUtils;
    // catalog-search-v1 / stock-id-search-v1: unified field + alias matcher
    if (u?.matchesCatalogSearch) return u.matchesCatalogSearch(item, query);
    if (u?.isStockIdQuery?.(query) && u?.matchesStockId?.(item, query)) return true;
    const q = query.toLowerCase().trim();
    const qn = q.replace(/[\s-/]/g, '');
    const hay = [item.stockId, item.brand, item.model, item.engineCode, item.transmissionCode, item.title].join(' ').toLowerCase();
    if (hay.includes(q)) return true;
    return hay.replace(/[\s-/]/g, '').includes(qn);
  }

  function listingTimestamp(item) {
    const ts = Date.parse(item?.listedAt || item?.approvedAt || item?.updatedAt || 0);
    return Number.isFinite(ts) && ts > 0 ? ts : 0;
  }

  function sortItems(items, sort, trendingQueries) {
    const list = items.slice();
    if (sort === 'year-desc') {
      return list.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    }
    if (sort === 'listed-desc') {
      return list.sort((a, b) => {
        const diff = listingTimestamp(b) - listingTimestamp(a);
        if (diff !== 0) return diff;
        return String(b?.stockId || '').localeCompare(String(a?.stockId || ''), undefined, { numeric: true });
      });
    }
    if (sort === 'price-asc') {
      return list.sort((a, b) => {
        const pa = window.HalfCutUtils?.parsePriceUsd?.(a) ?? Infinity;
        const pb = window.HalfCutUtils?.parsePriceUsd?.(b) ?? Infinity;
        return pa - pb;
      });
    }
    const cmp = window.HalfCutUtils?.compareListingHeat;
    if (cmp) {
      return list.sort((a, b) => cmp(a, b, trendingQueries || catalogTrending));
    }
    return list;
  }

  let catalogTrending = [];
  let catalogTrendingPromise = null;

  function ensureCatalogTrending() {
    if (catalogTrendingPromise) return catalogTrendingPromise;
    catalogTrendingPromise = (async () => {
      try {
        if (window.AsiaPowerSearchTrends?.refreshQueries) {
          catalogTrending = await window.AsiaPowerSearchTrends.refreshQueries();
          return catalogTrending;
        }
        const res = await fetch('/api/search/trending?limit=30', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          catalogTrending = (data.queries || []).map((row) => row.q).filter(Boolean);
        }
      } catch {
        // keep cache empty
      }
      return catalogTrending;
    })();
    return catalogTrendingPromise;
  }

  function getInventory(category, query) {
    return window.inventoryForCatalogCategory
      ? window.inventoryForCatalogCategory(category)
      : [];
  }

  function readHalfCutState(category, route) {
    const meta = CATEGORY_META[category] || CATEGORY_META.halfcuts;
    const params = new URLSearchParams(window.location.search);
    const listing = params.get('listing') || 'all';
    const partParam = params.get('part');
    const part = category === 'trucks'
      ? (partParam || truckListingToPart(listing) || 'all')
      : 'all';
    return {
      category,
      year: params.get('year') || 'all',
      price: params.get('price') || 'all',
      brand: params.get('brand') || route?.brand || '',
      model: params.get('model') || '',
      body: params.get('body') || 'all',
      trans: params.get('trans') || 'all',
      status: params.get('status') || meta.defaultStatus,
      listing,
      part,
      equip: params.get('equip') || 'all',
      sort: params.get('sort') || 'best',
      q: route?.searchQuery || params.get('q') || '',
    };
  }

  function stateToParams(state) {
    const meta = CATEGORY_META[state.category] || {};
    const params = {
      year: state.year === 'all' ? '' : state.year,
      price: state.price === 'all' ? '' : state.price,
      brand: state.brand,
      model: state.model,
      body: state.body === 'all' ? '' : state.body,
      trans: state.trans === 'all' ? '' : state.trans,
      status: (state.status === meta.defaultStatus || state.status === 'all') ? '' : state.status,
      equip: state.equip === 'all' ? '' : state.equip,
      sort: state.sort === 'best' ? '' : state.sort,
      q: state.q,
    };
    if (state.category === 'trucks') {
      params.part = state.part === 'all' ? '' : state.part;
    } else {
      params.listing = state.listing === 'all' ? '' : state.listing;
    }
    return params;
  }

  function filterInventory(items, state) {
    const u = window.HalfCutUtils;
    const q = String(state.q || '').trim();
    const stockQuery = u?.isStockIdQuery?.(q) ? q : '';
    const crossHit = q && !stockQuery && u?.matchesCatalogSearch
      ? (item) => u.matchesCatalogSearch(item, q)
      : null;
    let list = items.filter((item) => {
      // stock-id-search-v1: stock ID hit bypasses category side-filters (brand/year/price…)
      if (stockQuery && u.matchesStockId(item, stockQuery)) {
        return matchesStatus(item, state.status);
      }
      // catalog-search-v1: cross-category text hits only need status (same as stock ID)
      if (crossHit?.(item)) {
        return matchesStatus(item, state.status);
      }
      if (!matchesYear(item, state.year)) return false;
      if (!matchesPriceRange(item, state.price)) return false;
      if (state.brand && item.brandSlug !== state.brand) return false;
      if (state.model && modelSlug(item.model) !== state.model) return false;
      if (!matchesBodyType(item, state.body)) return false;
      if (!matchesTransmission(item, state.trans)) return false;
      if (!matchesStatus(item, state.status)) return false;
      if (state.category === 'trucks') {
        if (!matchesTruckPart(item, state.part)) return false;
      } else if (!matchesTruckListing(item, state.listing)) return false;
      if (!matchesMachineryType(item, state.equip)) return false;
      if (!matchesSearch(item, state.q)) return false;
      return true;
    });
    return sortItems(list, state.sort);
  }

  function filtersForCategory(category, brands, counts, state, items) {
    const makeOptions = buildMakeOptionsLocalized(brands, counts);
    const yearOptions = yearOptionsFromItemsLocalized(items);
    const priceOptions = localizeOptions(PRICE_RANGES);
    const transOptions = localizeOptions(TRANSMISSIONS);
    const bodyOptions = localizeOptions(BODY_TYPES);
    const statusOptions = localizeOptions(STATUS_OPTIONS);
    const listingOptions = localizeOptions(TRUCK_LISTING_TYPES);
    const equipOptions = localizeOptions(MACHINERY_TYPES);

    const makeYearPrice = [
      { key: 'year', label: filterLabel('year'), options: yearOptions, value: state.year },
      { key: 'brand', label: filterLabel('brand'), options: makeOptions, value: state.brand || '' },
      { key: 'price', label: filterLabel('price'), options: priceOptions, value: state.price },
    ];

    const filters = [];

    if (category === 'used-cars') {
      filters.push(...makeYearPrice);
      filters.push({ key: 'trans', label: filterLabel('trans'), options: transOptions, value: state.trans });
      filters.push({ key: 'body', label: filterLabel('body'), options: bodyOptions, value: state.body });
    } else if (category === 'halfcuts') {
      filters.push(...makeYearPrice);
      filters.push({ key: 'trans', label: filterLabel('trans'), options: transOptions, value: state.trans });
      filters.push({ key: 'status', label: filterLabel('status'), options: statusOptions, value: state.status });
    } else if (category === 'trucks') {
      filters.push(...makeYearPrice);
      filters.push({ key: 'trans', label: filterLabel('trans'), options: transOptions, value: state.trans });
      filters.push({ key: 'status', label: filterLabel('status'), options: statusOptions, value: state.status });
    } else if (category === 'machinery') {
      filters.push(...makeYearPrice);
      filters.push({ key: 'equip', label: filterLabel('equip'), options: equipOptions, value: state.equip });
      filters.push({ key: 'status', label: filterLabel('status'), options: statusOptions, value: state.status });
    }

    return filters;
  }

  function hasActiveFilters(state) {
    const meta = CATEGORY_META[state.category];
    return Boolean(
      (state.year && state.year !== 'all')
      || (state.price && state.price !== 'all')
      || state.brand
      || state.model
      || state.body !== 'all'
      || state.trans !== 'all'
      || state.listing !== 'all'
      || (state.category === 'trucks' && state.part !== 'all')
      || state.equip !== 'all'
      || (state.status !== meta.defaultStatus && state.status !== 'all')
      || state.q
    );
  }

  function renderTruckSidebarSubmodulesList(category, state, allItems) {
    if (category !== 'trucks') return '';
    const counts = countTruckSubmodules(allItems || []);
    const activePart = state.part || 'all';
    return TRUCK_SUBMODULES.map((sub) => {
      const localized = localizeOption(sub);
      const active = sub.id === activePart ? ' class="is-active"' : '';
      const count = counts[sub.id] ?? 0;
      const url = halfCutHubUrl(category, {
        ...stateToParams({ ...state, part: sub.id }),
      });
      const countHtml = sub.id !== 'all' && count > 0
        ? ` <span class="ebay-sidebar__submodule-count">(${count})</span>`
        : '';
      return `<li><a href="${url}"${active}><span data-i18n="${sub.labelKey}">${localized.label}</span>${countHtml}</a></li>`;
    }).join('');
  }

  function syncTruckSidebarSubmodules(route) {
    const category = route?.category || 'halfcuts';
    document.querySelectorAll('[data-ebay-truck-submodules]').forEach((wrap) => {
      if (category !== 'trucks') {
        wrap.hidden = true;
        return;
      }
      const state = readHalfCutState(category, route || { category: 'trucks', brand: '', searchQuery: '' });
      const allItems = getInventory(category);
      const list = wrap.querySelector('.ebay-sidebar__submodules-list');
      if (list) list.innerHTML = renderTruckSidebarSubmodulesList(category, state, allItems);
      wrap.hidden = false;
      window.PublicI18n?.applyDataI18n?.(wrap);
    });
  }

  function renderFilterBar(category, filters, state) {
    const pills = filters.map((f) => {
      const active = f.key === 'brand' ? Boolean(f.value) : (f.value && f.value !== 'all');
      const options = f.options.map((o) => {
        const val = o.id ?? o.value ?? '';
        const selected = String(f.value) === String(val) ? ' selected' : '';
        return `<option value="${val}"${selected}>${o.label}</option>`;
      }).join('');
      return `
        <label class="ebay-cars-filter${active ? ' is-active' : ''}">
          <select data-filter-key="${f.key}" aria-label="${f.label}">
            ${options}
          </select>
        </label>`;
    }).join('');

    const clear = hasActiveFilters(state)
      ? `<a class="ebay-cars-filters__clear" href="${halfCutHubUrl(category, { q: '' })}">${t('filter.clearFilters', 'Clear filters')}</a>`
      : '';

    return `
      <div class="ebay-cars-filters" role="group" aria-label="${t('filter.filterResults', 'Filter results')}">
        ${pills}
        ${clear}
      </div>`;
  }

  function renderToolbar(count, unit, sorts, state) {
    const sortOptions = localizeOptions(sorts).map((s) =>
      `<option value="${s.id}"${state.sort === s.id ? ' selected' : ''}>${s.label}</option>`
    ).join('');
    const unitLabel = unit === 'results'
      ? t('filter.results', 'results')
      : unit === 'models'
        ? t('filter.models', 'models')
        : unit;

    return `
      <div class="ebay-cars-toolbar">
        <div class="ebay-cars-toolbar__left">
          <span class="ebay-cars-toolbar__count"><strong>${count}</strong> ${unitLabel}</span>
        </div>
        <div class="ebay-cars-toolbar__right">
          <label class="ebay-cars-sort">
            <span class="visually-hidden">${t('filter.sort', 'Sort')}</span>
            <select data-catalog-sort aria-label="${t('filter.sortResults', 'Sort results')}">${sortOptions}</select>
          </label>
          <span class="ebay-cars-view" aria-current="true">${t('filter.listView', 'List View')}</span>
        </div>
      </div>`;
  }

  function renderListingPhoto(display, detail) {
    const u = window.HalfCutUtils;
    if (u?.renderInlineListingPhoto && u.firstPhotoThumbUrl(display) && u.hasPhotos(display)) {
      return u.renderInlineListingPhoto(display, 'ebay-listing-row__photo');
    }
    return `<a class="ebay-listing-row__photo ebay-listing-row__photo--placeholder" href="${detail}" aria-label="${t('hc.photosOnRequest', 'Photos on request')}">
      <svg class="ebay-listing-row__photo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.75"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg>
    </a>`;
  }

  function renderInventoryListRow(item) {
    return window.HalfCutUtils.renderListingListRow(item, { base: base() });
  }

  function renderInventoryPartRow(item, partType, page) {
    const u = window.HalfCutUtils;
    if (!u) return '';
    const display = u.toPublicItem?.(item) ?? item;
    const primaryTitle = page === 'engines'
      ? (u.formatEngineCatalogPrimaryTitle?.(display) || u.formatPartsCatalogPrimaryTitle?.(display))
      : (u.formatPartsCatalogPrimaryTitle?.(display)
        || String(display.stockId || '').trim()
        || display.slug);
    const priceLabel = u.formatCatalogPartPrice?.(display, partType)
      || u.formatPartPriceUsd(display, u.PART_PRICE_RATIOS?.[partType] ?? 0);
    const priceHtml = u.listingRowPriceHtml?.(priceLabel)
      || `<p class="ebay-listing-row__price">${escapeHtml(priceLabel || t('hc.priceOnEnquiry', 'Quote on enquiry'))} <span class="ap-exw-badge">EXW</span></p>`;
    const mileage = String(display.mileage || '').trim();
    const metaParts = u.formatPartsCatalogMetaParts?.(display, t) || [];
    const displacement = page === 'engines' ? u.formatDisplacementLiters?.(display) : '';
    const filterTags = [
      display.brandSlug,
      display.brand,
      display.model,
      display.engineCode,
      display.transmissionCode,
      display.stockId,
      display.fuelType,
      u.resolveEngineFuelType?.(display),
      displacement,
      primaryTitle,
      mileage,
    ].filter(Boolean).join(' ').toLowerCase();
    const metaHtml = metaParts.length
      ? `<p class="ebay-listing-row__specs">${metaParts.map((p) => escapeHtml(p)).join(' · ')}</p>`
      : '';
    const vinLine = u.listingVinLine?.(display);
    const vinHtml = vinLine
      ? `<span class="ebay-listing-row__vin">${escapeHtml(vinLine)}</span>`
      : '';
    const photoHtml = u.renderPartListingPhoto?.(display, partType)
      || renderListingPhoto(display, '#');
    const watchHtml = partsWatchButtonHtml(display, partType);
    const addHtml = partsAddButtonHtml(display, partType);
    const brand = String(display?.brand || '').trim();
    const tagsHtml = u.listingSpecTagsHtml?.(display) || '';

    return `
      <article class="engine-model ebay-listing-row ebay-listing-row--parts ebay-listing-row--v4" data-slug="${escapeHtml(display.slug || '')}" data-brand="${escapeHtml(display.brandSlug || '')}" data-filter-tags="${escapeHtml(filterTags)}">
        ${photoHtml}
        <div class="ebay-listing-row__main">
          <div class="ebay-listing-row__main-body">
            ${brand ? `<div class="ebay-listing-row__make">${escapeHtml(brand)}</div>` : ''}
            <h3 class="ebay-listing-row__title">${escapeHtml(primaryTitle)}</h3>
            ${tagsHtml}
            ${priceHtml}
            ${metaHtml}
          </div>
          <div class="ebay-listing-row__bot">
            ${vinHtml || '<span class="ebay-listing-row__vin"></span>'}
            <div class="ebay-listing-row__ctas ebay-parts-row__actions">${watchHtml}${addHtml}</div>
          </div>
        </div>
      </article>`;
  }

  const PARTS_WATCHLIST_KEY = 'asiapower-parts-watchlist';

  function readPartsWatchlist() {
    try {
      const raw = localStorage.getItem(PARTS_WATCHLIST_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writePartsWatchlist(list) {
    try {
      localStorage.setItem(PARTS_WATCHLIST_KEY, JSON.stringify(list));
    } catch {
      // ignore quota errors
    }
  }

  function partsWatchKey(slug, partType) {
    return `${partType}:${slug}`;
  }

  function isPartsWatched(slug, partType) {
    if (!slug || !partType) return false;
    return readPartsWatchlist().includes(partsWatchKey(slug, partType));
  }

  function togglePartsWatch(slug, partType) {
    const key = partsWatchKey(slug, partType);
    const list = readPartsWatchlist();
    const idx = list.indexOf(key);
    if (idx >= 0) {
      list.splice(idx, 1);
      writePartsWatchlist(list);
      return false;
    }
    list.push(key);
    writePartsWatchlist(list);
    return true;
  }

  function partsRowIcon(name) {
    if (name === 'heart') {
      return '<svg class="ebay-parts-row__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.4l-.5-.5C3.6 9.4 1.75 7.65 1.75 5.6a2.35 2.35 0 0 1 4-1.7L8 4.2l2.25-2.3a2.35 2.35 0 0 1 4 1.7c0 2.05-1.85 3.8-5.75 7.3L8 13.4z" fill="currentColor"/></svg>';
    }
    return '<svg class="ebay-parts-row__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
  }

  function partsWatchButtonHtml(display, partType) {
    const slug = String(display?.slug || '');
    const watched = isPartsWatched(slug, partType);
    const label = watched ? t('parts.watched', 'Saved') : t('parts.watch', 'Save');
    return `<button type="button" class="ebay-parts-row__watch${watched ? ' is-watched' : ''}" data-parts-watch data-slug="${escapeHtml(slug)}" data-part-type="${escapeHtml(partType)}" aria-pressed="${watched ? 'true' : 'false'}">${partsRowIcon('heart')}<span>${label}</span></button>`;
  }

  function partsAddButtonHtml(display, partType) {
    const u = window.HalfCutUtils;
    const label = t('parts.add', 'Add');
    const link = u?.leadLink?.(display, 'price', 'ebay-parts-row__add', label, partType);
    if (link) {
      return link.replace(
        `>${label}</a>`,
        `>${partsRowIcon('plus')}<span>${label}</span></a>`,
      );
    }
    const slug = escapeHtml(String(display?.slug || ''));
    const safePart = escapeHtml(String(partType || ''));
    return `<a href="#" class="ebay-parts-row__add" data-half-cut-lead data-slug="${slug}" data-intent="price" data-part-type="${safePart}">${partsRowIcon('plus')}<span>${label}</span></a>`;
  }

  function bindPartsWatchlist(root) {
    if (!root || root.dataset.partsWatchBound === '1') return;
    root.dataset.partsWatchBound = '1';
    root.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-parts-watch]');
      if (!btn || !root.contains(btn)) return;
      event.preventDefault();
      const slug = btn.dataset.slug;
      const partType = btn.dataset.partType;
      if (!slug || !partType) return;
      const added = togglePartsWatch(slug, partType);
      btn.classList.toggle('is-watched', added);
      btn.setAttribute('aria-pressed', added ? 'true' : 'false');
      const labelEl = btn.querySelector('span');
      const nextLabel = added ? t('parts.watched', 'Saved') : t('parts.watch', 'Save');
      if (labelEl) labelEl.textContent = nextLabel;
      else btn.textContent = nextLabel;
      window.SiteFeedback?.toast?.(
        added ? t('parts.watchSaved', 'Saved to your list') : t('parts.watchRemoved', 'Removed from your list'),
        'success',
      );
    });
  }

  const INVENTORY_PART_TYPE = {
    engines: 'engine',
    gearboxes: 'transmission',
    chassis: 'chassis',
    frontcuts: 'front',
  };

  function filterInventoryPartItems(items, state, partType) {
    const q = String(state?.q || '').toLowerCase().trim();
    const page = state?.page || '';
    const u = window.HalfCutUtils;
    return (items || []).filter((d) => {
      const brandOk = !state?.brand || d.brandSlug === state.brand;
      if (!brandOk) return false;
      if (page === 'engines') {
        if (!matchesYear(d, state.year)) return false;
        if (!matchesEnginePartPriceRange(d, state.price, partType || 'engine')) return false;
        if (!matchesEngineFuel(d, state.fuel)) return false;
      }
      if (!q) return true;
      // catalog-search-v1 / stock-id-search-v1
      if (u?.matchesCatalogSearch) return u.matchesCatalogSearch(d, q);
      if (u?.isStockIdQuery?.(q) && u?.matchesStockId?.(d, q)) return true;
      const haystack = [
        d.brandSlug,
        d.brand,
        d.model,
        d.engineCode,
        d.transmissionCode,
        d.gearboxModel,
        d.stockId,
        d.title,
        d.originalVehicleName,
        d.vin,
        d.maskedVin,
        d.mileage,
        d.fuelType,
        window.HalfCutUtils?.resolveEngineFuelType?.(d),
        window.HalfCutUtils?.formatDisplacementLiters?.(d),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function inventoryPartItems(page, partType, query) {
    const u = window.HalfCutUtils;
    const raw = window.getPassengerCatalogInventory?.()
      || window.getPassengerHalfCutInventory?.()
      || [];
    let list = raw
      .map((item) => u?.toPublicItem?.(item) ?? item)
      .filter((d) => !u?.isSold?.(d))
      // Dedicated inventory is mutually exclusive. Real half-cuts may also feed
      // engine/gearbox catalogs through the canonical category matcher.
      .filter((d) => u?.matchesInventoryCategory?.(d, page) ?? false);
    // Search may widen fields, never categories.
    const q = String(query || '').trim();
    if (q && (u?.matchesCatalogSearch || u?.isStockIdQuery?.(q))) {
      const hits = (window.HALF_CUT_LIST || [])
        .map((item) => u?.toPublicItem?.(item) ?? item)
        .filter((d) => {
          if (u?.isSold?.(d)) return false;
          if (!u?.matchesInventoryCategory?.(d, page)) return false;
          if (u?.matchesCatalogSearch) return u.matchesCatalogSearch(d, q);
          return u?.isStockIdQuery?.(q) && u.matchesStockId(d, q);
        });
      const seen = new Set(list.map((d) => String(d.stockId || '').toUpperCase()).filter(Boolean));
      hits.forEach((hit) => {
        const key = String(hit.stockId || '').toUpperCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push(hit);
      });
    }
    return list.sort((a, b) => String(b.stockId || '').localeCompare(String(a.stockId || ''), undefined, { numeric: true }));
  }

  function renderPartsCatalogLoading(root) {
    if (!root) return;
    root.innerHTML = `<div class="catalog-empty" aria-live="polite"><p class="catalog-empty__title">${t('catalog.loadingInventory', 'Loading inventory…')}</p></div>`;
  }

  function initInventoryParts(page, root) {
    if (!root) return;
    const partType = INVENTORY_PART_TYPE[page] || 'engine';

    const render = () => {
      const u = window.HalfCutUtils;
      if (!u) return;
      const state = readPartsState(page);
      const allItems = inventoryPartItems(page, partType, state.q);
      const filtered = filterInventoryPartItems(allItems, state, partType);
      const brandMap = new Map();
      allItems.forEach((d) => {
        if (d.brandSlug && !brandMap.has(d.brandSlug)) {
          brandMap.set(d.brandSlug, { slug: d.brandSlug, name: d.brand || d.brandSlug });
        }
      });
      const brands = [...brandMap.values()].sort((a, b) => a.name.localeCompare(b.name));
      const feedOpts = {
        base: base(),
        partType,
        listOnly: true,
        renderListRow: (item) => renderInventoryPartRow(item, partType, page),
      };

      root.innerHTML = filtered.length
        ? (u.renderCatalogFeed?.(filtered, feedOpts) || '')
        : '';

      initParts(page, root, {
        getBrands: () => brands,
        getTotalCount: () => filtered.length,
        typeFilters: [],
        inventoryMode: true,
        engineInventoryFilters: page === 'engines',
        inventoryFilterItems: allItems,
      });

      u.bindCatalogLoadMore?.(root, filtered, feedOpts);
      bindPartsWatchlist(root);
      window.HalfCutGalleryLightbox?.bindListingPhotoCarousels?.(root);
      window.AsiaPowerEbayLayout?.syncSidebar?.('parts');
    };

    const store = window.HalfCutInventoryStore;
    if (store?.whenReady) {
      renderPartsCatalogLoading(root);
      store.whenReady().then(render).catch(render);
    } else {
      render();
    }
  }

  function renderPartsListRow({ brandSlug, brandName, title, url, filterTags, priceLabel, meta }) {
    const fullTitle = String(title || '').trim();
    const metaHtml = meta
      ? `<p class="ebay-listing-row__meta">${String(meta).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`
      : '';
    const u = window.HalfCutUtils;
    const priceHtml = u?.listingRowPriceHtml
      ? u.listingRowPriceHtml(priceLabel)
      : (priceLabel
        ? `<p class="ebay-listing-row__price">${String(priceLabel).replace(/&/g, '&amp;').replace(/</g, '&lt;')} <span class="ap-exw-badge">EXW</span></p>`
        : `<p class="ebay-listing-row__price ebay-listing-row__price--enquiry">${t('hc.priceOnEnquiry', 'Quote on enquiry')} <span class="ap-exw-badge">EXW</span></p>`);
    const safeTitle = fullTitle
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const safeUrl = url || '#';

    return `
      <article class="engine-model ebay-listing-row ebay-listing-row--parts" data-filter-tags="${filterTags || ''}">
        <a class="ebay-listing-row__photo ebay-listing-row__photo--placeholder" href="${safeUrl}" aria-hidden="true">
          <svg class="ebay-listing-row__photo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.75"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg>
        </a>
        <div class="ebay-listing-row__main">
          <h3 class="ebay-listing-row__title"><a href="${safeUrl}">${safeTitle}</a></h3>
          ${metaHtml}
        </div>
        <div class="ebay-listing-row__aside">${priceHtml}</div>
      </article>`;
  }

  function renderVehicleCard(item) {
    const u = window.HalfCutUtils;
    const display = u.toPublicItem(item);
    const detail = u.detailUrl(base(), display.slug);
    const thumbUrl = u.firstPhotoThumbUrl(display);
    const hasPhotos = u.hasPhotos(display);
    const priceLabel = u.formatFobPrice(display);
    const priceContent = u.priceWithExwLabel?.(priceLabel, 'Quote on enquiry')
      || `${priceLabel || 'Quote on enquiry'} <span class="ap-exw-badge">EXW</span>`;
    const statusLabel = window.PublicI18n?.translateStatus?.(display.status) || display.status;
    const thumb = thumbUrl && hasPhotos
      ? `<img src="${thumbUrl}" alt="" loading="lazy" decoding="async">`
      : `<div class="ebay-vehicle-card__placeholder" aria-hidden="true"><span>Photos on request</span></div>`;

    return `
      <article class="ebay-vehicle-card" data-slug="${display.slug}" data-brand="${display.brandSlug}">
        <a class="ebay-vehicle-card__link" href="${detail}">
          <div class="ebay-vehicle-card__photo">${thumb}</div>
          <h3 class="ebay-vehicle-card__title">${display.year} ${display.brand} ${display.model}</h3>
          <p class="ebay-vehicle-card__meta">Pre-Owned · ${display.brand}</p>
          <p class="ebay-vehicle-card__price">${priceContent}</p>
          <p class="ebay-vehicle-card__ship">${statusLabel} · Export ready</p>
        </a>
      </article>`;
  }

  function renderUsedCarsEmpty() {
    return `
      <div class="ebay-cars-empty">
        <div class="ebay-cars-empty__icon" aria-hidden="true">🚗</div>
        <h2 class="ebay-cars-empty__title">${t('hc.noUsedCarsTitle', 'No used cars listed yet')}</h2>
        <p class="ebay-cars-empty__lead">${t('hc.noUsedCarsLead', 'Running and repairable vehicles appear here when available. Tell us what you need — we source from 200+ suppliers.')}</p>
        <div class="ebay-cars-empty__actions">
          <a href="${base()}contact.html" class="btn btn-accent">${t('hc.requestSourcing', 'Request sourcing')}</a>
          <a href="${base()}half-cuts/" class="btn btn-outline-navy">${t('hc.browseHalfCuts', 'Browse half-cuts')}</a>
        </div>
      </div>`;
  }

  function renderInventoryEmpty(category) {
    const messages = {
      halfcuts: t('hc.noMatch', 'No half cuts match your filters.'),
      trucks: t('hc.noTrucks', 'No truck listings match your filters.'),
      machinery: t('hc.noMachinery', 'No machinery listings match your filters.'),
    };
    return `
      <div class="ebay-cars-empty">
        <h2 class="ebay-cars-empty__title">${messages[category] || messages.halfcuts}</h2>
        <p class="ebay-cars-empty__lead">${t('hc.sendRequest', 'Send us your request')} — <a href="${base()}contact.html">${t('nav.contact', 'Contact')}</a></p>
      </div>`;
  }

  function categoryTitle(meta) {
    if (!meta) return '';
    return meta.titleKey ? t(meta.titleKey, meta.title) : meta.title;
  }

  function syncPageHeader(category) {
    const meta = CATEGORY_META[category] || CATEGORY_META.halfcuts;
    const title = categoryTitle(meta);
    const titleEl = document.querySelector('.ebay-page-title');
    if (titleEl) titleEl.textContent = title;
    document.querySelector('.ebay-page-lead')?.remove();
    const intro = document.querySelector('.ebay-page__intro');
    let subEl = intro?.querySelector('.ebay-page-subtitle');
    if (meta.subtitleKey && category === 'halfcuts') {
      const subtitle = t(meta.subtitleKey, 'Custom dismantling · Parts on demand');
      if (!subEl && intro) {
        subEl = document.createElement('p');
        subEl.className = 'ebay-page-subtitle';
        titleEl?.insertAdjacentElement('afterend', subEl);
      }
      if (subEl) {
        subEl.dataset.i18n = meta.subtitleKey;
        subEl.textContent = subtitle;
      }
    } else {
      subEl?.remove();
    }
    window.PublicI18n?.applyDataI18n?.(intro);
    document.title = `${title} | AsiaPower`;
  }

  function bindHalfCutHub(root, category, state) {
    const navigate = (patch) => {
      window.location.href = halfCutHubUrl(category, { ...stateToParams(state), ...patch });
    };

    root.querySelectorAll('[data-filter-key]').forEach((select) => {
      select.addEventListener('change', (e) => {
        const key = e.target.dataset.filterKey;
        const val = e.target.value;
        const patch = {};
        if (key === 'brand') {
          patch.brand = val;
          patch.model = '';
        }
        else if (key === 'year') patch.year = val === 'all' ? '' : val;
        else if (key === 'price') patch.price = val === 'all' ? '' : val;
        else if (key === 'body') patch.body = val === 'all' ? '' : val;
        else if (key === 'trans') patch.trans = val === 'all' ? '' : val;
        else if (key === 'status') {
          const meta = CATEGORY_META[category];
          patch.status = (val === meta.defaultStatus || val === 'all') ? '' : val;
        }
        else if (key === 'listing') patch.listing = val === 'all' ? '' : val;
        else if (key === 'equip') patch.equip = val === 'all' ? '' : val;
        navigate(patch);
      });
    });

    root.querySelector('[data-catalog-sort]')?.addEventListener('change', (e) => {
      navigate({ sort: e.target.value === 'best' ? '' : e.target.value });
    });
  }

  function refreshSidebarModels() {
    const root = document.getElementById('half-cut-catalog-root');
    if (!root) return;
    const route = window.parseHalfCutCatalogRoute?.() || {
      category: root.dataset.catalogCategory || 'halfcuts',
      brand: new URLSearchParams(window.location.search).get('brand') || '',
      searchQuery: '',
    };
    const category = route.category || root.dataset.catalogCategory || 'halfcuts';
    const state = readHalfCutState(category, route);
    const allItems = getInventory(category, state.q);
    syncSidebarModels(category, state, allItems);
    syncSidebarBrands(category, state, allItems);
  }

  function initHalfCut(root, route) {
    if (!root) return;
    void ensureCatalogTrending().then(() => paintHalfCutHub(root, route));
  }

  function paintHalfCutHub(root, route) {
    if (!root) return;

    const category = route?.category || 'halfcuts';
    const meta = CATEGORY_META[category] || CATEGORY_META.halfcuts;
    const state = readHalfCutState(category, route);
    const allItems = getInventory(category, state.q);
    const brandSegment = window.HalfCutUtils?.brandSegmentForCategory?.(category) || meta.brandSegment;
    const brands = window.getHalfCutBrands?.(brandSegment) || [];
    const counts = brandCounts(allItems);
    const filtered = filterInventory(allItems, state);
    const filters = filtersForCategory(category, brands, counts, state, allItems);

    const mainEl = root.closest('.ebay-main') || root.parentElement;
    mainEl?.classList.add('ebay-main--cars-hub');

    const feedOpts = { base: base() };
    const u = window.HalfCutUtils;
    const listHtml = filtered.length
      ? (u.renderCatalogFeed?.(filtered, feedOpts) || u.renderInventoryFeed(filtered, feedOpts))
      : (category === 'used-cars' ? renderUsedCarsEmpty() : renderInventoryEmpty(category));

    root.innerHTML = `
      <div class="ebay-cars-main">
        ${renderFilterBar(category, filters, state)}
        ${renderToolbar(filtered.length, meta.unit, meta.sorts, state)}
        ${listHtml}
      </div>`;

    syncPageHeader(category);
    bindHalfCutHub(root, category, state);
    window.PublicI18n?.applyDataI18n?.(root);
    window.HalfCutUtils?.bindCatalogLoadMore?.(root, filtered, feedOpts);
    syncSidebarModels(category, state, allItems);
    syncSidebarBrands(category, state, allItems);
    syncTruckSidebarSubmodules(route || { category, brand: state.brand, searchQuery: state.q });
    window.HalfCutGalleryLightbox?.bindListingPhotoCarousels?.(root);
  }

  /* ── Parts catalog (二手零部件) ── */

  function partsPageUrl(page, params) {
    const info = PARTS_PAGES[page];
    if (!info) return `${base()}engines/`;
    const p = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    const qs = p.toString();
    return `${base()}${info.href}${qs ? `?${qs}` : ''}`;
  }

  function readPartsState(page) {
    const params = new URLSearchParams(window.location.search);
    const state = {
      page,
      brand: params.get('brand') || '',
      type: params.get('type') || 'all',
      q: params.get('q') || '',
    };
    if (page === 'engines') {
      state.year = params.get('year') || '';
      state.price = params.get('price') || '';
      state.fuel = params.get('fuel') || '';
    }
    return state;
  }

  function partsStateToParams(page, state) {
    const params = {
      brand: state.brand,
      q: state.q,
    };
    if (page === 'engines') {
      params.year = state.year === 'all' ? '' : state.year;
      params.price = state.price === 'all' ? '' : state.price;
      params.fuel = state.fuel === 'all' ? '' : state.fuel;
    } else if (state.type && state.type !== 'all') {
      params.type = state.type;
    }
    return params;
  }

  function renderEngineInventoryFilterExtras(state, brands, items) {
    const yearOptions = yearOptionsFromItemsLocalized(items);
    const priceOptions = localizeOptions(PRICE_RANGES);
    const fuelOptions = engineFuelOptionsFromItems(items);

    const selectBlock = (key, label, options, value) => {
      const opts = options.map((opt) => {
        const id = opt.id ?? opt.value ?? '';
        const labelText = opt.labelKey ? t(opt.labelKey, opt.label) : (opt.label || id);
        const selected = (value || 'all') === id || (!value && id === 'all') || (value === id);
        return `<option value="${id}"${selected ? ' selected' : ''}>${labelText}</option>`;
      }).join('');
      const active = value && value !== 'all';
      return `<label class="ebay-cars-filter${active ? ' is-active' : ''}">
        <select data-parts-filter="${key}" aria-label="${label}">${opts}</select>
      </label>`;
    };

    return `
      ${selectBlock('year', t('filter.year', 'Year'), yearOptions, state.year || 'all')}
      ${renderInventoryMakeFilterSelect(state, brands, items)}
      ${selectBlock('fuel', t('filter.fuelType', 'Fuel type'), fuelOptions, state.fuel || 'all')}
      ${selectBlock('price', t('filter.price', 'Price'), priceOptions, state.price || 'all')}`;
  }

  function renderPartsFilterBar(page, brands, state, typeFilters, opts) {
    const options = opts || {};
    const partOptions = Object.entries(PARTS_PAGES).map(([id, info]) =>
      `<option value="${id}"${page === id ? ' selected' : ''}>${t(info.labelKey, info.label)}</option>`
    ).join('');

    const showTypeFilter = !options.hideTypeFilter && (typeFilters || []).length > 0;
    const typeOptions = (typeFilters || []).map((tf) =>
      `<option value="${tf.filter}"${state.type === tf.filter ? ' selected' : ''}>${t(tf.i18n, tf.label)}</option>`
    ).join('');

    const typeLabel = t(PARTS_PAGES[page]?.typeLabelKey, PARTS_PAGES[page]?.typeLabel || 'Type');
    const engineInventory = page === 'engines' && options.engineInventoryFilters;
    const inventoryItems = options.inventoryFilterItems || [];
    const useInventoryMake = engineInventory || (options.inventoryMode && inventoryItems.length);
    const brandOptions = useInventoryMake ? '' : [
      `<option value=""${!state.brand ? ' selected' : ''}>${t('filter.make', 'Make')}</option>`,
      ...brands.map((b) =>
        `<option value="${b.slug}"${state.brand === b.slug ? ' selected' : ''}>${b.name}</option>`
      ),
    ].join('');

    const hasEngineFilters = engineInventory && (
      (state.year && state.year !== 'all')
      || (state.price && state.price !== 'all')
      || (state.fuel && state.fuel !== 'all')
    );
    const hasFilters = state.brand || state.q || hasEngineFilters
      || (showTypeFilter && state.type && state.type !== 'all');
    const typeFilterHtml = showTypeFilter
      ? `<label class="ebay-cars-filter${state.type !== 'all' ? ' is-active' : ''}">
          <select data-parts-filter="type" aria-label="${typeLabel}">${typeOptions}</select>
        </label>`
      : '';
    const brandFilterHtml = engineInventory
      ? renderEngineInventoryFilterExtras(state, brands, inventoryItems)
      : useInventoryMake
        ? renderInventoryMakeFilterSelect(state, brands, inventoryItems)
        : `<label class="ebay-cars-filter${state.brand ? ' is-active' : ''}">
          <select data-parts-filter="brand" aria-label="${t('filter.make', 'Make')}">${brandOptions}</select>
        </label>`;

    return `
      <div class="ebay-cars-filters" role="group" aria-label="${t('filter.filterResults', 'Filter results')}">
        <label class="ebay-cars-filter is-active">
          <select data-parts-filter="page" aria-label="${t('filter.partCategory', 'Part category')}">${partOptions}</select>
        </label>
        ${brandFilterHtml}
        ${typeFilterHtml}
        ${hasFilters ? `<a class="ebay-cars-filters__clear" href="${partsPageUrl(page)}">${t('filter.clearFilters', 'Clear filters')}</a>` : ''}
      </div>`;
  }

  function applyPartsFilters(root, state, shell) {
    const host = shell || root.closest('.ebay-parts-main') || root.parentElement;
    const cards = root.querySelectorAll('.engine-model');
    const sections = root.querySelectorAll('.engine-catalog');
    let visible = 0;

    cards.forEach((card) => {
      const section = card.closest('.engine-catalog');
      const brand = card.dataset.brand || section?.dataset.brand || '';
      const tags = String(card.dataset.filterTags || '').toLowerCase();
      const code = card.querySelector('.ebay-listing-row__title')?.textContent?.toLowerCase()
        || card.querySelector('.engine-model__code')?.textContent?.toLowerCase() || '';
      const metaText = card.querySelector('.ebay-listing-row__meta')?.textContent?.toLowerCase() || '';
      const brandOk = !state.brand || brand === state.brand;
      const typeOk = !state.type || state.type === 'all' || tags.includes(state.type);
      const q = state.q.toLowerCase().trim();
      const qOk = !q || tags.includes(q) || code.includes(q) || metaText.includes(q);
      const show = brandOk && typeOk && qOk;
      card.classList.toggle('hidden', !show);
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    sections.forEach((section) => {
      const any = section.querySelector('.engine-model:not(.hidden)');
      section.classList.toggle('hidden', !any);
      section.style.display = any ? '' : 'none';
    });

    const countEl = host?.querySelector('[data-parts-count]');
    if (countEl) countEl.textContent = String(visible);

    const emptyEl = host?.querySelector('[data-parts-empty]');
    if (emptyEl) {
      emptyEl.classList.toggle('hidden', visible > 0);
      emptyEl.hidden = visible > 0;
    }
  }

  function bindPartsHub(shell, page, state, brands, typeFilters) {
    const navigateParts = (patch) => {
      window.location.href = partsPageUrl(page, partsStateToParams(page, { ...state, ...patch }));
    };

    shell.querySelector('[data-parts-filter="page"]')?.addEventListener('change', (e) => {
      const next = e.target.value;
      if (next && next !== page) {
        window.location.href = partsPageUrl(next, partsStateToParams(page, state));
      }
    });

    shell.querySelector('[data-parts-filter="brand"]')?.addEventListener('change', (e) => {
      navigateParts({ brand: e.target.value });
    });

    shell.querySelector('[data-parts-filter="type"]')?.addEventListener('change', (e) => {
      navigateParts({ type: e.target.value === 'all' ? '' : e.target.value });
    });

    shell.querySelector('[data-parts-filter="year"]')?.addEventListener('change', (e) => {
      navigateParts({ year: e.target.value === 'all' ? '' : e.target.value });
    });

    shell.querySelector('[data-parts-filter="price"]')?.addEventListener('change', (e) => {
      navigateParts({ price: e.target.value === 'all' ? '' : e.target.value });
    });

    shell.querySelector('[data-parts-filter="fuel"]')?.addEventListener('change', (e) => {
      navigateParts({ fuel: e.target.value === 'all' ? '' : e.target.value });
    });
  }

  function renderPartsToolbar(count, unitKey) {
    const unitLabel = unitKey === 'results'
      ? t('filter.results', 'results')
      : t('filter.models', 'models');
    return `
      <div class="ebay-cars-toolbar">
        <div class="ebay-cars-toolbar__left">
          <span class="ebay-cars-toolbar__count"><strong data-parts-count>${count}</strong> ${unitLabel}</span>
        </div>
        <div class="ebay-cars-toolbar__right">
          <span class="ebay-cars-view" aria-current="true">${t('filter.listView', 'List View')}</span>
        </div>
      </div>`;
  }

  function syncPartsPageHeader(page) {
    const titles = {
      engines: { key: 'engines.title', fallback: 'Engine Model Catalog' },
      gearboxes: { key: 'gearboxes.title', fallback: 'Gearbox Catalog' },
      chassis: { key: 'catalog.chassis', fallback: 'Chassis Parts' },
      frontcuts: { key: 'parts.submoduleFrontCut', fallback: 'Front Cut' },
    };
    const meta = titles[page] || titles.engines;
    const title = t(meta.key, meta.fallback);
    const titleEl = document.querySelector('.ebay-page-title');
    if (titleEl) titleEl.textContent = title;
    document.title = `${title} | AsiaPower`;
  }

  function initParts(page, root, options) {
    if (!root || !options) return;

    const state = readPartsState(page);
    const brands = (options.getBrands?.() || []).map((b) => ({ name: b.name, slug: b.slug }));
    const total = options.getTotalCount?.() || root.querySelectorAll('.engine-model').length;
    const typeFilters = options.typeFilters || [];
    const inventoryMode = !!options.inventoryMode;
    const hideTypeFilter = options.hideTypeFilter ?? !typeFilters.length;
    const engineInventoryFilters = !!options.engineInventoryFilters;

    const mainEl = root.closest('.ebay-main') || root.parentElement;
    mainEl?.classList.add('ebay-main--cars-hub');

    document.getElementById('powertrain-catalog-toolbar')?.replaceChildren();

    let shell = root.closest('.ebay-parts-main');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'ebay-cars-main ebay-parts-main';
      root.parentNode.insertBefore(shell, root);
      shell.appendChild(root);
    } else {
      shell.querySelector('.ebay-cars-filters')?.remove();
      shell.querySelector('.ebay-cars-toolbar')?.remove();
      shell.querySelector('[data-parts-empty]')?.remove();
    }

    const emptyTitle = inventoryMode
      ? t('catalog.noMatchInventory', 'No listings match your filters.')
      : t('catalog.noMatch', 'No models match your filters.');

    shell.insertAdjacentHTML('afterbegin', `
      ${renderPartsFilterBar(page, brands, state, typeFilters, {
        hideTypeFilter,
        engineInventoryFilters,
        inventoryFilterItems: options.inventoryFilterItems || [],
      })}
      ${renderPartsToolbar(total, inventoryMode ? 'results' : 'models')}
      <div data-parts-empty class="ebay-cars-empty hidden">
        <h2 class="ebay-cars-empty__title">${emptyTitle}</h2>
      </div>`);

    bindPartsHub(shell, page, state, brands, typeFilters);
    if (inventoryMode) {
      const emptyEl = shell.querySelector('[data-parts-empty]');
      if (emptyEl) {
        emptyEl.classList.toggle('hidden', total > 0);
        emptyEl.hidden = total > 0;
        emptyEl.setAttribute('aria-hidden', total > 0 ? 'true' : 'false');
      }
    } else {
      applyPartsFilters(root, state, shell);
    }
    syncPartsPageHeader(page);
    window.dispatchEvent(new CustomEvent('asiapower:layoutrefresh'));
  }

  window.AsiaPowerEbayCatalogHub = {
    initHalfCut,
    initParts,
    initInventoryParts,
    syncTruckSidebarSubmodules,
    syncPageHeader,
    halfCutHubUrl,
    partsPageUrl,
    syncSidebarModels,
    syncSidebarBrands,
    refreshSidebarModels,
    renderInventoryListRow,
    renderPartsListRow,
  };
  window.AsiaPowerUsedCarsHub = {
    init: (root, route) => initHalfCut(root, route),
    hubUrl: (params) => halfCutHubUrl('used-cars', params),
  };
})();
