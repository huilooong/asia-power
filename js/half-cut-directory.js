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
    bySlug = {};
    HALF_CUT_LIST.forEach((item) => {
      if (!item?.slug) return;
      bySlug[item.slug] = item;
      (item.slugAliases || []).forEach((alias) => {
        if (alias) bySlug[alias] = item;
      });
    });
    window.HALF_CUT_BY_SLUG = bySlug;
  }

  function photoUrl(photo) {
    if (!photo) return '';
    const url = typeof photo === 'string' ? photo : (photo.url || '');
    if (!url || /^data:(image|video)\//i.test(url)) return '';
    return url;
  }

  function isUnstableThumbUrl(url) {
    if (!url) return true;
    return String(url).split('?')[0].includes('/uploads/pending/');
  }

  function thumbPhotoUrl(photo) {
    if (!photo) return '';
    if (typeof photo === 'object' && photo.thumbUrl && !isUnstableThumbUrl(photo.thumbUrl)) {
      return photo.thumbUrl;
    }
    return photoUrl(photo);
  }

  function firstPhotoUrl(item) {
    if (!hasPhotos(item)) return '';
    return photoUrl(item.photos[0]);
  }

  function firstPhotoThumbUrl(item) {
    if (!hasPhotos(item)) return '';
    return thumbPhotoUrl(item.photos[0]);
  }

  const STATUS_ORDER = { Available: 0, Reserved: 1, 'In Transit': 2, Sold: 3 };

  function getHalfCutBySlug(slug) {
    if (!slug) return null;
    let item = bySlug[slug] || null;
    if (!item) {
      const stockMatch = String(slug).match(/(hc\d+)/i);
      if (stockMatch) {
        const stockId = stockMatch[0].toUpperCase();
        item = HALF_CUT_LIST.find((entry) => String(entry.stockId || '').toUpperCase() === stockId) || null;
      }
    }
    if (!item) return null;
    if (window.HalfCutInventoryLayer?.toPublicItem && item.vin) {
      return window.HalfCutInventoryLayer.toPublicItem(item);
    }
    return item;
  }

  function getHalfCutBySlugInternal(slug) {
    return bySlug[slug] || null;
  }

  function isMachineryLike(item) {
    if (!item) return false;
    if (item.vehicleCategory === 'machinery') return true;
    if (String(item.machineryType || '').trim()) return true;
    const slug = String(item.slug || '');
    if (slug.includes('-machinery-')) return true;
    const condition = String(item.vehicleCondition || '');
    if (/wheel loader|excavator|bulldozer|motor grader|backhoe|forklift|roller|compactor|mobile crane|construction equipment/i.test(condition)) {
      return true;
    }
    return false;
  }

  function inventorySegment(item) {
    const meta = window.HalfCutUploadLayer?.resolveListingMeta?.(item);
    if (meta?.vehicleCategory === 'machinery') return 'machinery';
    if (isMachineryLike(item)) return 'machinery';
    if (looksLikePassengerMisTag(item)) return item?.vehicleCategory === 'machinery' ? 'machinery' : 'passenger';
    if (meta?.vehicleCategory === 'truck') return 'truck';
    if (item?.vehicleCategory === 'truck') return 'truck';
    const slug = String(item?.slug || '');
    if (slug.includes('-truck-cab-') || slug.includes('-truck-half-cut-')) return 'truck';
    if (String(item?.title || '').includes('Driver Cab')) return 'truck';
    return item?.vehicleCategory || 'passenger';
  }

  function looksLikePassengerMisTag(item) {
    const brand = String(item?.brand || '');
    const model = String(item?.model || '');
    const blob = `${brand} ${model}`.toLowerCase();
    const passengerOem = ['吉利', '雪佛兰', '别克', '福特', '大众', '马自达', '哈弗', '长安', '猎豹', '宝马', '奥迪', '丰田', '本田', '日产', '现代', '起亚', '荣威', '名爵', '比亚迪', '奇瑞', '长城', '传祺', '五菱', '宝骏', '路虎', '捷豹', 'toyota', 'honda', 'ford', 'chevrolet', 'buick', 'geely', 'haval', 'mazda', 'volkswagen', 'bmw', 'audi', 'lexus', 'jeep', 'porsche', 'jaguar', 'land rover', 'landrover', 'liebao', 'byd', 'mg', 'roewe'];
    if (!passengerOem.some((b) => brand.includes(b) || blob.includes(b.toLowerCase()))) return false;
    if (/\b(truck|giga|elf|nqr|npr|howo|t7|f3000|m3000)\b/i.test(blob)) return false;
    return true;
  }

  function isTruckItem(item) {
    return inventorySegment(item) === 'truck';
  }

  function isMachineryItem(item) {
    return inventorySegment(item) === 'machinery';
  }

  const USED_CAR_EXPORT_REMARK_KEYWORDS = [
    '可整车出口',
    '可做整车出口',
    '整车可出口',
    '整车可以出口',
    '整车出口',
    '可整车出售',
    '可整车交货',
    '可整车',
    '有手续',
    '手续齐全',
    '手续全',
    '正规手续',
    '可出口',
  ];

  function itemRemarkText(item) {
    if (!item) return '';
    return [
      item.notes,
      item.shortDescription,
      item.qxb?.description,
    ].filter(Boolean).join('\n');
  }

  function normalizeRemarkText(text) {
    return String(text || '')
      .replace(/\s+/g, '')
      .replace(/[，,。.；;：:、]/g, '');
  }

  function hasExportReadyRemark(item) {
    const text = normalizeRemarkText(itemRemarkText(item));
    if (!text) return false;
    return USED_CAR_EXPORT_REMARK_KEYWORDS.some((kw) => text.includes(normalizeRemarkText(kw)));
  }

  /**
   * Canonical passenger-parts discriminator.
   * Explicit inventory fields win; slug/condition are legacy fallbacks only.
   */
  function passengerInventoryPartType(item) {
    if (!item) return '';
    const explicit = String(item.passengerPartType || '').trim().toLowerCase();
    if (['front', 'engine', 'transmission', 'chassis', 'other'].includes(explicit)) return explicit;

    const slug = String(item.slug || '').toLowerCase();
    if (slug.includes('-passenger-engine-')) return 'engine';
    if (slug.includes('-passenger-transmission-')) return 'transmission';
    if (slug.includes('-passenger-chassis-')) return 'chassis';
    if (slug.includes('-front-cut-')) return 'front';
    if (slug.includes('-passenger-part-')) return 'other';

    const cond = String(item.vehicleCondition || '').trim().toLowerCase();
    if (cond === 'engine assembly') return 'engine';
    if (cond === 'transmission assembly') return 'transmission';
    if (cond === 'chassis part') return 'chassis';
    if (cond === 'front cut' || cond.includes('nose cut')) return 'front';
    if (cond === 'part') return 'other';
    return '';
  }

  function isHalfCutLikeListing(item) {
    if (!item) return false;
    const slug = String(item.slug || '').toLowerCase();
    if (/(^|-)(half-cut|front-cut|passenger-engine|passenger-transmission|passenger-chassis|passenger-part)(-|$)/.test(slug)) {
      return true;
    }
    const cond = String(item.vehicleCondition || '').trim().toLowerCase();
    if (cond === 'half cut' || cond.includes('nose cut') || cond.includes('front cut')) return true;
    const partType = String(item.passengerPartType || '').trim().toLowerCase();
    if (partType && partType !== 'vehicle') return true;
    const title = String(item.title || '').toLowerCase();
    return title.includes('half cut') || title.includes('half-cut') || title.includes('front cut');
  }

  function isUsedCarItem(item) {
    if (!item || isTruckItem(item) || isMachineryItem(item)) return false;
    if (isHalfCutLikeListing(item)) return false;
    const cond = String(item.vehicleCondition || '').trim().toLowerCase();
    if (cond === 'running vehicle') return true;
    const title = String(item.title || '').toLowerCase();
    return !title.includes('half cut') && !title.includes('half-cut');
  }

  function isExportableUsedCarItem(item) {
    if (!item || isTruckItem(item) || isMachineryItem(item)) return false;
    if (item.isExportUsedCar === true) return true;
    if (hasExportReadyRemark(item)) return true;
    if (isHalfCutLikeListing(item)) return false;
    const cond = String(item.vehicleCondition || '').trim().toLowerCase();
    return cond === 'running vehicle';
  }

  function isPassengerHalfCutItem(item) {
    if (!item || isTruckItem(item) || isMachineryItem(item)) return false;
    if (isExportableUsedCarItem(item)) return false;
    const partType = passengerInventoryPartType(item);
    return !partType || partType === 'front';
  }

  const CHASSIS_CATALOG_EVIDENCE_RE = /\b(chassis|subframe|suspension|crossmember|axle)\b|底盘|车架|前桥|后桥|悬挂|转向/i;

  function chassisCatalogEvidenceText(item) {
    return [
      item?.title,
      item?.shortDescription,
      item?.originalVehicleName,
      ...(Array.isArray(item?.includedParts) ? item.includedParts : [item?.includedParts]),
      ...(Array.isArray(item?.photos)
        ? item.photos.map((photo) => (typeof photo === 'object' && photo ? photo.label : ''))
        : []),
    ].filter(Boolean).join(' ');
  }

  /**
   * Chassis catalog admission is evidence-based:
   * - dedicated chassis uploads always qualify;
   * - a real passenger half/front cut qualifies only when its public listing
   *   explicitly says a chassis-related section is included.
   * Dedicated engines/transmissions/other parts can never enter by keywords.
   */
  function hasChassisCatalogEvidence(item) {
    if (!item || isTruckItem(item) || isMachineryItem(item)) return false;
    const partType = passengerInventoryPartType(item);
    if (partType === 'chassis') return true;
    if (partType && partType !== 'front') return false;
    if (!isPassengerHalfCutItem(item)) return false;
    return CHASSIS_CATALOG_EVIDENCE_RE.test(chassisCatalogEvidenceText(item));
  }

  /**
   * Mutually exclusive dedicated-part rules with one intentional exception:
   * a real donor cut may also feed engine/gearbox/chassis catalogs when the
   * corresponding code or explicit public chassis evidence exists.
   */
  function matchesInventoryCategory(item, category) {
    if (!item || isTruckItem(item) || isMachineryItem(item)) return false;
    const partType = passengerInventoryPartType(item);
    if (category === 'halfcuts' || category === 'frontcuts') {
      return isPassengerHalfCutItem(item);
    }
    if (category === 'chassis') return hasChassisCatalogEvidence(item);
    if (category === 'engines') {
      if (partType) return partType === 'engine';
      return isPassengerHalfCutItem(item) && Boolean(String(item.engineCode || '').trim());
    }
    if (category === 'gearboxes') {
      if (partType) return partType === 'transmission';
      return isPassengerHalfCutItem(item) && Boolean(String(item.transmissionCode || '').trim());
    }
    return false;
  }

  /** stock-id-search-v1: Stock-ID search must work across categories (HC250551 / 250551 / hc250551). */
  /** catalog-search-v1: model / engine / VIN / CN aliases also span categories from header search. */
  function normalizeStockIdQuery(query) {
    return String(query || '').trim().toUpperCase();
  }

  function isStockIdQuery(query) {
    const q = normalizeStockIdQuery(query);
    if (!q) return false;
    if (/^(HC|UV)\d{3,}$/i.test(q)) return true;
    // Pure digits: ≥4 avoids noisy 2–3 digit brand/year hits
    return /^\d{4,}$/.test(q);
  }

  function stockIdDigits(stockId) {
    const sid = String(stockId || '').trim().toUpperCase();
    const m = sid.match(/^(?:HC|UV)?(\d+)$/i);
    return m ? m[1] : '';
  }

  function matchesStockId(item, query) {
    const q = normalizeStockIdQuery(query);
    if (!q) return false;
    const sid = String(item?.stockId || '').trim().toUpperCase();
    if (!sid) return false;
    if (sid === q) return true;
    const digits = stockIdDigits(sid);
    if (!digits) return false;
    if (/^\d+$/.test(q)) {
      if (digits === q) return true;
      if (q.length >= 4 && digits.endsWith(q)) return true;
      return false;
    }
    if (/^(HC|UV)\d+$/i.test(q)) {
      return digits === q.replace(/^(HC|UV)/i, '');
    }
    return false;
  }

  function normalizeCatalogSearch(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\s-/]+/g, '');
  }

  function buildCatalogSearchHaystack(item) {
    return [
      item?.stockId,
      item?.brand,
      item?.brandSlug,
      item?.model,
      item?.engineCode,
      item?.transmissionCode,
      item?.gearboxModel,
      item?.title,
      item?.originalVehicleName,
      item?.shortDescription,
      item?.vin,
      item?.maskedVin,
      item?.slug,
      item?.fuelType,
    ]
      .map((v) => String(v || ''))
      .join(' ')
      .toLowerCase();
  }

  function catalogSearchAliasMap() {
    return window.AsiaPowerCatalogSearchAliases || {};
  }

  function expandCatalogSearchTerms(query) {
    const raw = String(query || '').trim();
    if (!raw) return [];
    const terms = new Set([raw, raw.toLowerCase()]);
    const aliases = catalogSearchAliasMap();
    const direct = aliases[raw] || aliases[raw.toLowerCase()];
    if (direct) {
      terms.add(direct);
      terms.add(String(direct).toLowerCase());
    }
    // Multi-char Chinese nicknames inside a longer query (e.g. "丰田霸道")
    Object.keys(aliases).forEach((zh) => {
      if (!/[\u4e00-\u9fff]/.test(zh)) return;
      if (zh.length >= 2 && raw.includes(zh)) {
        const en = aliases[zh];
        if (en) {
          terms.add(en);
          terms.add(String(en).toLowerCase());
        }
      }
    });
    return [...terms];
  }

  function matchesCatalogSearch(item, query) {
    if (!query) return true;
    if (isStockIdQuery(query) && matchesStockId(item, query)) return true;
    const hay = buildCatalogSearchHaystack(item);
    const hayN = normalizeCatalogSearch(hay);
    for (const term of expandCatalogSearchTerms(query)) {
      const t = String(term || '').toLowerCase().trim();
      if (!t) continue;
      if (hay.includes(t)) return true;
      // Collapsed match only for longer tokens — short codes like CDL must not
      // hit "Automatic DLX" after space stripping (…automaticdlx…).
      const tn = normalizeCatalogSearch(t);
      if (tn.length >= 4 && hayN.includes(tn)) return true;
    }
    return false;
  }

  function findInventoryByStockIdQuery(query, list) {
    if (!isStockIdQuery(query)) return [];
    const items = list || HALF_CUT_LIST || [];
    return items.filter((item) => matchesStockId(item, query));
  }

  function findInventoryByCatalogQuery(query, list) {
    const q = String(query || '').trim();
    if (!q) return [];
    const items = list || HALF_CUT_LIST || [];
    return items.filter((item) => matchesCatalogSearch(item, q));
  }

  function mergeCatalogSearchHitsIntoInventory(items, query) {
    const base = Array.isArray(items) ? items.slice() : [];
    const q = String(query || '').trim();
    if (!q) return base;
    const hits = findInventoryByCatalogQuery(q);
    if (!hits.length) return base;
    const seen = new Set(base.map((item) => String(item?.stockId || '').toUpperCase()).filter(Boolean));
    hits.forEach((hit) => {
      const key = String(hit?.stockId || '').toUpperCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      base.push(hit);
    });
    return base;
  }

  /** @deprecated use mergeCatalogSearchHitsIntoInventory — kept for callers / deploy markers */
  function mergeStockIdHitsIntoInventory(items, query) {
    return mergeCatalogSearchHitsIntoInventory(items, query);
  }

  function parseCatalogRoute(search) {
    const pathCategory = categoryFromPathname();
    const params = new URLSearchParams(search || window.location.search);
    const catParam = params.get('cat');
    const brandParam = params.get('brand');
    const qRaw = params.get('q') || '';
    const qNorm = decodeURIComponent(qRaw.replace(/\+/g, ' ')).toLowerCase().trim();
    const categoryAliases = {
      'used-cars': ['used-cars', 'used car', 'usedcar', 'used-car', '二手车', '出口二手车'],
      trucks: ['trucks', 'truck', '卡车'],
      machinery: ['machinery', '工程机械', 'excavator'],
      halfcuts: ['halfcuts', 'half-cuts', 'half cut', '半切车'],
    };

    let category = pathCategory || 'halfcuts';
    if (catParam && categoryAliases[catParam]) {
      category = catParam;
    } else if (!pathCategory) {
      for (const [cat, aliases] of Object.entries(categoryAliases)) {
        if (aliases.includes(qNorm)) {
          category = cat;
          break;
        }
      }
    }

    const isAlias = Object.values(categoryAliases).some((aliases) => aliases.includes(qNorm));
    const searchQuery = qRaw && !isAlias ? qRaw : '';

    return { category, searchQuery, brand: brandParam || '' };
  }

  function categoryFromPathname() {
    const path = String(window.location.pathname || '').toLowerCase();
    if (/\/trucks\/?$/.test(path) || path.endsWith('/trucks/index.html')) return 'trucks';
    if (/\/machinery\/?$/.test(path) || path.endsWith('/machinery/index.html')) return 'machinery';
    return null;
  }

  function inventoryForCatalogCategory(category) {
    const list = HALF_CUT_LIST || [];
    if (category === 'trucks') return filterInventoryBySegment(list, 'truck');
    if (category === 'machinery') return filterInventoryBySegment(list, 'machinery');
    if (category === 'used-cars') return filterInventoryBySegment(list, 'passenger').filter(isExportableUsedCarItem);
    return filterInventoryBySegment(list, 'passenger').filter(isPassengerHalfCutItem);
  }

  function brandSegmentForCategory(category) {
    if (category === 'trucks') return 'truck';
    if (category === 'machinery') return 'machinery';
    return 'passenger';
  }

  function filterInventoryBySegment(list, segment) {
    const items = list || HALF_CUT_LIST;
    if (segment === 'truck') return items.filter(isTruckItem);
    if (segment === 'machinery') return items.filter(isMachineryItem);
    if (segment === 'passenger') {
      return items.filter((item) => !isTruckItem(item) && !isMachineryItem(item));
    }
    return items.slice();
  }

  function getHalfCutsByBrandSlug(brandSlug, segment = 'passenger') {
    return filterInventoryBySegment(HALF_CUT_LIST, segment)
      .filter(item => item.brandSlug === brandSlug)
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
      .map(item => getHalfCutBySlug(item.slug) || item);
  }

  function getCatalogBrands() {
    if (window.VehicleCatalog?.getBrands) {
      return window.VehicleCatalog.getBrands();
    }
    const dir = window.ASIAPOWER?.brandsDirectory || [];
    return dir.map((b) => ({ name: b.name, slug: b.slug }));
  }

  function getHalfCutBrands(segment = 'passenger') {
    const seen = new Map();
    if (segment === 'truck' && window.TruckBrandCatalog?.getBrands) {
      window.TruckBrandCatalog.getBrands().forEach(({ name, slug }) => {
        seen.set(slug, name);
      });
    } else if (segment === 'machinery' && window.MachineryBrandCatalog?.getBrands) {
      window.MachineryBrandCatalog.getBrands().forEach(({ name, slug }) => {
        seen.set(slug, name);
      });
    } else {
      getCatalogBrands().forEach(({ name, slug }) => {
        seen.set(slug, name);
      });
    }
    filterInventoryBySegment(HALF_CUT_LIST, segment).forEach((item) => {
      if (!seen.has(item.brandSlug)) seen.set(item.brandSlug, item.brand);
    });
    return Array.from(seen, ([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
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
    if (item?.video?.mimeType === 'video/mp4') return 'video/mp4';
    if (item?.video?.mimeType === 'video/webm') return 'video/webm';
    const src = videoSource(item);
    if (/\.mp4(\?|$)/i.test(src)) return 'video/mp4';
    if (/\.webm(\?|$)/i.test(src)) return 'video/webm';
    if (/\.mov(\?|$)/i.test(src) || item?.video?.mimeType === 'video/quicktime') return '';
    return item?.video?.mimeType || 'video/mp4';
  }

  function isQuickTimeVideo(item) {
    const src = videoSource(item);
    return /\.mov(\?|$)/i.test(src) || item?.video?.mimeType === 'video/quicktime';
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
    const quickTime = isQuickTimeVideo(item);
    const fallbackText = window.PublicI18n?.t?.('hc.videoMovFallback', 'QuickTime (.mov) may not play in this browser.')
      || 'QuickTime (.mov) may not play in this browser.';
    const downloadText = window.PublicI18n?.t?.('hc.videoDownload', 'Download video')
      || 'Download video';
    const mp4Hint = window.PublicI18n?.t?.('hc.videoMp4Hint', 'Suppliers: upload MP4 for best compatibility.')
      || 'Suppliers: upload MP4 for best compatibility.';
    const fallback = quickTime
      ? `<p class="half-cut-video__fallback">${fallbackText} <a href="${src}" download>${downloadText}</a><span class="half-cut-video__fallback-hint">${mp4Hint}</span></p>`
      : '';
    const posterUrl = firstPhotoThumbUrl(item) || firstPhotoUrl(item);
    const posterAttr = posterUrl ? ` poster="${posterUrl.replace(/"/g, '&quot;')}"` : '';
    return `
      <div class="${className}">
        <video class="${className}__player" controls playsinline preload="none"${posterAttr} aria-label="${title.replace(/"/g, '&quot;')}">
          <source src="${src}"${typeAttr}>
          Your browser does not support embedded video.
        </video>
        ${fallback}
      </div>`;
  }

  const TRUST_COPY = 'Whole-vehicle startup video available before dismantling. Parts can be dismantled according to buyer requirements after confirmation.';
  const INVENTORY_DISCLAIMER = `${TRUST_COPY} Inventory is subject to final confirmation. Photos, price and shipping cost are confirmed on request before export.`;

  function exwPriceLine(item, { prefix = 'EXW Price' } = {}) {
    const priceLabel = formatFobPrice(item);
    if (priceLabel) return `${prefix}: ${priceLabel} USD`;
    return `${prefix}: on enquiry`;
  }

  function seoPriceSnippet(item) {
    const priceLabel = formatFobPrice(item);
    if (!priceLabel) return '';
    if (isSold(item)) return `Reference EXW ${priceLabel} USD`;
    return `EXW ${priceLabel} USD`;
  }

  function whatsappMessage(item) {
    const lines = [
      'Hello AsiaPower,',
      `Stock ID: ${item.stockId}`,
      `Brand: ${item.brand}`,
      `Model: ${item.model}`,
      `Engine: ${item.engineCode}`,
      `Transmission: ${item.transmissionCode}`,
      exwPriceLine(item),
      `Listing: ${listingSharePageUrl(item)}`,
    ];
    if (isAvailable(item)) {
      lines.push('Destination country: [please advise]');
      lines.push(formatFobPrice(item)
        ? 'Please send photos and shipping options.'
        : 'Please send price, photos and shipping options.');
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
      exwPriceLine(item),
      `Listing: ${listingSharePageUrl(item)}`,
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
      exwPriceLine(item),
      `Listing: ${listingSharePageUrl(item)}`,
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

  function listingSharePageUrl(item) {
    const base = window.SitePaths?.base?.() || '/';
    return absoluteUrl(detailUrl(base, item?.slug || ''));
  }

  function facebookShareUrl(item) {
    const pageUrl = listingSharePageUrl(item);
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
  }

  function facebookShareLink(item, className, label) {
    const safeUrl = String(facebookShareUrl(item) || '#').replace(/"/g, '&quot;');
    const slug = String(item?.slug || '').replace(/"/g, '&quot;');
    return `<a href="${safeUrl}" class="${className}" data-half-cut-fb data-slug="${slug}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  function leadLink(item, intent, className, label, partType) {
    const partAttr = partType
      ? ` data-part-type="${String(partType).replace(/"/g, '&quot;')}"`
      : '';
    return `<a href="#" class="${className}" data-half-cut-lead data-slug="${String(item.slug || '').replace(/"/g, '&quot;')}" data-intent="${String(intent || 'price').replace(/"/g, '&quot;')}"${partAttr}>${label}</a>`;
  }

  function waCaptureLink(item, url, className, label, intent) {
    const safeUrl = String(url || '#').replace(/"/g, '&quot;');
    const slug = String(item?.slug || '').replace(/"/g, '&quot;');
    const safeIntent = String(intent || 'whatsapp').replace(/"/g, '&quot;');
    return `<a href="${safeUrl}" class="${className}" data-half-cut-wa data-slug="${slug}" data-intent="${safeIntent}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  function whatsappLink(item, className, label) {
    return waCaptureLink(item, whatsappUrl(item), className, label, 'whatsapp');
  }

  function checkAvailabilityLink(item, className, label) {
    return waCaptureLink(item, checkAvailabilityUrl(item), className, label, 'availability');
  }

  function requestPriceUrl(base, item) {
    return `#half-cut-lead-${item.slug}`;
  }

  function listingTypeLabel(item) {
    if (item?.vehicleCategory === 'machinery') {
      return item.vehicleCondition || window.MachineryBrandCatalog?.typeLabel?.(item.machineryType) || 'Construction Equipment';
    }
    if (item?.truckPartType === 'cab') return 'Driver Cab';
    if (item?.vehicleCategory === 'truck') return 'Truck Half Cut';
    return 'Half Cut';
  }

  function seoTitle(item) {
    const displayTitle = listingTitle(item)
      || `${item.year} ${item.brand} ${item.model} ${listingTypeLabel(item)}`.replace(/\s+/g, ' ').trim();
    const core = displayTitle.replace(/\s+/g, ' ').trim();
    if (isReserved(item)) return `${core} — Reserved | AsiaPower`;
    if (isSold(item)) return `${core} — Sold | AsiaPower`;
    return `${core} | AsiaPower`;
  }

  function seoDescription(item) {
    const typeLabel = listingTypeLabel(item).toLowerCase();
    const priceSnippet = seoPriceSnippet(item);
    const pricePart = priceSnippet ? `${priceSnippet}. ` : '';
    if (item?.vehicleCategory === 'machinery') {
      const engineHint = item.engineCode ? ` — ${item.engineCode} engine` : '';
      const videoHint = hasVideo(item) ? ' Whole-vehicle startup video available before dismantling.' : '';
      if (isAvailable(item)) {
        return `${item.brand} ${item.model} ${typeLabel} export from China${engineHint}.${videoHint} ${pricePart}Photos and shipping on request. Stock ${item.stockId}.`;
      }
      if (isReserved(item)) {
        return `Reserved ${item.brand} ${item.model} ${typeLabel}${engineHint}. ${pricePart}Confirm availability or request similar units. Stock ${item.stockId}.`;
      }
      return `Sold ${item.brand} ${item.model} ${typeLabel} reference${engineHint}. ${pricePart}Request similar available units. Stock ${item.stockId}.`;
    }
    if (isAvailable(item)) {
      return `${item.brand} ${item.model} half cut — ${item.engineCode} / ${item.transmissionCode}. ${pricePart}Photos and shipping on request. Stock ID ${item.stockId}.`;
    }
    if (isReserved(item)) {
      return `Reserved ${item.brand} ${item.model} half cut — ${item.engineCode} / ${item.transmissionCode}. ${pricePart}Confirm availability or request similar units. Stock ID ${item.stockId}.`;
    }
    return `Sold ${item.brand} ${item.model} half cut — ${item.engineCode} / ${item.transmissionCode}. ${pricePart}Request similar available units. Stock ID ${item.stockId}.`;
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

  function absoluteUrl(path) {
    if (window.AsiaPowerSEO?.absoluteUrl) return window.AsiaPowerSEO.absoluteUrl(path);
    if (!path) return window.location.href;
    if (path.startsWith('http')) return path;
    const base = window.location.origin + (window.SitePaths?.base?.() || '/');
    try {
      return new URL(path, base).href;
    } catch {
      return window.location.href;
    }
  }

  function productImages(item, base) {
    const images = [];
    if (hasPhotos(item)) {
      item.photos.forEach(photo => {
        const url = photoUrl(photo);
        if (url) images.push(absoluteUrl(url));
      });
    }
    if (!images.length) {
      const fallback = window.ASIAPOWER?.merchantListing?.defaultProductImage
        || `${base}assets/images/supply-halfcut.jpg?v=img-v3`;
      images.push(absoluteUrl(fallback));
    }
    return images;
  }

  function parsePriceUsd(item) {
    const candidates = [item?.priceUsd, item?.priceUSD, item?.fobPriceUsd, item?.fobPrice, item?.price];
    for (const value of candidates) {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount > 0) return amount;
    }
    return null;
  }

  function listingSearchHeat(item, trendingQueries) {
    if (!Array.isArray(trendingQueries) || !trendingQueries.length) return 0;
    const tokens = [
      item?.stockId,
      item?.brand,
      item?.model,
      item?.engineCode,
      item?.transmissionCode,
      item?.brandSlug,
    ].filter(Boolean).map((v) => String(v).toLowerCase());
    const hay = tokens.join(' ');
    let score = 0;
    trendingQueries.forEach((query, index) => {
      const term = String(query || '').trim().toLowerCase();
      if (term.length < 2) return;
      const rankBoost = Math.max(1, trendingQueries.length - index);
      if (tokens.some((token) => token === term || term === token)) {
        score += 40 + rankBoost * 4;
        return;
      }
      if (hay.includes(term) || term.includes(hay)) {
        score += 24 + rankBoost * 2;
        return;
      }
      const compact = term.replace(/[\s\-_/]/g, '');
      const hayCompact = hay.replace(/[\s\-_/]/g, '');
      if (compact && hayCompact.includes(compact)) {
        score += 16 + rankBoost;
      }
    });
    return score;
  }

  function listingHeatScore(item, trendingQueries) {
    if (!item) return 0;
    let score = 0;
    if (item.status === 'Available') score += 40;
    else if (item.status === 'Reserved') score += 22;
    else if (item.status === 'In Transit') score += 12;

    if (hasPhotos(item)) score += 10;
    if (hasVideo(item)) score += 15;
    if (parsePriceUsd(item) != null) score += 12;

    const ts = Date.parse(item.listedAt || item.approvedAt || item.updatedAt || 0);
    if (Number.isFinite(ts) && ts > 0) {
      const days = Math.max(0, (Date.now() - ts) / 86400000);
      score += Math.max(0, 18 - Math.floor(days / 4));
    }

    score += listingSearchHeat(item, trendingQueries);
    return score;
  }

  function compareListingHeat(a, b, trendingQueries) {
    const diff = listingHeatScore(b, trendingQueries) - listingHeatScore(a, trendingQueries);
    if (diff !== 0) return diff;
    return String(b?.stockId || '').localeCompare(String(a?.stockId || ''), undefined, { numeric: true });
  }

  function sortByListingHeat(items, trendingQueries) {
    return (items || []).slice().sort((a, b) => compareListingHeat(a, b, trendingQueries));
  }

  function formatFobPrice(item) {
    const amount = parsePriceUsd(item);
    if (amount == null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatPartPriceUsd(item, ratio) {
    const whole = parsePriceUsd(item);
    if (whole == null || !Number.isFinite(ratio) || ratio <= 0) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Math.round(whole * ratio));
  }

  const PART_PRICE_RATIOS = {
    engine: 0.65,
    transmission: 0.35,
    chassis: 0.28,
    front: 0.25,
  };

  /**
   * Parts-catalog display price:
   * - Dedicated part uploads already store the real part EXW in priceUsd → use full amount.
   * - Half-cut rows borrowed into a parts catalog estimate via PART_PRICE_RATIOS.
   * (Bug 2026-07-10: gearboxes showed Math.round(230*0.35)=81 for dedicated HC250546.)
   */
  function catalogPartPriceAmount(item, partType) {
    const whole = parsePriceUsd(item);
    if (whole == null) return null;
    if (isDedicatedPartListing(item, partType)) return whole;
    const ratio = PART_PRICE_RATIOS[partType];
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    return Math.round(whole * ratio);
  }

  function formatCatalogPartPrice(item, partType) {
    const amount = catalogPartPriceAmount(item, partType);
    if (amount == null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const PART_LISTING_PHOTO_LABELS = {
    engine: ['engine', '发动机'],
    front: ['vehicle front', '车辆前脸', 'cab front', '驾驶室正面', 'front cut', '前头'],
    transmission: ['transmission', 'gearbox', '变速箱'],
    chassis: ['chassis', '底盘'],
  };

  /** Dedicated part uploads (passenger-parts / truck engine) — not half-cut borrowed photos. */
  function isDedicatedPartListing(display, partType) {
    if (!display || !partType) return false;
    const ppt = String(display.passengerPartType || '').trim().toLowerCase();
    const truckPart = String(display.truckPartType || '').trim().toLowerCase();
    const slug = String(display.slug || '').toLowerCase();
    const cond = String(display.vehicleCondition || '').trim().toLowerCase();

    const dedicatedByType = {
      engine: {
        ppt: ppt === 'engine' || truckPart === 'engine',
        slug: slug.includes('-passenger-engine-') || slug.includes('-truck-engine-'),
        cond: cond === 'engine assembly',
      },
      transmission: {
        ppt: ppt === 'transmission',
        slug: slug.includes('-passenger-transmission-'),
        cond: cond === 'transmission assembly',
      },
      chassis: {
        ppt: ppt === 'chassis',
        slug: slug.includes('-passenger-chassis-'),
        cond: cond === 'chassis part',
      },
      front: {
        ppt: ppt === 'front',
        slug: slug.includes('-front-cut-'),
        cond: cond === 'front cut' || cond.includes('nose cut'),
      },
    };
    const signals = dedicatedByType[partType];
    if (!signals) return false;

    // Explicit dedicated signals win — even if approve path wrongly wrote a -half-cut- slug.
    if (signals.ppt || signals.slug || signals.cond) return true;

    // Plain half-cut vehicles (no dedicated part signals) never count as part uploads.
    if (slug.includes('-half-cut-') || cond === 'half cut') return false;
    return false;
  }

  function photoLabelText(photo) {
    return String(typeof photo === 'object' && photo ? photo.label : '').trim().toLowerCase();
  }

  function photoLabelMatchesPart(photo, partType) {
    const tokens = PART_LISTING_PHOTO_LABELS[partType] || [];
    if (!tokens.length) return false;
    const label = photoLabelText(photo);
    return tokens.some((token) => label.includes(token));
  }

  /**
   * Parts catalog photo picker — parallel with listing rules:
   * - Dedicated uploads: labeled part photo, else first real photo
   * - Rule-based half-cuts: original rule (engine needs Engine label; others label or photos[0])
   * - Placeholder only when this returns null (truly no usable photo)
   */
  function pickPartListingPhoto(display, partType) {
    const photos = display?.photos || [];
    if (!photos.length) return null;
    const match = photos.find((photo) => photoLabelMatchesPart(photo, partType));
    if (isDedicatedPartListing(display, partType)) {
      return match || photos[0] || null;
    }
    if (partType === 'engine') return match || null;
    return match || photos[0] || null;
  }

  function normEngineCatalogCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  }

  function lookupEngineCatalogSpec(display) {
    const code = normEngineCatalogCode(display?.engineCode);
    if (!code) return null;
    const brandEntry = window.getBrandEngines?.(display?.brandSlug || '');
    const brandHit = brandEntry?.models?.find((model) => normEngineCatalogCode(model.code) === code);
    if (brandHit) return brandHit;
    const directory = window.ENGINE_DIRECTORY || {};
    for (const entry of Object.values(directory)) {
      const hit = entry?.models?.find((model) => normEngineCatalogCode(model.code) === code);
      if (hit) return hit;
    }
    return null;
  }

  function formatDisplacementLiters(display) {
    const raw = String(display?.displacement || '').trim();
    if (raw && raw !== '—') {
      const match = raw.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const liters = Number(match[1]);
        if (Number.isFinite(liters) && liters > 0) {
          return `${liters % 1 === 0 ? liters.toFixed(1) : liters}L`;
        }
      }
    }
    const spec = lookupEngineCatalogSpec(display);
    if (spec?.displacement && spec.displacement !== '—') {
      const match = String(spec.displacement).match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const liters = Number(match[1]);
        if (Number.isFinite(liters) && liters > 0) {
          return `${liters % 1 === 0 ? liters.toFixed(1) : liters}L`;
        }
      }
    }
    const title = String(display?.title || display?.originalVehicleName || '').trim();
    const fromTitle = title.match(/(\d+(?:\.\d+)?)\s*[Ll]\b/);
    if (fromTitle) return `${fromTitle[1]}L`;
    return '';
  }

  function resolveEngineFuelType(display) {
    const raw = String(display?.fuelType || '').trim();
    if (raw) return raw.toLowerCase();
    const spec = lookupEngineCatalogSpec(display);
    if (spec?.type) return String(spec.type).toLowerCase();
    if (spec?.fuel) return String(spec.fuel).toLowerCase();
    return '';
  }

  function formatPartsCatalogPrimaryTitle(display) {
    const engine = String(display?.engineCode || '').trim().toUpperCase();
    const year = listingYear(display);
    const brand = String(display?.brand || '').trim();
    const model = String(display?.model || '').trim();
    return [engine, year, brand, model].filter(Boolean).join(' ');
  }

  function formatEngineCatalogPrimaryTitle(display) {
    const year = listingYear(display);
    const brand = String(display?.brand || '').trim();
    const model = String(display?.model || '').trim();
    const engine = String(display?.engineCode || '').trim().toUpperCase();
    const displacement = formatDisplacementLiters(display);
    return [year, brand, model, engine, displacement].filter(Boolean).join(' ');
  }

  function formatPartsCatalogMetaParts(display, translate) {
    const tFn = typeof translate === 'function'
      ? translate
      : (key, fb) => window.PublicI18n?.t(key, fb) ?? fb;
    const parts = [];
    const stockId = String(display?.stockId || '').trim().toUpperCase();
    if (stockId) parts.push(`${tFn('catalog.internalNumber', 'Stock ID')}: ${stockId}`);
    const mileage = String(display?.mileage || '').trim();
    if (mileage) parts.push(`${tFn('hc.mileage', 'Mileage')}: ${mileage}`);
    return parts;
  }

  /** Category marketing / brand art — never a half-cut listing album. */
  function partsCatalogPlaceholderSrc(partType) {
    const base = window.SitePaths?.base?.() || '../';
    const files = {
      engine: 'assets/images/supply-engines.webp',
      transmission: 'assets/images/supply-gearbox.webp',
      chassis: 'assets/images/supply-chassis.webp',
      front: 'assets/images/parts-placeholder.svg',
    };
    const file = files[partType] || 'assets/images/parts-placeholder.svg';
    return `${base}${file}?v=parts-ph-v1`;
  }

  function renderPartListingPhoto(display, partType) {
    const photo = pickPartListingPhoto(display, partType);
    // Parts always use contain so dedicated uploads are not cropped in the frame.
    const fitClass = ' ap-listing-photo--fit-contain';
    const slugAttr = String(display?.slug || '').replace(/"/g, '&quot;');
    if (photo && thumbPhotoUrl(photo)) {
      const thumbUrl = thumbPhotoUrl(photo);
      return `<div class="ebay-listing-row__photo ap-listing-photo ebay-listing-row__photo--part${fitClass}" data-ap-listing-photo data-slug="${slugAttr}">
        <img class="ap-listing-photo__img" src="${thumbUrl}" alt="" loading="lazy" decoding="async">
      </div>`;
    }
    const label = t('hc.photosOnRequest', 'Photos on request');
    const phSrc = partsCatalogPlaceholderSrc(partType);
    return `<div class="ebay-listing-row__photo ebay-listing-row__photo--placeholder ebay-listing-row__photo--part ebay-listing-row__photo--parts-ph" aria-label="${escapeHtml(label)}">
      <img class="ap-listing-photo__img ebay-listing-row__photo-ph-img" src="${phSrc}" alt="" loading="lazy" decoding="async">
      <span class="ebay-listing-row__photo-ph-badge">${escapeHtml(label)}</span>
    </div>`;
  }

  function exwBadgeHtml() {
    const label = t('hc.exwBadge', 'EXW');
    return `<span class="ap-exw-badge" translate="no">${escapeHtml(label)}</span>`;
  }

  function priceWithExwLabel(priceLabel, noPriceText) {
    const fallback = noPriceText || t('hc.priceOnEnquiry', 'Quote on enquiry');
    const text = priceLabel ? escapeHtml(String(priceLabel)) : escapeHtml(fallback);
    return `${text} ${exwBadgeHtml()}`;
  }

  function listingRowPriceHtml(priceLabel, noPriceText) {
    const cls = priceLabel
      ? 'ebay-listing-row__price'
      : 'ebay-listing-row__price ebay-listing-row__price--enquiry';
    return `<p class="${cls}">${priceWithExwLabel(priceLabel, noPriceText)}</p>`;
  }

  function listingSpecTagsHtml(display) {
    const tags = [];
    const year = listingYear(display);
    if (year) tags.push(`<span class="ebay-listing-row__tag">${escapeHtml(year)}</span>`);
    const trans = String(display?.transmissionCode || '').trim().toUpperCase();
    if (trans) tags.push(`<span class="ebay-listing-row__tag">${escapeHtml(trans)}</span>`);
    const drive = listingDrivetrainLabel(display);
    if (drive) tags.push(`<span class="ebay-listing-row__tag">${escapeHtml(drive)}</span>`);
    if (hasVideo(display)) {
      tags.push(`<span class="ebay-listing-row__tag ebay-listing-row__tag--video">${escapeHtml(t('hc.video', 'Video'))}</span>`);
    }
    if (!tags.length) return '';
    return `<div class="ebay-listing-row__tags">${tags.join('')}</div>`;
  }

  function listingSpecsLineHtml(display, item) {
    const parts = [];
    const engine = String(display?.engineCode || '').trim();
    const liters = formatDisplacementLiters?.(display) || '';
    if (engine && liters) parts.push(`${engine} ${liters}`);
    else if (engine) parts.push(engine);
    const drive = listingDrivetrainLabel(display);
    if (drive) parts.push(drive);
    if (isPassengerHalfCutItem(item || display)) {
      parts.push(t('hc.customDismantleShort', 'Custom dismantling'));
    }
    if (!parts.length) return '';
    return `<p class="ebay-listing-row__specs">${parts.map((p) => escapeHtml(p)).join(' · ')}</p>`;
  }

  function listingRowCtasHtml(item) {
    const wa = whatsappLink(item, 'ebay-listing-row__wa', 'WhatsApp');
    const quote = isAvailable(item)
      ? leadLink(item, 'price', 'ebay-listing-row__quote', t('nav.requestQuote', 'Get Quote'))
      : leadLink(item, 'similar', 'ebay-listing-row__quote', t('nav.requestQuote', 'Get Quote'));
    return `<div class="ebay-listing-row__ctas">${wa}${quote}</div>`;
  }

  function resolveOfferPrice(item) {
    const amount = parsePriceUsd(item);
    return amount != null ? amount.toFixed(2) : null;
  }

  function offerAvailability(item) {
    if (isAvailable(item)) return 'https://schema.org/InStock';
    if (isReserved(item)) return 'https://schema.org/LimitedAvailability';
    if (isInTransit(item)) return 'https://schema.org/LimitedAvailability';
    return 'https://schema.org/OutOfStock';
  }

  function buildProductOffer(item, canonical) {
    const price = resolveOfferPrice(item);
    if (!price || isSold(item)) return null;

    const listing = window.ASIAPOWER?.merchantListing || {};
    const offer = {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'USD',
      price,
      availability: offerAvailability(item),
      itemCondition: 'https://schema.org/UsedCondition',
      seller: {
        '@type': 'Organization',
        name: window.ASIAPOWER?.company || 'AsiaPower',
        url: (window.ASIAPOWER?.siteUrl || window.location.origin).replace(/\/$/, ''),
      },
    };

    if (listing.returnPolicy) {
      offer.hasMerchantReturnPolicy = { '@id': listing.returnPolicy['@id'] || listing.returnPolicy };
    }
    if (listing.shippingDetails) {
      offer.shippingDetails = { '@id': listing.shippingDetails['@id'] || listing.shippingDetails };
    }

    return offer;
  }

  function productJsonLd(item, canonical) {
    const base = window.SitePaths?.base?.() || '../';
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listingTitle(item) || item.title,
      description: item.shortDescription,
      sku: item.stockId,
      image: productImages(item, base),
      brand: { '@type': 'Brand', name: item.brand },
    };

    const offer = buildProductOffer(item, canonical);
    if (offer) product.offers = offer;

    return product;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function listingDrivetrainCode(display) {
    const raw = String(display?.drivetrain || '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === '2WD' || raw === 'FWD' || raw === 'RWD') return '2WD';
    if (raw === '4WD' || raw === 'AWD' || raw === '4MATIC' || raw === 'QUATTRO') return '4WD';
    return raw;
  }

  function listingDrivetrainLabel(display) {
    const code = listingDrivetrainCode(display);
    if (!code) return '';
    const lang = window.PublicI18n?.getLang?.() || 'en';
    if (lang === 'zh') return code === '4WD' ? '四驱车' : '两驱车';
    return code;
  }

  function listingNotesText(display) {
    return window.HalfCutTitle?.listingNotesText?.(display)
      ?? String(display?.originalVehicleName || display?.notes || display?.shortDescription || '').trim();
  }

  function extractOriginalVehicleName(text) {
    return window.HalfCutTitle?.extractOriginalVehicleName?.(text)
      ?? String(text || '').trim();
  }

  function listingOriginalVehicleName(display) {
    return extractOriginalVehicleName(listingNotesText(display));
  }

  function appendEngineToTitle(base, display) {
    if (window.HalfCutTitle?.appendEngineToTitle) {
      return window.HalfCutTitle.appendEngineToTitle(base, display);
    }
    const title = String(base || '').trim();
    const engine = String(display?.engineCode || '').trim();
    if (!title || !engine) return title;
    if (title.toUpperCase().includes(engine.toUpperCase())) return title;
    return `${title} ${engine}`.replace(/\s+/g, ' ').trim();
  }

  function isRemarkBoilerplate(line) {
    return window.HalfCutTitle?.isRemarkBoilerplate?.(line) ?? !line;
  }

  function isRemarkMetadataLine(line) {
    if (/^原始车型:/.test(line) || /^原始说明:/.test(line)) return false;
    if (/^VIN /i.test(line) || /^VIN decode:/i.test(line)) return true;
    if (/^mileage/i.test(line) || /^里程数/.test(line)) return true;
    if (/子龙预估/.test(line) || /VIN OCR confidence:/i.test(line)) return true;
    return isRemarkBoilerplate(line);
  }

  function listingRemarkLine(display) {
    if (!window.HalfCutTitle?.isQxbListing?.(display)) return '';
    return listingOriginalVehicleName(display) || (() => {
      const remark = listingNotesText(display);
      if (!remark) return '';
      const line = remark.split('\n')[0].trim();
      if (isRemarkBoilerplate(line)) return '';
      if (/supplier-verified listing via AsiaPower/i.test(line)) return '';
      if (/QXB image set restored/i.test(line)) return '';
      if (/^原始说明:/.test(line)) return '';
      return line;
    })();
  }

  function listingRemarkTail(display, ymm, drive) {
    let tail = listingRemarkLine(display).toUpperCase();
    if (!tail) return drive || '';
    if (ymm) {
      if (tail.startsWith(`${ymm} ${ymm}`)) {
        tail = tail.slice(`${ymm} ${ymm}`.length).trim();
      } else if (tail.startsWith(ymm)) {
        tail = tail.slice(ymm.length).trim();
      }
    }
    if (drive && tail.startsWith(drive)) tail = tail.slice(drive.length).trim();
    return [drive, tail].filter(Boolean).join(' ').trim();
  }

  function listingPowertrainSegment(display) {
    const engine = String(display?.engineCode || '').trim().toUpperCase();
    const trans = String(display?.transmissionCode || '').trim().toUpperCase();
    if (display?.vehicleCategory === 'machinery') return engine;
    return [engine, trans].filter(Boolean).join(' ');
  }

  function listingStructuredTitle(display) {
    const year = listingYear(display);
    const brand = String(display?.brand || '').trim();
    const model = String(display?.model || '').trim();
    if (!brand && !model) return '';

    const parts = [[year, brand, model].filter(Boolean).join(' ')];
    const powertrain = listingPowertrainSegment(display);
    if (powertrain) parts.push(powertrain);
    const drive = listingDrivetrainCode(display);
    if (drive) parts.push(drive);
    return parts.join(' ').toUpperCase();
  }

  function listingTitle(item) {
    const display = item?.vin && window.HalfCutInventoryLayer?.toPublicItem
      ? window.HalfCutInventoryLayer.toPublicItem(item)
      : item;
    if (!display) return '';

    const lang = window.PublicI18n?.getLang?.() || 'en';
    const qxb = window.HalfCutTitle?.isQxbListing?.(display);
    const originalName = qxb ? listingOriginalVehicleName(display) : '';
    if (originalName) {
      if (lang === 'zh') return appendEngineToTitle(originalName, display);
      const translated = window.HalfCutVehicleTitleI18n?.translateOriginalVehicleName?.(
        originalName,
        lang,
        display
      );
      if (translated) return appendEngineToTitle(translated, display);
    }

    if (String(display?.engineCode || '').trim()) {
      const structured = listingStructuredTitle(display);
      if (structured) return structured;
    }

    const fallbackStructured = window.HalfCutTitle?.buildStructuredTitle?.(display);
    if (fallbackStructured) return fallbackStructured;

    const year = listingYear(display);
    const brand = String(display?.brand || '').trim();
    const model = String(display?.model || '').trim();
    const ymm = [year, brand, model].filter(Boolean).join(' ').toUpperCase();
    const drive = listingDrivetrainCode(display);
    const remarkUpper = listingRemarkLine(display).toUpperCase();

    if (remarkUpper.startsWith(`${ymm} ${ymm}`)) {
      const rest = remarkUpper.slice(`${ymm} ${ymm}`.length).trim();
      return rest ? `${ymm} ${rest}` : ymm;
    }

    if (ymm) {
      const tail = listingRemarkTail(display, ymm, drive);
      return tail ? `${ymm} ${tail}`.trim() : ymm;
    }

    return remarkUpper || String(display?.title || '').trim().toUpperCase();
  }

  function listingYear(display) {
    const year = Number(display?.year);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) return '';
    return String(Math.round(year));
  }

  function listingPhotoBadge(display) {
    const stockId = String(display?.stockId || '').trim();
    return stockId ? stockId.toUpperCase() : '';
  }

  function renderPhotoStockBadge(display) {
    const badge = listingPhotoBadge(display);
    return badge ? `<span class="ebay-listing-row__year">${escapeHtml(badge)}</span>` : '';
  }

  function listingPhotoProgressHtml(count, activeIndex) {
    return Array.from({ length: count }, (_, i) => {
      let cls = 'ap-listing-photo__progress-seg';
      if (i < activeIndex) cls += ' is-done';
      if (i === activeIndex) cls += ' is-active';
      return `<span class="${cls}" aria-hidden="true"></span>`;
    }).join('');
  }

  function listingThumbUrls(display) {
    return (display.photos || []).map((photo) => thumbPhotoUrl(photo)).filter(Boolean);
  }

  function listingPhotoUseContain(display) {
    if (!display) return false;
    if (display.truckPartType === 'cab') return true;
    if (display.vehicleCategory === 'truck') return true;
    if (display.vehicleCategory === 'machinery') return true;
    if (window.HalfCutUploadLayer?.isTruckCab?.(display)) return true;
    return false;
  }

  function listingVinMasked(display) {
    const preset = String(display?.maskedVin || '').trim();
    if (preset) return preset;
    const raw = String(display?.vin || '').trim();
    if (!raw) return '';
    return window.HalfCutVin?.maskVin?.(raw) || maskVin(raw) || raw;
  }

  function listingVinLine(display) {
    const masked = listingVinMasked(display);
    if (!masked) return '';
    return `${t('hc.chassisVin', 'Chassis VIN')}: ${masked}`;
  }

  function renderInlineListingPhoto(display, className) {
    const badgeHtml = renderPhotoStockBadge(display);
    const thumbs = listingThumbUrls(display);
    const thumbUrl = thumbs[0] || '';
    const slugAttr = String(display.slug || '').replace(/"/g, '&quot;');
    const multi = thumbs.length > 1;
    const thumbsAttr = escapeHtml(JSON.stringify(thumbs));
    const fitClass = listingPhotoUseContain(display) ? ' ap-listing-photo--fit-contain' : '';
    const navHtml = multi
      ? `<button type="button" class="ap-listing-photo__nav ap-listing-photo__nav--prev" data-listing-photo-step="-1" aria-label="${t('hc.prevPhoto', 'Previous photo')}">‹</button><button type="button" class="ap-listing-photo__nav ap-listing-photo__nav--next" data-listing-photo-step="1" aria-label="${t('hc.nextPhoto', 'Next photo')}">›</button>`
      : '';
    const zonesHtml = multi
      ? `<span class="ap-listing-photo__zone ap-listing-photo__zone--prev" data-listing-photo-step="-1" aria-hidden="true"></span><span class="ap-listing-photo__zone ap-listing-photo__zone--next" data-listing-photo-step="1" aria-hidden="true"></span>`
      : '';
    const progressHtml = multi
      ? `<span class="ap-listing-photo__progress" aria-hidden="true"><span class="ap-listing-photo__progress-track">${listingPhotoProgressHtml(thumbs.length, 0)}</span></span>`
      : '';
    return `<div class="ap-listing-photo ${className}${fitClass}" data-ap-listing-photo data-listing-thumbs="${thumbsAttr}" data-slug="${slugAttr}">${badgeHtml}<img class="ap-listing-photo__img" src="${thumbUrl}" alt="" loading="lazy" decoding="async">${navHtml}${zonesHtml}${progressHtml}</div>`;
  }

  function renderListingPhoto(display, detail) {
    const thumbs = listingThumbUrls(display);
    if (thumbs.length && hasPhotos(display)) {
      return renderInlineListingPhoto(display, 'ebay-listing-row__photo');
    }
    const badgeHtml = renderPhotoStockBadge(display);
    return `<a class="ebay-listing-row__photo ebay-listing-row__photo--placeholder" href="${detail}" aria-label="${t('hc.photosOnRequest', 'Photos on request')}">
      ${badgeHtml}
      <svg class="ebay-listing-row__photo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.75"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg>
    </a>`;
  }

  function listingCardPhoto(display, basePath) {
    const thumbs = listingThumbUrls(display);
    if (thumbs.length && hasPhotos(display)) {
      return renderInlineListingPhoto(display, 'ebay-card__photo');
    }
    const badgeHtml = renderPhotoStockBadge(display);
    return `${badgeHtml}<img src="${basePath}assets/images/supply-halfcut.jpg?v=img-v3" alt="" loading="lazy">`;
  }

  function customDismantleNoteHtml(item, mode) {
    if (!isPassengerHalfCutItem(item)) return '';
    const text = t('hc.customDismantleNote', 'Custom Dismantling — Parts on Demand');
    if (mode === 'card') return `<div class="ebay-card__note">${text}</div>`;
    return `<p class="ebay-listing-row__note">${text}</p>`;
  }

  function renderListingCard(item, opts) {
    const display = window.HalfCutInventoryLayer?.toPublicItem?.(item) ?? item;
    const basePath = opts?.base || window.SitePaths?.base?.() || '../';
    const detail = detailUrl(basePath, display.slug);
    const title = escapeHtml(listingTitle(display));
    const driveLabel = escapeHtml(listingDrivetrainLabel(display));
    const priceLabel = formatFobPrice(display);
    const priceHtml = priceWithExwLabel(priceLabel, 'Quote');
    const metaHtml = driveLabel
      ? `<div class="ebay-card__meta ebay-card__meta--drive">${t('hc.drivetrain', 'Drivetrain')}: ${driveLabel}</div>`
      : '';
    const noteHtml = customDismantleNoteHtml(item, 'card');
    const photo = listingCardPhoto(display, basePath);
    const photoHtml = photo.includes('data-ap-listing-photo')
      ? photo
      : `<div class="ebay-card__photo">${photo}</div>`;

    return `<a class="ebay-card ebay-card--catalog" href="${detail}" data-slug="${display.slug}" data-brand="${display.brandSlug}">
      ${photoHtml}
      <div class="ebay-card__title">${title}</div>
      <div class="ebay-card__price">${priceHtml}</div>
      ${metaHtml}
      ${noteHtml}
    </a>`;
  }

  function renderFeedRow(item, opts) {
    if (opts?.renderListRow) return opts.renderListRow(item, opts);
    return renderListingListRow(item, opts);
  }

  function renderFeedCard(item, opts) {
    if (opts?.renderListCard) return opts.renderListCard(item, opts);
    return renderListingCard(item, opts);
  }

  function renderInventoryFeed(items, opts) {
    const list = items || [];
    const rows = list.map((item) => renderFeedRow(item, opts)).join('');
    if (opts?.listOnly) {
      return `<div class="ebay-inventory-feed"><div class="ebay-listing-list" aria-live="polite">${rows}</div></div>`;
    }
    const cards = list.map((item) => renderFeedCard(item, opts)).join('');
    return `
      <div class="ebay-inventory-feed">
        <div class="ebay-listing-list" aria-live="polite">${rows}</div>
        <div class="ebay-catalog-card-grid ebay-catalog-card-grid--mobile" aria-live="polite">${cards}</div>
      </div>`;
  }

  const CATALOG_PAGE_SIZE = 10;

  function formatCatalogText(key, fallback, vars) {
    let text = t(key, fallback);
    if (vars) {
      Object.entries(vars).forEach(([name, value]) => {
        text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      });
    }
    return text;
  }

  function catalogShowingLabel(shown, total) {
    return formatCatalogText('catalog.showingCount', 'Showing {shown} of {total}', { shown, total });
  }

  function catalogLoadMoreLabel(remaining) {
    const lang = window.PublicI18n?.getLang?.() || 'en';
    const action = t('catalog.loadMore', 'Load more');
    if (lang === 'zh') return `${action}（还剩 ${remaining} 条）`;
    if (lang === 'fr') return `${action} (${remaining} restants)`;
    if (lang === 'ar') return `${action} (${remaining} متبقية)`;
    return `${action} (${remaining} remaining)`;
  }

  function renderCatalogFeed(items, opts) {
    const total = (items || []).length;
    const shown = Math.min(CATALOG_PAGE_SIZE, total);
    const visible = (items || []).slice(0, shown);
    const feedHtml = renderInventoryFeed(visible, opts);
    const remaining = total - shown;
    if (remaining <= 0) return feedHtml;

    return `${feedHtml}
      <div class="ebay-catalog-more" data-catalog-load-more-wrap>
        <div class="ebay-catalog-more__progress" aria-hidden="true">
          <span class="ebay-catalog-more__progress-bar" data-catalog-load-progress style="width:${Math.round((shown / total) * 100)}%"></span>
        </div>
        <div class="ebay-catalog-more__row">
          <span class="ebay-catalog-more__label" data-catalog-load-count>${catalogShowingLabel(shown, total)}</span>
          <button type="button" class="ebay-catalog-more__btn" data-catalog-load-more data-catalog-shown="${shown}">
            <span class="ebay-catalog-more__btn-text">${t('catalog.loadMore', 'Load more')}</span>
            <span class="ebay-catalog-more__btn-meta">${catalogLoadMoreLabel(remaining)}</span>
          </button>
        </div>
      </div>`;
  }

  function bindCatalogLoadMore(root, items, opts) {
    const btn = root?.querySelector?.('[data-catalog-load-more]');
    if (!btn || !items?.length) return;

    btn.addEventListener('click', () => {
      let shown = Number(btn.dataset.catalogShown) || CATALOG_PAGE_SIZE;
      const next = Math.min(shown + CATALOG_PAGE_SIZE, items.length);
      const batch = items.slice(shown, next);
      const feed = root.querySelector('.ebay-inventory-feed');
      if (!feed || !batch.length) return;

      const listEl = feed.querySelector('.ebay-listing-list');
      const gridEl = feed.querySelector('.ebay-catalog-card-grid');
      batch.forEach((item) => {
        listEl?.insertAdjacentHTML('beforeend', renderFeedRow(item, opts));
        if (!opts?.listOnly) {
          gridEl?.insertAdjacentHTML('beforeend', renderFeedCard(item, opts));
        }
      });

      shown = next;
      btn.dataset.catalogShown = String(shown);
      const countEl = root.querySelector('[data-catalog-load-count]');
      if (countEl) countEl.textContent = catalogShowingLabel(shown, items.length);
      const progressEl = root.querySelector('[data-catalog-load-progress]');
      if (progressEl) {
        progressEl.style.width = `${Math.round((shown / items.length) * 100)}%`;
      }

      const remaining = items.length - shown;
      if (remaining <= 0) {
        btn.closest('[data-catalog-load-more-wrap]')?.remove();
      } else {
        const metaEl = btn.querySelector('.ebay-catalog-more__btn-meta');
        if (metaEl) metaEl.textContent = catalogLoadMoreLabel(remaining);
      }

      window.HalfCutGalleryLightbox?.bindListingPhotoCarousels?.(feed);
    });
  }

  function renderListingListRow(item, opts) {
    const display = window.HalfCutInventoryLayer?.toPublicItem?.(item) ?? item;
    const basePath = opts?.base || window.SitePaths?.base?.() || '../';
    const detail = detailUrl(basePath, display.slug);
    const title = escapeHtml(listingTitle(display));
    const brand = escapeHtml(String(display?.brand || '').trim());
    const statusClass = statusSlug(display.status);
    const priceLabel = formatFobPrice(display);
    const priceHtml = listingRowPriceHtml(priceLabel);
    const tagsHtml = listingSpecTagsHtml(display);
    const specsHtml = listingSpecsLineHtml(display, item);
    const vinLine = listingVinLine(display);
    const vinHtml = vinLine
      ? `<span class="ebay-listing-row__vin">${escapeHtml(vinLine)}</span>`
      : '<span class="ebay-listing-row__vin"></span>';
    const makeHtml = brand
      ? `<div class="ebay-listing-row__make">${brand}</div>`
      : '';
    const ctasHtml = listingRowCtasHtml(display);

    return `
      <article class="ebay-listing-row ebay-listing-row--halfcut ebay-listing-row--v4" data-slug="${display.slug}" data-brand="${display.brandSlug}" data-status="${statusClass}">
        ${renderListingPhoto(display, detail)}
        <div class="ebay-listing-row__main">
          <div class="ebay-listing-row__main-body">
            ${makeHtml}
            <h3 class="ebay-listing-row__title"><a href="${detail}">${title}</a></h3>
            ${tagsHtml}
            ${priceHtml}
            ${specsHtml}
          </div>
          <div class="ebay-listing-row__bot">
            ${vinHtml}
            ${ctasHtml}
          </div>
        </div>
      </article>`;
  }

  function renderCardActions(item, base) {
    const detail = detailUrl(base, item.slug);
    if (isAvailable(item)) {
      return `
        <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
        ${leadLink(item, 'price', 'btn btn-outline-navy btn-sm', t('hc.requestPrice', 'Request Price'))}
        ${leadLink(item, 'photos', 'btn btn-outline-navy btn-sm', t('hc.requestPhotos', 'Request Photos'))}
        ${whatsappLink(item, 'btn btn-whatsapp btn-sm', 'WhatsApp')}`;
    }
    if (isReserved(item)) {
      return `
        <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
        ${checkAvailabilityLink(item, 'btn btn-accent btn-sm', t('hc.checkAvailability', 'Check Availability'))}
        ${leadLink(item, 'similar', 'btn btn-outline-navy btn-sm', t('hc.requestSimilar', 'Request Similar Unit'))}`;
    }
    if (isInTransit(item)) {
      return `
        <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
        ${checkAvailabilityLink(item, 'btn btn-accent btn-sm', t('hc.checkAvailability', 'Check Availability'))}
        ${leadLink(item, 'similar', 'btn btn-outline-navy btn-sm', t('hc.requestSimilar', 'Request Similar Unit'))}`;
    }
    return `
      <a href="${detail}" class="btn btn-navy btn-sm">${t('hc.viewDetails', 'View Details')}</a>
      ${leadLink(item, 'similar', 'btn btn-accent btn-sm', t('hc.requestSimilar', 'Request Similar Unit'))}`;
  }

  function renderDetailActions(item, base) {
    if (isAvailable(item)) {
      return `
        ${leadLink(item, 'price', 'btn btn-accent', t('hc.requestPrice', 'Request Price'))}
        ${leadLink(item, 'photos', 'btn btn-outline-navy', t('hc.requestPhotos', 'Request Photos'))}
        ${whatsappLink(item, 'btn btn-whatsapp', 'WhatsApp')}`;
    }
    if (isReserved(item)) {
      return `
        ${leadLink(item, 'availability', 'btn btn-accent', t('hc.checkAvailability', 'Check Availability'))}
        ${leadLink(item, 'similar', 'btn btn-outline-navy', t('hc.requestSimilar', 'Request Similar Unit'))}`;
    }
    if (isInTransit(item)) {
      return `
        ${leadLink(item, 'availability', 'btn btn-accent', t('hc.checkAvailability', 'Check Availability'))}
        ${leadLink(item, 'similar', 'btn btn-outline-navy', t('hc.requestSimilar', 'Request Similar Unit'))}`;
    }
    return `
      ${leadLink(item, 'similar', 'btn btn-accent', t('hc.requestSimilar', 'Request Similar Unit'))}`;
  }

  window.SEED_HALF_CUT_LIST = SEED_HALF_CUT_LIST;
  window.HALF_CUT_LIST = HALF_CUT_LIST;
  window.HALF_CUT_BY_SLUG = bySlug;
  window.HalfCutDirectory = { SEED_HALF_CUT_LIST, rebuildHalfCutList };
  window.getHalfCutBySlug = getHalfCutBySlug;
  window.getHalfCutsByBrandSlug = getHalfCutsByBrandSlug;
  window.getHalfCutBrands = getHalfCutBrands;
  window.getTruckInventory = () => filterInventoryBySegment(HALF_CUT_LIST, 'truck');
  window.getMachineryInventory = () => filterInventoryBySegment(HALF_CUT_LIST, 'machinery');
  window.getUsedCarInventory = () => filterInventoryBySegment(HALF_CUT_LIST, 'passenger').filter(isExportableUsedCarItem);
  window.getPassengerHalfCutInventory = () => filterInventoryBySegment(HALF_CUT_LIST, 'passenger').filter(isPassengerHalfCutItem);
  window.getPassengerCatalogInventory = () => filterInventoryBySegment(HALF_CUT_LIST, 'passenger').filter((item) => !isExportableUsedCarItem(item));
  window.parseHalfCutCatalogRoute = parseCatalogRoute;
  window.inventoryForCatalogCategory = inventoryForCatalogCategory;
  window.HalfCutUtils = {
    inventorySegment,
    isTruckItem,
    isMachineryItem,
    isUsedCarItem,
    isHalfCutLikeListing,
    isExportableUsedCarItem,
    hasExportReadyRemark,
    itemRemarkText,
    passengerInventoryPartType,
    isPassengerHalfCutItem,
    hasChassisCatalogEvidence,
    matchesInventoryCategory,
    normalizeStockIdQuery,
    isStockIdQuery,
    stockIdDigits,
    matchesStockId,
    normalizeCatalogSearch,
    buildCatalogSearchHaystack,
    expandCatalogSearchTerms,
    matchesCatalogSearch,
    findInventoryByStockIdQuery,
    findInventoryByCatalogQuery,
    mergeCatalogSearchHitsIntoInventory,
    mergeStockIdHitsIntoInventory,
    parseCatalogRoute,
    inventoryForCatalogCategory,
    brandSegmentForCategory,
    isMachineryLike,
    filterInventoryBySegment,
    listingTypeLabel,
    detailUrl,
    whatsappUrl,
    whatsappMessage,
    photosMessage,
    similarUnitUrl,
    similarUnitMessage,
    leadLink,
    whatsappLink,
    checkAvailabilityUrl,
    checkAvailabilityLink,
    waCaptureLink,
    requestPhotosUrl,
    listingSharePageUrl,
    facebookShareUrl,
    facebookShareLink,
    requestPriceUrl,
    enginePageUrl,
    statusSlug,
    hasPhotos,
    photoUrl,
    thumbPhotoUrl,
    firstPhotoUrl,
    firstPhotoThumbUrl,
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
    productImages,
    parsePriceUsd,
    listingHeatScore,
    compareListingHeat,
    sortByListingHeat,
    formatFobPrice,
    exwPriceLine,
    seoPriceSnippet,
    formatPartPriceUsd,
    PART_PRICE_RATIOS,
    catalogPartPriceAmount,
    formatCatalogPartPrice,
    formatPartsCatalogPrimaryTitle,
    formatEngineCatalogPrimaryTitle,
    formatDisplacementLiters,
    resolveEngineFuelType,
    lookupEngineCatalogSpec,
    formatPartsCatalogMetaParts,
    isDedicatedPartListing,
    pickPartListingPhoto,
    partsCatalogPlaceholderSrc,
    renderPartListingPhoto,
    CATALOG_PAGE_SIZE,
    exwBadgeHtml,
    priceWithExwLabel,
    listingRowPriceHtml,
    listingSpecTagsHtml,
    listingSpecsLineHtml,
    listingRowCtasHtml,
    listingTitle,
    listingPhotoBadge,
    renderPhotoStockBadge,
    renderInlineListingPhoto,
    listingDrivetrainLabel,
    listingDrivetrainCode,
    listingVinMasked,
    listingVinLine,
    renderListingListRow,
    renderListingCard,
    renderInventoryFeed,
    renderCatalogFeed,
    bindCatalogLoadMore,
    renderCardActions,
    renderDetailActions,
  };

  (function ensureHalfCutLeadCapture() {
    if (window.__HALF_CUT_LEADS_INIT__ && window.HalfCutLeads) return;

    const base = window.SitePaths?.base?.() || (
      window.location.pathname.includes('/brands/') || window.location.pathname.includes('/half-cuts/')
        ? '../'
        : ''
    );

    function loadSyncScript(src) {
      if (!src) return false;
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', src, false);
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
          Function(`${xhr.responseText}\n//# sourceURL=${src}`)();
          return true;
        }
      } catch {
        // ignore load failures
      }
      return false;
    }

    if (!window.AsiaCountryOptions) loadSyncScript(`${base}js/country-options.js?v=1`);
    if (!window.AsiaPhone) loadSyncScript(`${base}js/phone-utils.js?v=2`);
    if (!window.SiteFeedback) loadSyncScript(`${base}js/site-feedback.js?v=list-lead-modal-v1`);

    if (!window.__HALF_CUT_LEADS_INIT__) {
      loadSyncScript(`${base}js/half-cut-leads.js?v=leads-v10`);
    }
  })();
})();
