/**
 * AsiaPower — eBay layout catalog sidebar (single source of truth)
 * Order: Half-Cuts → Trucks → Engines & Parts → Machinery → Export Used Cars
 */
(function () {
  'use strict';

  window.EBAY_CATALOG_SIDEBAR = [
    { href: 'half-cuts/', labelKey: 'ebay.catHalfCuts', label: 'Half-Cuts', id: 'halfcuts' },
    { href: 'trucks/', labelKey: 'ebay.catTrucks', label: 'Trucks', id: 'trucks' },
    { href: 'engines/', labelKey: 'ebay.catParts', label: 'Engines & Parts', id: 'parts' },
    { href: 'half-cuts/?cat=machinery', labelKey: 'ebay.catMachinery', label: 'Construction Machinery', id: 'machinery' },
    { href: 'half-cuts/?cat=used-cars', labelKey: 'ebay.catUsedCars', label: 'Export Used Cars', id: 'used-cars' },
  ];
})();
