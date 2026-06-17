/**
 * AsiaPower — VIN utilities (decode demo, validate, mask)
 * Future: replace decodeVin() with server-side NHTSA / China VIN API.
 */
(function () {
  'use strict';

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

  /** Local demo decode table — full VIN or prefix → vehicle data */
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
  };

  const WMI_BRAND_HINTS = [
    { prefix: 'JT', brand: 'Toyota' },
    { prefix: 'MR0', brand: 'Toyota' },
    { prefix: 'JMY', brand: 'Mitsubishi' },
    { prefix: 'KMH', brand: 'Hyundai' },
    { prefix: 'KNA', brand: 'Kia' },
    { prefix: 'JN', brand: 'Nissan' },
    { prefix: 'JHM', brand: 'Honda' },
    { prefix: 'WBA', brand: 'BMW' },
    { prefix: 'WDB', brand: 'Mercedes-Benz' },
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

  /**
   * Public display mask — first 10 + masked middle + last 3.
   * MR0BA3CD500123456 → MR0BA3CD50****456
   */
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
    if (BRAND_SLUG_MAP[brand]) return BRAND_SLUG_MAP[brand];
    return String(brand || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  function decodeVin(vin) {
    const check = validateVin(vin);
    if (!check.valid) return { success: false, error: check.error };

    const exact = DEMO_VIN_LOOKUP[check.vin];
    if (exact) {
      return {
        success: true,
        decodeMethod: 'Auto Decoded',
        data: {
          ...exact,
          brandSlug: brandToSlug(exact.brand),
          vin: check.vin,
        },
      };
    }

    const hint = WMI_BRAND_HINTS.find(h => check.vin.startsWith(h.prefix));
    if (hint && BRAND_SLUG_MAP[hint.brand]) {
      const yearCode = check.vin.charAt(9);
      const year = decodeYearFromVinChar(yearCode);
      return {
        success: true,
        decodeMethod: 'Auto Decoded',
        partial: true,
        data: {
          brand: hint.brand,
          brandSlug: brandToSlug(hint.brand),
          model: '',
          year: year || '',
          engineCode: '',
          transmissionCode: '',
          drivetrain: '2WD',
          vin: check.vin,
        },
      };
    }

    return {
      success: false,
      error: 'VIN decode unavailable. Please enter vehicle details manually.',
      vin: check.vin,
    };
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

  function containsFullVin(text) {
    if (!text) return false;
    return /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(String(text));
  }

  window.HalfCutVin = {
    normalizeVin,
    validateVin,
    maskVin,
    decodeVin,
    brandToSlug,
    BRAND_SLUG_MAP,
    containsFullVin,
    MIN_PHOTOS: 3,
    SUPPLIER_STATUSES: ['Available', 'Reserved'],
    ADMIN_STATUSES: ['Available', 'Reserved', 'In Transit', 'Sold'],
    VEHICLE_CONDITIONS: ['Running Vehicle', 'Half Cut', 'Dismantled', 'Engine Removed'],
    PHOTO_LABELS: [
      'Vehicle Front',
      'Vehicle Rear',
      'Engine',
      'VIN Plate',
      'Interior',
    ],
  };
})();
