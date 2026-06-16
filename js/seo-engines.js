/**
 * AsiaPower — SEO Engine Landing Pages
 */
(function () {
  'use strict';

  function e(slug, brand, brandSlug, code, displacement, fuel, applications, origin) {
    return {
      slug,
      brand,
      brandSlug,
      code,
      displacement,
      fuel,
      applications,
      origin: origin || 'Japan',
      title: `${brand} ${code} Engine — Export & Sourcing | AsiaPower`,
      description: `Source ${brand} ${code} (${displacement} ${fuel}) engines for global export. Applications: ${applications}. FOB/CIF quotes from AsiaPower.`,
    };
  }

  const SEO_ENGINES = {
    'toyota-1nz-fe': e('toyota-1nz-fe', 'Toyota', 'toyota', '1NZ-FE', '1.8L', 'Petrol', 'Corolla, Fielder, Axio, Yaris'),
    'toyota-2nz-fe': e('toyota-2nz-fe', 'Toyota', 'toyota', '2NZ-FE', '1.3L', 'Petrol', 'Vitz, Platz, Belta'),
    'toyota-1zz-fe': e('toyota-1zz-fe', 'Toyota', 'toyota', '1ZZ-FE', '1.8L', 'Petrol', 'Corolla, Wish, Allion'),
    'toyota-2tr-fe': e('toyota-2tr-fe', 'Toyota', 'toyota', '2TR-FE', '2.7L', 'Petrol', 'Hilux, Fortuner, Land Cruiser Prado'),
    'toyota-1kd-ftv': e('toyota-1kd-ftv', 'Toyota', 'toyota', '1KD-FTV', '3.0L', 'Diesel', 'Hilux, Fortuner, Land Cruiser Prado'),
    'toyota-2kd-ftv': e('toyota-2kd-ftv', 'Toyota', 'toyota', '2KD-FTV', '2.5L', 'Diesel', 'Hilux, Innova, Fortuner'),
    'hyundai-g4kd': e('hyundai-g4kd', 'Hyundai', 'hyundai', 'G4KD', '2.0L', 'Petrol', 'Optima, Sportage, Sorento', 'Korea'),
    'hyundai-g4na': e('hyundai-g4na', 'Hyundai', 'hyundai', 'G4NA', '2.0L', 'Petrol', 'Tucson, Sonata, ix35', 'Korea'),
    'nissan-hr15de': e('nissan-hr15de', 'Nissan', 'nissan', 'HR15DE', '1.5L', 'Petrol', 'Tiida, Note, Sunny'),
    'nissan-hr16de': e('nissan-hr16de', 'Nissan', 'nissan', 'HR16DE', '1.6L', 'Petrol', 'Tiida, Note, Juke'),
    'nissan-qr25de': e('nissan-qr25de', 'Nissan', 'nissan', 'QR25DE', '2.5L', 'Petrol', 'X-Trail, Altima, Navara'),
    'honda-k24a': e('honda-k24a', 'Honda', 'honda', 'K24A', '2.4L', 'Petrol', 'Accord, CR-V, Odyssey'),
  };

  window.SEO_ENGINES = SEO_ENGINES;
})();
