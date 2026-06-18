/**
 * AsiaPower — Half-Cut Inventory Directory
 */
(function () {
  'use strict';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  const PARTS_SETS = [
    ['Engine & gearbox assembly', 'ECU & wiring harness', 'Front suspension & steering', 'Radiator & cooling pack'],
    ['Engine & transmission', 'Engine wiring loom', 'Radiator & intercooler pack', 'Steering column & rack'],
    ['Complete front clip', 'Engine & gearbox', 'ABS module & harness', 'Front subframe assembly'],
    ['Engine bay assembly', 'Gearbox & transfer case', 'Cooling system', 'Front brakes & hubs'],
    ['Nose cut with engine', 'Automatic transmission', 'ECU & fuse box', 'Front crossmember'],
  ];

  const DESC_TEMPLATES = [
    (r) => `${r.year} ${r.brand} ${r.model} with ${r.engineCode} — front half cut for export rebuild programs.`,
    (r) => `${r.brand} ${r.model} (${r.year}), ${r.engineCode} / ${r.transmissionCode} — reference listing via AsiaPower sourcing network.`,
    (r) => `Half-cut reference: ${r.brand} ${r.model}, ${r.engineCode} diesel/petrol unit, ${r.mileage} indicated mileage.`,
    (r) => `${r.brand} ${r.model} ${r.year} nose cut — ${r.engineCode} with ${r.transmissionCode} transmission.`,
    (r) => `Export half-cut enquiry reference for ${r.brand} ${r.model} (${r.engineCode}, ${r.transmissionCode}).`,
  ];

  function pickVariant(key, count) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash + key.charCodeAt(i) * (i + 1)) % count;
    return hash;
  }

  function hc(record) {
    const stockId = record.stockId;
    const variant = pickVariant(stockId, DESC_TEMPLATES.length);
    const partsVariant = pickVariant(stockId + 'p', PARTS_SETS.length);
    return {
      photos: [],
      status: 'Available',
      origin: 'China',
      mileage: record.mileage,
      drivetrain: record.drivetrain || '2WD',
      includedParts: record.includedParts || PARTS_SETS[partsVariant],
      shortDescription: record.shortDescription || DESC_TEMPLATES[variant](record),
      ...record,
    };
  }

  const SEED_HALF_CUT_LIST = [
    hc({ stockId: 'HC250001', brand: 'Toyota', brandSlug: 'toyota', model: 'Hilux Revo', year: 2022, engineCode: '2GD-FTV', transmissionCode: '6AT', drivetrain: '4WD', mileage: '68,000 km', status: 'Available', title: 'Toyota Hilux Revo 2GD-FTV Half Cut', slug: 'toyota-hilux-revo-2022-2gd-ftv-half-cut-hc250001', shortDescription: 'Complete front half cut with 2GD-FTV diesel and 6-speed automatic — Hilux Revo rebuild reference.' }),
    hc({ stockId: 'HC250002', brand: 'Toyota', brandSlug: 'toyota', model: 'Land Cruiser Prado', year: 2021, engineCode: '1GD-FTV', transmissionCode: '6AT', drivetrain: '4WD', mileage: '72,000 km', status: 'Available', title: 'Toyota Prado 1GD-FTV Half Cut', slug: 'toyota-prado-2021-1gd-ftv-half-cut-hc250002' }),
    hc({ stockId: 'HC250003', brand: 'Toyota', brandSlug: 'toyota', model: 'Hiace', year: 2020, engineCode: '2TR-FE', transmissionCode: '5MT', drivetrain: '2WD', mileage: '95,000 km', status: 'Available', title: 'Toyota Hiace 2TR-FE Half Cut', slug: 'toyota-hiace-2020-2tr-fe-half-cut-hc250003' }),
    hc({ stockId: 'HC250004', brand: 'Toyota', brandSlug: 'toyota', model: 'Land Cruiser 200', year: 2019, engineCode: '1VD-FTV', transmissionCode: '6AT', drivetrain: '4WD', mileage: '118,000 km', status: 'Reserved', title: 'Toyota Land Cruiser 1VD Half Cut', slug: 'toyota-land-cruiser-2019-1vd-half-cut-hc250004', origin: 'Japan' }),
    hc({ stockId: 'HC250005', brand: 'Toyota', brandSlug: 'toyota', model: 'Fortuner', year: 2021, engineCode: '2GD-FTV', transmissionCode: '6AT', drivetrain: '4WD', mileage: '61,000 km', status: 'Available', title: 'Toyota Fortuner 2GD-FTV Half Cut', slug: 'toyota-fortuner-2021-2gd-ftv-half-cut-hc250005' }),
    hc({ stockId: 'HC250006', brand: 'Toyota', brandSlug: 'toyota', model: 'Corolla', year: 2018, engineCode: '2ZR-FE', transmissionCode: 'CVT', drivetrain: '2WD', mileage: '82,000 km', status: 'Sold', title: 'Toyota Corolla 2ZR-FE Half Cut', slug: 'toyota-corolla-2018-2zr-fe-half-cut-hc250006' }),

    hc({ stockId: 'HC250007', brand: 'Nissan', brandSlug: 'nissan', model: 'Navara NP300', year: 2020, engineCode: 'YD25', transmissionCode: '7AT', drivetrain: '4WD', mileage: '74,000 km', status: 'Available', title: 'Nissan Navara YD25 Half Cut', slug: 'nissan-navara-2020-yd25-half-cut-hc250007' }),
    hc({ stockId: 'HC250008', brand: 'Nissan', brandSlug: 'nissan', model: 'X-Trail', year: 2019, engineCode: 'QR25DE', transmissionCode: 'CVT', drivetrain: 'AWD', mileage: '88,000 km', status: 'Available', title: 'Nissan X-Trail QR25 Half Cut', slug: 'nissan-x-trail-2019-qr25-half-cut-hc250008' }),
    hc({ stockId: 'HC250009', brand: 'Nissan', brandSlug: 'nissan', model: 'Navara', year: 2018, engineCode: 'YD25DDTi', transmissionCode: '6MT', drivetrain: '4WD', mileage: '102,000 km', status: 'Available', title: 'Nissan Navara YD25 Manual Half Cut', slug: 'nissan-navara-2018-yd25-manual-half-cut-hc250009' }),
    hc({ stockId: 'HC250010', brand: 'Nissan', brandSlug: 'nissan', model: 'Tiida', year: 2017, engineCode: 'HR16DE', transmissionCode: 'CVT', drivetrain: '2WD', mileage: '91,000 km', status: 'Reserved', title: 'Nissan Tiida HR16 Half Cut', slug: 'nissan-tiida-2017-hr16-half-cut-hc250010' }),
    hc({ stockId: 'HC250011', brand: 'Nissan', brandSlug: 'nissan', model: 'Patrol', year: 2016, engineCode: 'TB48DE', transmissionCode: '5AT', drivetrain: '4WD', mileage: '145,000 km', status: 'Available', title: 'Nissan Patrol TB48 Half Cut', slug: 'nissan-patrol-2016-tb48-half-cut-hc250011', origin: 'Japan' }),

    hc({ stockId: 'HC250012', brand: 'Hyundai', brandSlug: 'hyundai', model: 'Tucson', year: 2021, engineCode: 'G4NA', transmissionCode: '6AT', drivetrain: 'AWD', mileage: '58,000 km', status: 'Available', title: 'Hyundai Tucson G4NA Half Cut', slug: 'hyundai-tucson-2021-g4na-half-cut-hc250012' }),
    hc({ stockId: 'HC250013', brand: 'Hyundai', brandSlug: 'hyundai', model: 'Santa Fe', year: 2020, engineCode: 'G4KE', transmissionCode: '6AT', drivetrain: 'AWD', mileage: '67,000 km', status: 'Available', title: 'Hyundai Santa Fe G4KE Half Cut', slug: 'hyundai-santa-fe-2020-g4ke-half-cut-hc250013' }),
    hc({ stockId: 'HC250014', brand: 'Hyundai', brandSlug: 'hyundai', model: 'Elantra', year: 2019, engineCode: 'G4FC', transmissionCode: '6AT', drivetrain: '2WD', mileage: '79,000 km', status: 'Available', title: 'Hyundai Elantra G4FC Half Cut', slug: 'hyundai-elantra-2019-g4fc-half-cut-hc250014' }),
    hc({ stockId: 'HC250015', brand: 'Hyundai', brandSlug: 'hyundai', model: 'Tucson', year: 2018, engineCode: 'G4NA', transmissionCode: '6AT', drivetrain: '2WD', mileage: '96,000 km', status: 'Sold', title: 'Hyundai Tucson G4NA 2WD Half Cut', slug: 'hyundai-tucson-2018-g4na-2wd-half-cut-hc250015' }),
    hc({ stockId: 'HC250016', brand: 'Hyundai', brandSlug: 'hyundai', model: 'Santa Fe', year: 2019, engineCode: 'D4HB', transmissionCode: '8AT', drivetrain: 'AWD', mileage: '84,000 km', status: 'Available', title: 'Hyundai Santa Fe D4HB Diesel Half Cut', slug: 'hyundai-santa-fe-2019-d4hb-half-cut-hc250016', origin: 'Korea' }),

    hc({ stockId: 'HC250017', brand: 'Kia', brandSlug: 'kia', model: 'Sportage', year: 2021, engineCode: 'G4KD', transmissionCode: '6AT', drivetrain: 'AWD', mileage: '55,000 km', status: 'Available', title: 'Kia Sportage G4KD Half Cut', slug: 'kia-sportage-2021-g4kd-half-cut-hc250017', origin: 'Korea' }),
    hc({ stockId: 'HC250018', brand: 'Kia', brandSlug: 'kia', model: 'Sorento', year: 2020, engineCode: 'G4KE', transmissionCode: '8AT', drivetrain: 'AWD', mileage: '63,000 km', status: 'Available', title: 'Kia Sorento G4KE Half Cut', slug: 'kia-sorento-2020-g4ke-half-cut-hc250018', origin: 'Korea' }),
    hc({ stockId: 'HC250019', brand: 'Kia', brandSlug: 'kia', model: 'Sportage', year: 2019, engineCode: 'G4NA', transmissionCode: '6AT', drivetrain: '2WD', mileage: '77,000 km', status: 'Reserved', title: 'Kia Sportage G4NA Half Cut', slug: 'kia-sportage-2019-g4na-half-cut-hc250019', origin: 'Korea' }),
    hc({ stockId: 'HC250020', brand: 'Kia', brandSlug: 'kia', model: 'Carnival', year: 2018, engineCode: 'G6DA', transmissionCode: '6AT', drivetrain: '2WD', mileage: '112,000 km', status: 'Available', title: 'Kia Carnival G6DA Half Cut', slug: 'kia-carnival-2018-g6da-half-cut-hc250020', origin: 'Korea' }),
    hc({ stockId: 'HC250021', brand: 'Kia', brandSlug: 'kia', model: 'Rio', year: 2017, engineCode: 'G4FC', transmissionCode: '6AT', drivetrain: '2WD', mileage: '98,000 km', status: 'Available', title: 'Kia Rio G4FC Half Cut', slug: 'kia-rio-2017-g4fc-half-cut-hc250021', origin: 'Korea' }),

    hc({ stockId: 'HC250022', brand: 'Honda', brandSlug: 'honda', model: 'CR-V', year: 2019, engineCode: 'K24A', transmissionCode: 'CVT', drivetrain: 'AWD', mileage: '71,000 km', status: 'Available', title: 'Honda CR-V K24A Half Cut', slug: 'honda-crv-2019-k24a-half-cut-hc250022' }),
    hc({ stockId: 'HC250023', brand: 'Honda', brandSlug: 'honda', model: 'Accord', year: 2018, engineCode: 'K24A', transmissionCode: 'CVT', drivetrain: '2WD', mileage: '86,000 km', status: 'Available', title: 'Honda Accord K24A Half Cut', slug: 'honda-accord-2018-k24a-half-cut-hc250023' }),
    hc({ stockId: 'HC250024', brand: 'Honda', brandSlug: 'honda', model: 'Civic', year: 2017, engineCode: 'R18A', transmissionCode: '5AT', drivetrain: '2WD', mileage: '93,000 km', status: 'Sold', title: 'Honda Civic R18A Half Cut', slug: 'honda-civic-2017-r18a-half-cut-hc250024' }),

    hc({ stockId: 'HC250025', brand: 'Mitsubishi', brandSlug: 'mitsubishi', model: 'Triton', year: 2020, engineCode: '4N15', transmissionCode: '6AT', drivetrain: '4WD', mileage: '69,000 km', status: 'Available', title: 'Mitsubishi Triton 4N15 Half Cut', slug: 'mitsubishi-triton-2020-4n15-half-cut-hc250025' }),
    hc({ stockId: 'HC250026', brand: 'Mitsubishi', brandSlug: 'mitsubishi', model: 'Pajero Sport', year: 2019, engineCode: '4M41', transmissionCode: '5AT', drivetrain: '4WD', mileage: '88,000 km', status: 'Available', title: 'Mitsubishi Pajero 4M41 Half Cut', slug: 'mitsubishi-pajero-2019-4m41-half-cut-hc250026' }),
    hc({ stockId: 'HC250027', brand: 'Mitsubishi', brandSlug: 'mitsubishi', model: 'Lancer', year: 2016, engineCode: '4B11', transmissionCode: 'CVT', drivetrain: '2WD', mileage: '105,000 km', status: 'Reserved', title: 'Mitsubishi Lancer 4B11 Half Cut', slug: 'mitsubishi-lancer-2016-4b11-half-cut-hc250027' }),

    hc({ stockId: 'HC250028', brand: 'Lexus', brandSlug: 'lexus', model: 'RX350', year: 2018, engineCode: '2GR-FE', transmissionCode: '6AT', drivetrain: 'AWD', mileage: '76,000 km', status: 'Available', title: 'Lexus RX350 2GR-FE Half Cut', slug: 'lexus-rx350-2018-2gr-fe-half-cut-hc250028', origin: 'Japan' }),
    hc({ stockId: 'HC250029', brand: 'Lexus', brandSlug: 'lexus', model: 'LX570', year: 2017, engineCode: '3UR-FE', transmissionCode: '8AT', drivetrain: '4WD', mileage: '124,000 km', status: 'Available', title: 'Lexus LX570 3UR-FE Half Cut', slug: 'lexus-lx570-2017-3ur-fe-half-cut-hc250029', origin: 'Japan' }),

    hc({ stockId: 'HC250030', brand: 'BMW', brandSlug: 'bmw', model: 'X5', year: 2018, engineCode: 'N55', transmissionCode: '8AT', drivetrain: 'AWD', mileage: '92,000 km', status: 'Available', title: 'BMW X5 N55 Half Cut', slug: 'bmw-x5-2018-n55-half-cut-hc250030', origin: 'Germany' }),
    hc({ stockId: 'HC250031', brand: 'BMW', brandSlug: 'bmw', model: '320i', year: 2016, engineCode: 'N20', transmissionCode: '8AT', drivetrain: 'RWD', mileage: '108,000 km', status: 'Available', title: 'BMW 320i N20 Half Cut', slug: 'bmw-320i-2016-n20-half-cut-hc250031', origin: 'Germany' }),

    hc({ stockId: 'HC250032', brand: 'Mercedes-Benz', brandSlug: 'mercedes-benz', model: 'C200', year: 2019, engineCode: 'M274', transmissionCode: '9AT', drivetrain: 'RWD', mileage: '64,000 km', status: 'Available', title: 'Mercedes-Benz C200 M274 Half Cut', slug: 'mercedes-c200-2019-m274-half-cut-hc250032', origin: 'Germany' }),
    hc({ stockId: 'HC250033', brand: 'Mercedes-Benz', brandSlug: 'mercedes-benz', model: 'E300', year: 2018, engineCode: 'M274', transmissionCode: '9AT', drivetrain: 'RWD', mileage: '78,000 km', status: 'Reserved', title: 'Mercedes-Benz E300 M274 Half Cut', slug: 'mercedes-e300-2018-m274-half-cut-hc250033', origin: 'Germany' }),
    hc({ stockId: 'HC250034', brand: 'Mercedes-Benz', brandSlug: 'mercedes-benz', model: 'GLC250', year: 2020, engineCode: 'M274', transmissionCode: '9AT', drivetrain: '4MATIC', mileage: '59,000 km', status: 'Available', title: 'Mercedes-Benz GLC M274 Half Cut', slug: 'mercedes-glc-2020-m274-half-cut-hc250034', origin: 'Germany' }),
  ];

  const HALF_CUT_LIST = SEED_HALF_CUT_LIST.slice();
  let bySlug = Object.fromEntries(HALF_CUT_LIST.map(item => [item.slug, item]));

  function rebuildHalfCutList(list) {
    HALF_CUT_LIST.splice(0, HALF_CUT_LIST.length, ...list);
    bySlug = Object.fromEntries(HALF_CUT_LIST.map(item => [item.slug, item]));
    window.HALF_CUT_BY_SLUG = bySlug;
  }

  function photoUrl(photo) {
    if (!photo) return '';
    const url = typeof photo === 'string' ? photo : (photo.url || '');
    if (!url || /^data:(image|video)\//i.test(url)) return '';
    return url;
  }

  function firstPhotoUrl(item) {
    if (!hasPhotos(item)) return '';
    return photoUrl(item.photos[0]);
  }

  const STATUS_ORDER = { Available: 0, Reserved: 1, 'In Transit': 2, Sold: 3 };

  function getHalfCutBySlug(slug) {
    const item = bySlug[slug] || null;
    if (!item) return null;
    if (window.HalfCutInventoryLayer?.toPublicItem && item.vin) {
      return window.HalfCutInventoryLayer.toPublicItem(item);
    }
    return item;
  }

  function getHalfCutBySlugInternal(slug) {
    return bySlug[slug] || null;
  }

  function getHalfCutsByBrandSlug(brandSlug) {
    return HALF_CUT_LIST
      .filter(item => item.brandSlug === brandSlug)
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
      .map(item => getHalfCutBySlug(item.slug) || item);
  }

  function getHalfCutBrands() {
    const seen = new Map();
    HALF_CUT_LIST.forEach(item => {
      if (!seen.has(item.brandSlug)) seen.set(item.brandSlug, item.brand);
    });
    return Array.from(seen, ([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function detailUrl(base, slug) {
    return `${base}half-cuts/detail.html?slug=${encodeURIComponent(slug)}`;
  }

  function enginePageUrl(base, item) {
    if (!window.SitePaths?.enginePagePath) return null;
    const page = window.SitePaths.enginePagePath(item.brandSlug, item.engineCode);
    return page ? base + page : null;
  }

  function statusSlug(status) {
    return String(status || '').toLowerCase().replace(/\s+/g, '-');
  }

  function isAvailable(item) {
    return item.status === 'Available';
  }

  function isReserved(item) {
    return item.status === 'Reserved';
  }

  function isSold(item) {
    return item.status === 'Sold';
  }

  function isInTransit(item) {
    return item.status === 'In Transit';
  }

  function hasPhotos(item) {
    return Array.isArray(item.photos) && item.photos.length > 0;
  }

  function videoSource(item) {
    if (!item) return '';
    const url = item.video?.url || item.videoUrl || '';
    if (!url || /^data:(image|video)\//i.test(url)) return '';
    return url;
  }

  function videoMimeType(item) {
    if (item?.video?.mimeType) return item.video.mimeType;
    const src = videoSource(item);
    if (/\.webm(\?|$)/i.test(src)) return 'video/webm';
    if (/\.mov(\?|$)/i.test(src)) return 'video/quicktime';
    return 'video/mp4';
  }

  function hasVideo(item) {
    return !!videoSource(item);
  }

  function renderVideoPlayer(item, options) {
    const src = videoSource(item);
    if (!src) return '';
    const opts = options || {};
    const className = opts.className || 'half-cut-video';
    const title = opts.title || 'Vehicle walkthrough video';
    const mime = videoMimeType(item);
    const typeAttr = mime ? ` type="${mime}"` : '';
    return `
      <div class="${className}">
        <video class="${className}__player" controls playsinline preload="metadata" aria-label="${title.replace(/"/g, '&quot;')}">
          <source src="${src}"${typeAttr}>
          Your browser does not support embedded video.
        </video>
      </div>`;
  }

  const INVENTORY_DISCLAIMER = 'Inventory is subject to final confirmation. Photos, price and shipping cost are confirmed on request before export.';

  function whatsappMessage(item) {
    const lines = [
      'Hello AsiaPower,',
      `Stock ID: ${item.stockId}`,
      `Brand: ${item.brand}`,
      `Model: ${item.model}`,
      `Engine: ${item.engineCode}`,
      `Transmission: ${item.transmissionCode}`,
    ];
    if (isAvailable(item)) {
      lines.push('Destination country: [please advise]');
      lines.push('Please send price, photos and shipping options.');
    } else if (isReserved(item)) {
      lines.push('This unit is marked Reserved. Please confirm availability or send similar options.');
      lines.push('Destination country: [please advise]');
    } else {
      lines.push('This unit is marked Sold. Please send similar available units.');
      lines.push('Destination country: [please advise]');
    }
    return lines.join('\n');
  }

  function similarUnitMessage(item) {
    return [
      'Hello AsiaPower,',
      `Stock ID: ${item.stockId}`,
      `Brand: ${item.brand}`,
      `Model: ${item.model}`,
      `Engine: ${item.engineCode}`,
      `Transmission: ${item.transmissionCode}`,
      `Reference listing (${item.status}). Please send similar available units.`,
      'Destination country: [please advise]',
    ].join('\n');
  }

  function photosMessage(item) {
    return [
      'Hello AsiaPower,',
      `Stock ID: ${item.stockId}`,
      `Brand: ${item.brand}`,
      `Model: ${item.model}`,
      `Engine: ${item.engineCode}`,
      `Transmission: ${item.transmissionCode}`,
      'Please send photos for this half-cut listing.',
      'Destination country: [please advise]',
    ].join('\n');
  }

  function waUrl(text) {
    const c = window.ASIAPOWER;
    if (!c?.whatsapp) return '#';
    return `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(text)}`;
  }

  function whatsappUrl(item) {
    return waUrl(whatsappMessage(item));
  }

  function checkAvailabilityUrl(item) {
    return whatsappUrl(item);
  }

  function similarUnitUrl(item) {
    return waUrl(similarUnitMessage(item));
  }

  function requestPhotosUrl(item) {
    return waUrl(photosMessage(item));
  }

  function requestPriceUrl(base, item) {
    return `${base}contact.html?brand=${encodeURIComponent(item.brandSlug)}&product=${encodeURIComponent(item.stockId)}`;
  }

  function seoTitle(item) {
    const core = `${item.year} ${item.brand} ${item.model} Half Cut ${item.engineCode} ${item.transmissionCode}`;
    if (isReserved(item)) return `${core} — Reserved | AsiaPower`;
    if (isSold(item)) return `${core} — Sold | AsiaPower`;
    return `${core} | AsiaPower`;
  }

  function seoDescription(item) {
    if (isAvailable(item)) {
      return `${item.brand} ${item.model} half cut listing with ${item.engineCode} engine and ${item.transmissionCode} transmission. Request price, photos and shipping from AsiaPower. Stock ID ${item.stockId}.`;
    }
    if (isReserved(item)) {
      return `Reserved ${item.brand} ${item.model} half cut reference — ${item.engineCode} / ${item.transmissionCode}. Confirm availability or request similar units. Stock ID ${item.stockId}.`;
    }
    return `Sold ${item.brand} ${item.model} half cut reference — ${item.engineCode} / ${item.transmissionCode}. Request similar available units. Stock ID ${item.stockId}.`;
  }

  function heroIntro(item) {
    if (isReserved(item)) {
      return `${item.shortDescription} This listing is marked Reserved — availability is confirmed on enquiry.`;
    }
    if (isSold(item)) {
      return `${item.shortDescription} This listing is marked Sold — use as a reference or request a similar unit.`;
    }
    return `${item.shortDescription} Availability is confirmed on enquiry before quotation.`;
  }

  function productJsonLd(item, canonical) {
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: item.title,
      description: item.shortDescription,
      sku: item.stockId,
      brand: { '@type': 'Brand', name: item.brand },
    };
    if (isAvailable(item)) {
      product.offers = {
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        priceCurrency: 'USD',
        url: canonical,
      };
    } else if (isReserved(item)) {
      product.offers = {
        '@type': 'Offer',
        availability: 'https://schema.org/LimitedAvailability',
        priceCurrency: 'USD',
        url: canonical,
      };
    }
    return product;
  }

  function renderCardActions(item, base) {
    const detail = detailUrl(base, item.slug);
    if (isAvailable(item)) {
      return `
        <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
        <a href="${requestPriceUrl(base, item)}" class="btn btn-outline-navy btn-sm">${t('hc.requestPrice', 'Request Price')}</a>
        <a href="${requestPhotosUrl(item)}" class="btn btn-outline-navy btn-sm" target="_blank" rel="noopener noreferrer">${t('hc.requestPhotos', 'Request Photos')}</a>
        <a href="${whatsappUrl(item)}" class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener noreferrer">WhatsApp</a>`;
    }
    if (isReserved(item)) {
      return `
        <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
        <a href="${checkAvailabilityUrl(item)}" class="btn btn-accent btn-sm" target="_blank" rel="noopener noreferrer">${t('hc.checkAvailability', 'Check Availability')}</a>
        <a href="${similarUnitUrl(item)}" class="btn btn-outline-navy btn-sm" target="_blank" rel="noopener noreferrer">${t('hc.requestSimilar', 'Request Similar Unit')}</a>`;
    }
    if (isInTransit(item)) {
      return `
        <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
        <a href="${checkAvailabilityUrl(item)}" class="btn btn-accent btn-sm" target="_blank" rel="noopener noreferrer">${t('hc.checkAvailability', 'Check Availability')}</a>
        <a href="${similarUnitUrl(item)}" class="btn btn-outline-navy btn-sm" target="_blank" rel="noopener noreferrer">${t('hc.requestSimilar', 'Request Similar Unit')}</a>`;
    }
    return `
      <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
      <a href="${similarUnitUrl(item)}" class="btn btn-accent btn-sm" target="_blank" rel="noopener noreferrer">${t('hc.requestSimilar', 'Request Similar Unit')}</a>`;
  }

  function renderDetailActions(item, base) {
    if (isAvailable(item)) {
      return `
        <a href="${requestPriceUrl(base, item)}" class="btn btn-accent">${t('hc.requestPrice', 'Request Price')}</a>
        <a href="${requestPhotosUrl(item)}" class="btn btn-outline-navy" target="_blank" rel="noopener noreferrer">${t('hc.requestPhotos', 'Request Photos')}</a>
        <a href="${whatsappUrl(item)}" class="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a>`;
    }
    if (isReserved(item)) {
      return `
        <a href="${checkAvailabilityUrl(item)}" class="btn btn-accent" target="_blank" rel="noopener noreferrer">${t('hc.checkAvailability', 'Check Availability')}</a>
        <a href="${similarUnitUrl(item)}" class="btn btn-outline-navy" target="_blank" rel="noopener noreferrer">${t('hc.requestSimilar', 'Request Similar Unit')}</a>`;
    }
    if (isInTransit(item)) {
      return `
        <a href="${checkAvailabilityUrl(item)}" class="btn btn-accent" target="_blank" rel="noopener noreferrer">${t('hc.checkAvailability', 'Check Availability')}</a>
        <a href="${similarUnitUrl(item)}" class="btn btn-outline-navy" target="_blank" rel="noopener noreferrer">${t('hc.requestSimilar', 'Request Similar Unit')}</a>`;
    }
    return `
      <a href="${similarUnitUrl(item)}" class="btn btn-accent" target="_blank" rel="noopener noreferrer">${t('hc.requestSimilar', 'Request Similar Unit')}</a>`;
  }

  window.SEED_HALF_CUT_LIST = SEED_HALF_CUT_LIST;
  window.HALF_CUT_LIST = HALF_CUT_LIST;
  window.HALF_CUT_BY_SLUG = bySlug;
  window.HalfCutDirectory = { SEED_HALF_CUT_LIST, rebuildHalfCutList };
  window.getHalfCutBySlug = getHalfCutBySlug;
  window.getHalfCutBySlugInternal = getHalfCutBySlugInternal;
  window.getHalfCutsByBrandSlug = getHalfCutsByBrandSlug;
  window.getHalfCutBrands = getHalfCutBrands;
  window.HalfCutUtils = {
    detailUrl,
    whatsappUrl,
    whatsappMessage,
    similarUnitUrl,
    similarUnitMessage,
    checkAvailabilityUrl,
    requestPhotosUrl,
    requestPriceUrl,
    enginePageUrl,
    statusSlug,
    hasPhotos,
    photoUrl,
    firstPhotoUrl,
    hasVideo,
    videoSource,
    videoMimeType,
    renderVideoPlayer,
    maskVin: (vin) => window.HalfCutVin?.maskVin(vin) || '',
    toPublicItem: (item) => {
      if (item?.vin && window.HalfCutInventoryLayer?.toPublicItem) {
        return window.HalfCutInventoryLayer.toPublicItem(item);
      }
      return item;
    },
    INVENTORY_DISCLAIMER,
    get inventoryDisclaimer() {
      return window.PublicI18n?.inventoryDisclaimer?.() || INVENTORY_DISCLAIMER;
    },
    seoTitle,
    seoDescription,
    heroIntro,
    productJsonLd,
    renderCardActions,
    renderDetailActions,
  };
})();
