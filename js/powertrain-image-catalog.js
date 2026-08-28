(() => {
  'use strict';

  const VERSION = 'powertrain-model-images-v2';

  /*
   * Production image order:
   * 1. AsiaPower/supplier-owned or expressly authorised photos (none registered yet).
   * 2. Commercially reusable open-licence/public-domain model photos.
   * 3. No match: the catalog renderer must show its neutral placeholder.
   *
   * A watermark-free image is not automatically rights-cleared. Every record below
   * therefore carries both matching evidence and a public source/licence record.
   */
  const AUTHORISED_ENGINE_IMAGES = Object.freeze([]);
  const AUTHORISED_TRANSMISSION_MODELS = Object.freeze([]);

  const FREE_ENGINE_IMAGES = Object.freeze([
    {
      kind: 'engine',
      engineCode: '1ZR-FE',
      path: 'assets/images/powertrain-models/1zr-fe.jpg',
      alt: 'Toyota 1ZR-FE engine model reference photo',
      usageTier: 'free-open-license',
      rightsStatus: 'commercial-reuse-permitted',
      watermarkStatus: 'none-visible-manual-review',
      source: {
        creator: 'Illusive255',
        publisher: 'Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:1ZR-FE_255.jpg',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
    },
    {
      kind: 'engine',
      engineCode: 'HR16DE',
      path: 'assets/images/powertrain-models/hr16de.jpg',
      alt: 'Nissan HR16DE engine model reference photo',
      usageTier: 'free-open-license',
      rightsStatus: 'commercial-reuse-permitted',
      watermarkStatus: 'none-visible-manual-review',
      source: {
        creator: 'Tennen-Gas',
        publisher: 'Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:Nissan_HR16DE_001.jpg',
        license: 'CC BY-SA 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      },
    },
    {
      kind: 'engine',
      engineCode: '2AZ-FE',
      path: 'assets/images/powertrain-models/2az-fe.jpg',
      alt: 'Toyota 2AZ-FE engine model reference photo',
      usageTier: 'free-open-license',
      rightsStatus: 'commercial-reuse-permitted',
      watermarkStatus: 'none-visible-manual-review',
      source: {
        creator: 'FarGah1',
        publisher: 'Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:2AZ-FE_Engine.jpg',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
    },
    {
      kind: 'engine',
      engineCode: 'MR20DE',
      path: 'assets/images/powertrain-models/mr20de.jpg',
      alt: 'Nissan MR20DE engine model reference photo',
      usageTier: 'free-open-license',
      rightsStatus: 'commercial-reuse-permitted',
      watermarkStatus: 'none-visible-manual-review',
      source: {
        creator: 'Morio',
        publisher: 'Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:2004_Nissan_MR20DE_engine_left.jpg',
        license: 'CC BY-SA 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      },
    },
    {
      kind: 'engine',
      engineCode: '3RZ-FE',
      path: 'assets/images/powertrain-models/3rz-fe.jpg',
      alt: 'Toyota 3RZ-FE engine model reference photo',
      usageTier: 'free-open-license',
      rightsStatus: 'commercial-reuse-permitted',
      watermarkStatus: 'none-visible-manual-review',
      source: {
        creator: 'Ric17',
        publisher: 'Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:4cylT100.JPG',
        license: 'CC BY 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      },
    },
  ]);

  const FREE_TRANSMISSION_MODELS = Object.freeze([
    {
      kind: 'transmission',
      modelCode: 'RE0F10A / JF011E',
      stockId: 'HC250166',
      match: {
        maskedVin: 'LGBF1AE00B****023',
        engineCode: 'MR20DE',
        brand: 'Nissan',
        model: 'Teana',
        year: '2011',
        drivetrain: '2WD',
        transmissionCode: 'CVT',
      },
      path: 'assets/images/powertrain-models/jf011e.jpg',
      alt: 'Jatco RE0F10A JF011E CVT transmission model reference photo',
      usageTier: 'free-public-domain',
      evidenceStatus: 'vin-cross-checked',
      rightsStatus: 'commercial-reuse-permitted',
      watermarkStatus: 'none-visible-manual-review',
      source: {
        creator: 'TTTNIS',
        publisher: 'Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:Jatco_JF011E.jpg',
        license: 'Public domain',
        licenseUrl: 'https://commons.wikimedia.org/wiki/File:Jatco_JF011E.jpg#Licensing',
      },
    },
    {
      kind: 'transmission',
      modelCode: 'U250E / AW95-50LS',
      stockId: 'HC250160',
      match: {
        maskedVin: 'LVGBE40KX7****252',
        engineCode: '2AZ-FE',
        brand: 'Toyota',
        model: 'Camry',
        year: '2007',
        drivetrain: '2WD',
        transmissionCode: '5AT',
      },
      evidenceStatus: 'vin-cross-checked',
      photoStatus: 'placeholder-required',
    },
    {
      kind: 'transmission',
      modelCode: '6T30',
      stockId: 'HC250539',
      match: {
        maskedVin: 'LSGPC54R9C****363',
        engineCode: '2H0',
        brand: 'Chevrolet',
        model: 'Cruze',
        year: '2012',
        drivetrain: '2WD',
        transmissionCode: '6AT',
      },
      evidenceStatus: 'vin-cross-checked',
      photoStatus: 'placeholder-required',
    },
    {
      kind: 'transmission',
      modelCode: 'A6MF1',
      stockId: 'HC250041',
      match: {
        maskedVin: 'LJDKAA249C****257',
        engineCode: 'G4NA',
        brand: 'Kia',
        model: 'K5',
        year: '2012',
        drivetrain: '2WD',
        transmissionCode: '6AT',
      },
      evidenceStatus: 'vin-cross-checked',
      photoStatus: 'placeholder-required',
    },
  ]);

  const ENGINE_IMAGES = Object.freeze([
    ...AUTHORISED_ENGINE_IMAGES,
    ...FREE_ENGINE_IMAGES,
  ]);
  const TRANSMISSION_MODELS = Object.freeze([
    ...AUTHORISED_TRANSMISSION_MODELS,
    ...FREE_TRANSMISSION_MODELS,
  ]);

  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function normalizeText(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9*]/g, '');
  }

  function publicUrl(path) {
    const base = window.SitePaths?.base?.() || '../';
    return `${base}${path}?v=${VERSION}`;
  }

  function isProductionEligible(record) {
    return record?.rightsStatus === 'commercial-reuse-permitted'
      && record?.watermarkStatus === 'none-visible-manual-review'
      && record?.source?.pageUrl
      && record?.source?.license;
  }

  function toResolvedImage(record) {
    if (!isProductionEligible(record)) return null;
    const url = publicUrl(record.path);
    return Object.freeze({ ...record, url, thumbUrl: url });
  }

  function resolveEngine(display) {
    const engineCode = normalizeCode(display?.engineCode || display?.code);
    if (!engineCode) return null;
    const record = ENGINE_IMAGES.find((item) => normalizeCode(item.engineCode) === engineCode);
    return toResolvedImage(record);
  }

  function transmissionEvidenceMatches(display, record) {
    if (normalizeText(display?.stockId) !== normalizeText(record.stockId)) return false;
    const expected = record.match || {};
    return Object.entries(expected).every(([key, value]) => {
      const actual = key === 'maskedVin'
        ? (display?.maskedVin || display?.vinMasked)
        : display?.[key];
      return normalizeText(actual) === normalizeText(value);
    });
  }

  function resolveTransmissionModel(display) {
    const record = TRANSMISSION_MODELS.find((item) => transmissionEvidenceMatches(display, item));
    return record ? Object.freeze({ ...record }) : null;
  }

  function resolveTransmission(display) {
    return toResolvedImage(resolveTransmissionModel(display));
  }

  function resolve(display, partType) {
    if (partType === 'engine') return resolveEngine(display);
    if (partType === 'transmission') return resolveTransmission(display);
    return null;
  }

  window.PowertrainImageCatalog = Object.freeze({
    VERSION,
    resolve,
    resolveEngine,
    resolveTransmission,
    resolveTransmissionModel,
    listProductionImages: () => Object.freeze([
      ...ENGINE_IMAGES.map(toResolvedImage).filter(Boolean),
      ...TRANSMISSION_MODELS.map(toResolvedImage).filter(Boolean),
    ]),
  });
})();
