/**
 * AsiaPower — VIN utilities (decode demo, validate, mask)
 * Future: replace decodeVin() with server-side NHTSA / China VIN API.
 */
(function () {
  'use strict';

  const DECODE_CONFIDENCE = {
    FULL: 'full',
    PARTIAL: 'partial',
    MANUAL: 'manual',
  };

  const VEHICLE_FIELD_KEYS = ['brand', 'model', 'year', 'engineCode', 'transmissionCode', 'drivetrain', 'fuelType'];

  const BRAND_SLUG_MAP = {
    Toyota: 'toyota',
    Nissan: 'nissan',
    Hyundai: 'hyundai',
    Kia: 'kia',
    Honda: 'honda',
    Mitsubishi: 'mitsubishi',
    Lexus: 'lexus',
    BMW: 'bmw',
    'Mercedes-Benz': 'mercedes-benz',
  };

  /** Local demo decode table — full VIN → complete vehicle data */
  const DEMO_VIN_LOOKUP = {
    MR0BA3CD500123456: {
      brand: 'Toyota',
      model: 'Hilux Revo',
      year: 2022,
      engineCode: '2GD-FTV',
      transmissionCode: '6AT',
      drivetrain: '4WD',
    },
    JTMBF4DV1A5023456: {
      brand: 'Toyota',
      model: 'RAV4',
      year: 2020,
      engineCode: '2AR-FE',
      transmissionCode: 'CVT',
      drivetrain: 'AWD',
    },
    KMHXX00XXXX000001: {
      brand: 'Hyundai',
      model: 'Tucson',
      year: 2021,
      engineCode: 'G4NA',
      transmissionCode: '6AT',
      drivetrain: 'AWD',
    },
    JN1TBNT32U0123456: {
      brand: 'Nissan',
      model: 'Navara',
      year: 2021,
      engineCode: 'YS23DDTT',
      transmissionCode: '7AT',
      drivetrain: '4WD',
    },
    JHMFC1F59MX012345: {
      brand: 'Honda',
      model: 'Civic',
      year: 2021,
      engineCode: 'L15B7',
      transmissionCode: 'CVT',
      drivetrain: '2WD',
    },
  };

  /** WMI prefix → brand (longest match first) */
  const WMI_BRAND_HINTS = [
    { prefix: 'MR0', brand: 'Toyota' },
    { prefix: 'JTM', brand: 'Toyota' },
    { prefix: 'JTE', brand: 'Toyota' },
    { prefix: 'JTD', brand: 'Toyota' },
    { prefix: 'JT', brand: 'Toyota' },
    { prefix: 'JMY', brand: 'Mitsubishi' },
    { prefix: 'JA', brand: 'Mitsubishi' },
    { prefix: 'KMH', brand: 'Hyundai' },
    { prefix: 'KNA', brand: 'Kia' },
    { prefix: 'KND', brand: 'Kia' },
    { prefix: 'JN', brand: 'Nissan' },
    { prefix: 'JHM', brand: 'Honda' },
    { prefix: 'JHL', brand: 'Honda' },
    { prefix: 'JTH', brand: 'Lexus' },
    { prefix: 'WBA', brand: 'BMW' },
    { prefix: 'WBS', brand: 'BMW' },
    { prefix: 'WDB', brand: 'Mercedes-Benz' },
    { prefix: 'WDC', brand: 'Mercedes-Benz' },
  ];

  function normalizeVin(vin) {
    return String(vin || '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
  }

  function validateVin(vin) {
    const v = normalizeVin(vin);
    if (v.length !== 17) return { valid: false, error: 'VIN must be exactly 17 characters.' };
    if (/[IOQ]/.test(v)) return { valid: false, error: 'VIN cannot contain I, O, or Q.' };
    return { valid: true, vin: v };
  }

  function maskVin(vin) {
    const v = normalizeVin(vin);
    if (!v) return '';
    if (v.length <= 13) return '*'.repeat(v.length);
    const start = v.slice(0, 10);
    const end = v.slice(-3);
    const middle = '*'.repeat(v.length - 13);
    return `${start}${middle}${end}`;
  }

  function brandToSlug(brand) {
    if (window.VehicleCatalog?.brandToSlug) {
      const slug = window.VehicleCatalog.brandToSlug(brand);
      if (slug) return slug;
    }
    if (BRAND_SLUG_MAP[brand]) return BRAND_SLUG_MAP[brand];
    return String(brand || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  function decodeYearFromVinChar(code) {
    const map = {
      A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
      J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
      T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
      1: 2001, 2: 2002, 3: 2003, 4: 2004, 5: 2005, 6: 2006, 7: 2007, 8: 2008, 9: 2009,
    };
    return map[code] || null;
  }

  function emptyVehicleData(vin) {
    return {
      brand: '',
      model: '',
      year: '',
      engineCode: '',
      transmissionCode: '',
      drivetrain: '',
      vin,
    };
  }

  function filledAndMissing(data) {
    const filledFields = VEHICLE_FIELD_KEYS.filter((key) => {
      const val = data[key];
      return val !== '' && val != null;
    });
    const missingFields = VEHICLE_FIELD_KEYS.filter((key) => !filledFields.includes(key));
    return { filledFields, missingFields };
  }

  function assessConfidence(data) {
    const { filledFields } = filledAndMissing(data);
    const hasCore = ['brand', 'model', 'year'].every((key) => filledFields.includes(key));
    const hasPowertrain = filledFields.includes('engineCode') || filledFields.includes('transmissionCode');

    if (hasCore && hasPowertrain) return DECODE_CONFIDENCE.FULL;
    if (filledFields.length > 0) return DECODE_CONFIDENCE.PARTIAL;
    return DECODE_CONFIDENCE.MANUAL;
  }

  function buildSuccessResult(data) {
    const confidence = assessConfidence(data);
    const { filledFields, missingFields } = filledAndMissing(data);
    const brand = data.brand || '';
    return {
      success: true,
      confidence,
      partial: confidence !== DECODE_CONFIDENCE.FULL,
      decodeMethod: 'Auto Decoded',
      filledFields,
      missingFields,
      data: {
        ...data,
        brand,
        brandSlug: brand ? brandToSlug(brand) : '',
        vin: data.vin,
      },
    };
  }

  function buildManualResult(check, error, partialData) {
    const data = { ...emptyVehicleData(check.vin), ...partialData };
    const { filledFields, missingFields } = filledAndMissing(data);

    if (filledFields.length > 0) {
      return buildSuccessResult(data);
    }

    return {
      success: false,
      confidence: DECODE_CONFIDENCE.MANUAL,
      partial: false,
      decodeMethod: 'Manual Entry',
      filledFields: [],
      missingFields: VEHICLE_FIELD_KEYS.slice(),
      error: error || 'VIN decode unavailable. Please enter vehicle details manually.',
      vin: check.vin,
      data,
    };
  }

  function matchWmiBrand(vin) {
    const sorted = [...WMI_BRAND_HINTS].sort((a, b) => b.prefix.length - a.prefix.length);
    return sorted.find((hint) => vin.startsWith(hint.prefix));
  }

  function decodeVin(vin) {
    const check = validateVin(vin);
    if (!check.valid) {
      return {
        success: false,
        confidence: DECODE_CONFIDENCE.MANUAL,
        error: check.error,
        filledFields: [],
        missingFields: VEHICLE_FIELD_KEYS.slice(),
      };
    }

    const exact = DEMO_VIN_LOOKUP[check.vin];
    if (exact) {
      return buildSuccessResult({ ...exact, vin: check.vin });
    }

    const year = decodeYearFromVinChar(check.vin.charAt(9));
    const hint = matchWmiBrand(check.vin);

    if (hint && BRAND_SLUG_MAP[hint.brand]) {
      return buildSuccessResult({
        brand: hint.brand,
        model: '',
        year: year || '',
        engineCode: '',
        transmissionCode: '',
        drivetrain: '2WD',
        vin: check.vin,
      });
    }

    if (year) {
      return buildSuccessResult({
        brand: '',
        model: '',
        year,
        engineCode: '',
        transmissionCode: '',
        drivetrain: '',
        vin: check.vin,
      });
    }

    return buildManualResult(
      check,
      'VIN decode unavailable. Please enter vehicle details manually.'
    );
  }

  function containsFullVin(text) {
    if (!text) return false;
    return /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(String(text));
  }

  if (window.VehicleCatalog?.BRAND_SLUG) {
    Object.assign(BRAND_SLUG_MAP, window.VehicleCatalog.BRAND_SLUG);
  }

  function expandPhotoLabels(baseLabels, maxCount) {
    const max = Math.max(1, Number(maxCount) || 15);
    const labels = Array.isArray(baseLabels) ? baseLabels.slice() : [];
    while (labels.length < max) {
      labels.push(`Additional Photo ${labels.length + 1}`);
    }
    return labels.slice(0, max);
  }

  window.HalfCutVin = {
    normalizeVin,
    validateVin,
    maskVin,
    decodeVin,
    buildResultFromData: buildSuccessResult,
    brandToSlug,
    DECODE_CONFIDENCE,
    BRAND_SLUG_MAP,
    containsFullVin,
    MIN_PHOTOS: 3,
    MAX_PHOTOS: 15,
    MAX_PHOTOS_CAB: 15,
    MAX_VIDEO_BYTES: 50 * 1024 * 1024,
    ALLOWED_VIDEO_MIMES: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    SUPPLIER_STATUSES: ['Available', 'Reserved'],
    ADMIN_STATUSES: ['Available', 'Reserved', 'In Transit', 'Sold'],
    VEHICLE_CONDITIONS: [
      'Running Vehicle',
      'Half Cut',
      'Front Cut',
      'Truck Half Cut',
      'Driver Cab',
      'Engine Assembly',
      'Transmission Assembly',
      'Chassis Part',
      'Axle Assembly',
      'Truck Part',
      'Part',
      'Dismantled',
      'Engine Removed',
    ],
    PHOTO_LABELS: [
      'Vehicle Front',
      'Vehicle Rear',
      'Engine',
      'VIN Plate',
      'Interior',
    ],
    CAB_PHOTO_LABELS: [
      'Cab Front',
      'Cab Rear',
      'Left Side',
      'Right Side',
      'Dashboard',
      'Driver Seat',
      'Door Interior',
      'VIN Plate',
      'Cab Overview',
      'Detail',
    ],
    expandPhotoLabels,
  };
})();
