/**
 * AsiaPower — Brand Catalog Data
 * Overview, product categories and popular engine models for all brand detail pages.
 */
(function () {
  'use strict';

  const E = {
    toyota: [
      '1NZ-FE', '2NZ-FE', '1ZZ-FE', '3ZZ-FE', '2AZ-FE', '1AZ-FE', '2ZR-FE', '3ZR-FE',
      '2TR-FE', '1GR-FE', '2GR-FE', '1KD-FTV', '2KD-FTV',
    ],
    honda: [
      'L13A', 'L15A', 'L15B', 'R18A', 'R20A', 'K20A', 'K24A', 'J30A', 'J35A',
    ],
    nissan: [
      'GA16DE', 'QG15DE', 'QG18DE', 'HR15DE', 'HR16DE', 'MR18DE', 'MR20DE',
      'QR20DE', 'QR25DE', 'VQ25DE', 'VQ35DE',
    ],
    hyundaiKia: [
      'G4FA', 'G4FC', 'G4FG', 'G4GC', 'G4KD', 'G4KE', 'G4KJ', 'G4KH', 'G4NA',
      'G4NB', 'G4NC', 'G6BA', 'G6EA', 'G6DB', 'G6DH',
    ],
    mazda: ['ZJ', 'ZY', 'ZM', 'LF', 'L3', 'PE-VPS', 'PY-VPS'],
    mitsubishi: ['4G13', '4G15', '4G18', '4G63', '4G64', '4G69', '4B10', '4B11', '4B12'],
    subaru: ['EJ15', 'EJ20', 'EJ25', 'FB20', 'FB25', 'FA20'],
    suzuki: ['F10A', 'G13B', 'G16B', 'M13A', 'M15A', 'M16A', 'J20A'],
    daihatsu: ['EF-VE', 'EJ-VE', 'K3-VE', '3SZ-VE'],
    byd: ['BYD371QA', 'BYD473QB', 'BYD476ZQA', 'BYD483QA', 'BYD487ZQA'],
    geely: ['JL4G15', 'JL4G18', 'JLB-4G13T', 'JLE-4G18TD'],
    chery: ['SQR372', 'SQR472', 'SQR477', 'E4G15', 'E4G16', 'SQRE4T15C'],
    gwm: ['GW4G15', 'GW4G15T', 'GW4B15A', 'GW4C20', 'GW4N20'],
    ford: ['Duratec 1.5', 'Duratec 2.0', 'EcoBoost 1.5', 'EcoBoost 2.0', 'EcoBoost 2.3'],
    gm: ['L2B', 'F16D3', 'F18D4', 'LE5', 'LAF', 'LUJ'],
    vwGroup: ['EA111', 'EA211', 'EA113', 'EA888', 'CAYC', 'CBZ', 'CDA', 'BWA'],
    bmw: ['N42', 'N46', 'N52', 'N54', 'N55', 'B48', 'B58'],
    mercedes: ['M111', 'M112', 'M113', 'M271', 'M272', 'M274', 'M276'],
    lexus: ['2GR-FE', '1GR-FE', '1UR-FSE', '2UR-FSE', '3UR-FBE', '1NZ-FE', '2AR-FE', '8AR-FTS'],
    acura: ['K24A', 'J35A', 'R20A', 'L15B', 'J30A', 'K20A'],
    infiniti: ['VQ35DE', 'VQ25DE', 'QR25DE', 'HR16DE', 'MR20DE', 'VK56VD'],
    genesis: ['G4KH', 'G6DH', 'G4NA', 'G4KE', 'G4KJ', 'G6DB'],
    mg: ['15S4C', '18K4G', '20T4E5', 'NSE Major', 'SGE Plus'],
    chineseOem: ['4G15', '4G18', '4A91', '4A92', '4B11', 'SQRE4T15C', 'E4G16'],
  };

  function brand(name, slug, initial, origin, lead, popularEngines, overview) {
    return {
      name,
      slug,
      initial,
      origin,
      lead,
      overview: overview || lead,
      popularEngines: popularEngines || [],
    };
  }

  const BRAND_CATALOG = {
    toyota: brand(
      'Toyota', 'toyota', 'T', 'Japan',
      'Global Toyota powertrain sourcing — engines, gearboxes, chassis parts and half-cuts for Corolla, Hilux, Land Cruiser and commercial applications.',
      E.toyota,
      'AsiaPower supplies Toyota petrol and diesel engines, automatic and manual gearboxes, chassis components and half-cuts through a verified China-based supplier network. Units are sourced for global export with inspection documentation — ideal for importers, workshops and fleet rebuild programs.'
    ),
    lexus: brand(
      'Lexus', 'lexus', 'L', 'Japan',
      'Lexus powertrain supply for premium Toyota-platform applications — engines, gearboxes, chassis parts and half-cuts.',
      E.lexus,
      'Lexus applications share Toyota powertrain architecture. AsiaPower sources Lexus-compatible engines and driveline components for global buyers requiring premium Japanese-platform units with export-ready documentation.'
    ),
    honda: brand(
      'Honda', 'honda', 'H', 'Japan',
      'Honda i-VTEC and J-series engines, gearboxes, chassis parts and half-cuts — professional B2B sourcing for global importers.',
      E.honda,
      'AsiaPower provides Honda engine codes from compact L-series to K-series and J-series V6 units, plus gearboxes, chassis parts and half-cuts. Sourced for Civic, Accord, CR-V and commercial applications worldwide.'
    ),
    acura: brand(
      'Acura', 'acura', 'A', 'Japan / USA',
      'Acura powertrain components — Honda-platform engines, gearboxes, chassis parts and half-cuts for premium applications.',
      E.acura,
      'Acura models use Honda powertrain architecture. AsiaPower sources Acura-compatible engines, transmissions and chassis components for importers servicing TLX, MDX, RDX and legacy platforms.'
    ),
    nissan: brand(
      'Nissan', 'nissan', 'N', 'Japan',
      'Nissan engines, gearboxes, chassis parts and half-cuts — from Navara diesel to VQ petrol units, exported globally.',
      E.nissan,
      'AsiaPower supplies Nissan QR, HR, MR and VQ engine families plus gearboxes, chassis parts and half-cuts. Coverage includes Navara, X-Trail, Teana and commercial platforms for global export.'
    ),
    infiniti: brand(
      'Infiniti', 'infiniti', 'I', 'Japan / USA',
      'Infiniti powertrain supply — VQ and QR engine platforms, gearboxes, chassis parts and half-cuts.',
      E.infiniti,
      'Infiniti applications draw from Nissan powertrain programs. AsiaPower sources Infiniti-compatible engines, transmissions and chassis components for G, Q and QX series rebuild and import programs.'
    ),
    mazda: brand(
      'Mazda', 'mazda', 'M', 'Japan',
      'Mazda Skyactiv and MZR engines, gearboxes, chassis parts and half-cuts for global export.',
      E.mazda,
      'AsiaPower supplies Mazda Z and L engine families, Skyactiv petrol units, gearboxes, chassis parts and half-cuts for Mazda3, Mazda6, CX-5 and BT-50 applications.'
    ),
    mitsubishi: brand(
      'Mitsubishi', 'mitsubishi', 'M', 'Japan',
      'Mitsubishi 4G and 4B engine families, gearboxes, chassis parts and half-cuts — Pajero, Triton and Lancer applications.',
      E.mitsubishi,
      'AsiaPower sources Mitsubishi petrol and diesel engines, 4WD gearboxes, chassis components and half-cuts for Pajero Sport, Triton, Outlander and legacy platforms.'
    ),
    subaru: brand(
      'Subaru', 'subaru', 'S', 'Japan',
      'Subaru boxer engines, AWD gearboxes, chassis parts and half-cuts — Forester, Impreza and Outback applications.',
      E.subaru,
      'AsiaPower supplies Subaru EJ, FB and FA boxer engines plus AWD transmissions, chassis parts and half-cuts for global importers and rebuild specialists.'
    ),
    suzuki: brand(
      'Suzuki', 'suzuki', 'S', 'Japan',
      'Suzuki compact engines, gearboxes, chassis parts and half-cuts — Swift, Vitara and Jimny applications.',
      E.suzuki,
      'AsiaPower provides Suzuki F, G, M and J engine families with gearboxes, chassis components and half-cuts for compact car and SUV platforms popular in emerging markets.'
    ),
    daihatsu: brand(
      'Daihatsu', 'daihatsu', 'D', 'Japan',
      'Daihatsu kei and compact engines, gearboxes, chassis parts and half-cuts for Asian and export markets.',
      E.daihatsu,
      'AsiaPower sources Daihatsu EF, EJ, K3 and 3SZ engine units plus driveline and chassis components for compact and kei vehicle rebuild programs.'
    ),
    hyundai: brand(
      'Hyundai', 'hyundai', 'H', 'Korea',
      'Hyundai Gamma, Nu and Theta engines, gearboxes, chassis parts and half-cuts for global export.',
      E.hyundaiKia,
      'AsiaPower supplies Hyundai G4 and G6 engine families, D-series diesel units, automatic and manual gearboxes, chassis parts and half-cuts for Sonata, Tucson, Santa Fe and commercial lines.'
    ),
    kia: brand(
      'Kia', 'kia', 'K', 'Korea',
      'Kia powertrain supply — shared Hyundai-Kia platform engines, gearboxes, chassis parts and half-cuts.',
      E.hyundaiKia,
      'AsiaPower sources Kia-compatible G4 and G6 engines, transmissions, chassis components and half-cuts for Sportage, Sorento, Cerato and Carnival applications worldwide.'
    ),
    genesis: brand(
      'Genesis', 'genesis', 'G', 'Korea',
      'Genesis premium powertrain supply — Hyundai-Kia platform engines, gearboxes and chassis components.',
      E.genesis,
      'Genesis luxury models use Hyundai-Kia powertrain architecture. AsiaPower supplies Genesis-compatible engines, gearboxes and chassis parts for G70, G80, GV70 and GV80 service programs.'
    ),
    byd: brand(
      'BYD', 'byd', 'B', 'China',
      'BYD petrol, hybrid and PHEV powertrain components — engines, gearboxes, chassis parts and half-cuts.',
      E.byd,
      'AsiaPower sources BYD engine and driveline components for Song, Qin, Tang and Han platforms — supporting global buyers in China new-energy and conventional rebuild markets.'
    ),
    geely: brand(
      'Geely', 'geely', 'G', 'China',
      'Geely engine platforms, gearboxes, chassis parts and half-cuts for global export programs.',
      E.geely,
      'AsiaPower supplies Geely JL-series engines, transmissions, chassis parts and half-cuts for Coolray, Emgrand, Atlas and export-market Geely applications.'
    ),
    zeekr: brand(
      'Zeekr', 'zeekr', 'Z', 'China',
      'Zeekr powertrain and chassis supply — Geely SEA platform engines, gearboxes and components.',
      E.geely,
      'Zeekr models share Geely Group powertrain architecture. AsiaPower sources Zeekr-compatible engines, gearboxes, chassis parts and half-cuts for service and import programs.'
    ),
    'lynk-co': brand(
      'Lynk & Co', 'lynk-co', 'L', 'China / Sweden',
      'Lynk & Co powertrain supply — Volvo-Geely platform engines, gearboxes and chassis components.',
      E.geely,
      'Lynk & Co uses Geely-Volvo shared architecture. AsiaPower supplies compatible engines, transmissions, chassis parts and half-cuts for 01, 02 and 03 series applications.'
    ),
    geometry: brand(
      'Geometry', 'geometry', 'G', 'China',
      'Geometry EV and hybrid powertrain components — engines, gearboxes and chassis parts.',
      E.geely,
      'Geometry is Geely\'s electric-focused brand. AsiaPower sources Geometry-compatible powertrain and chassis components for C and E series service and export programs.'
    ),
    chery: brand(
      'Chery', 'chery', 'C', 'China',
      'Chery ACTECO engines, gearboxes, chassis parts and half-cuts — one of China\'s largest automotive exporters.',
      E.chery,
      'AsiaPower supplies Chery SQR and E-series engines, transmissions, chassis components and half-cuts for Tiggo, Arrizo and Exeed-platform export programs.'
    ),
    exeed: brand(
      'Exeed', 'exeed', 'E', 'China',
      'Exeed premium Chery-platform engines, gearboxes, chassis parts and half-cuts.',
      E.chery,
      'Exeed is Chery\'s premium export brand. AsiaPower sources Exeed-compatible ACTECO engines, gearboxes, chassis parts and half-cuts for LX, TXL and VX applications.'
    ),
    jetour: brand(
      'Jetour', 'jetour', 'J', 'China',
      'Jetour SUV powertrain supply — Chery-platform engines, gearboxes and chassis components.',
      E.chery,
      'Jetour SUV models use Chery powertrain architecture. AsiaPower supplies Jetour-compatible engines, transmissions, chassis parts and half-cuts for X70, X90 and Dashing lines.'
    ),
    omoda: brand(
      'Omoda', 'omoda', 'O', 'China',
      'Omoda crossover powertrain supply — Chery-platform engines, gearboxes and chassis parts.',
      E.chery,
      'Omoda shares Chery Group engine and driveline programs. AsiaPower sources Omoda-compatible powertrain and chassis components for C5 and export crossover applications.'
    ),
    jaecoo: brand(
      'Jaecoo', 'jaecoo', 'J', 'China',
      'Jaecoo off-road SUV powertrain supply — Chery-platform engines, gearboxes and chassis components.',
      E.chery,
      'Jaecoo models use Chery 4WD and turbo engine architecture. AsiaPower supplies Jaecoo-compatible engines, gearboxes, chassis parts and half-cuts for J7 and J8 programs.'
    ),
    'great-wall': brand(
      'Great Wall', 'great-wall', 'G', 'China',
      'Great Wall and Wingle powertrain supply — GW engine family, gearboxes, chassis parts and half-cuts.',
      E.gwm,
      'AsiaPower sources Great Wall GW-series petrol and diesel engines, gearboxes, chassis components and half-cuts for Wingle, Poer and legacy pickup platforms.'
    ),
    haval: brand(
      'Haval', 'haval', 'H', 'China',
      'Haval SUV engines, gearboxes, chassis parts and half-cuts — GW4 platform supply.',
      E.gwm,
      'Haval is Great Wall\'s SUV brand. AsiaPower supplies Haval-compatible GW4 engines, transmissions, chassis parts and half-cuts for H6, Jolion and H9 applications.'
    ),
    tank: brand(
      'Tank', 'tank', 'T', 'China',
      'Tank off-road SUV powertrain supply — Great Wall GW4 and diesel platforms.',
      E.gwm,
      'Tank models use Great Wall turbo petrol and diesel architecture. AsiaPower sources Tank-compatible engines, 4WD gearboxes, chassis parts and half-cuts for 300 and 500 series.'
    ),
    ora: brand(
      'Ora', 'ora', 'O', 'China',
      'Ora electric and hybrid platform components — powertrain units, gearboxes and chassis parts.',
      E.gwm,
      'Ora is Great Wall\'s EV-focused brand. AsiaPower supplies Ora-compatible driveline and chassis components for Good Cat, Ballet Cat and export EV service programs.'
    ),
    mg: brand(
      'MG', 'mg', 'M', 'China / UK',
      'MG engines, gearboxes, chassis parts and half-cuts — SAIC-MG platform supply for global export.',
      E.mg,
      'AsiaPower sources MG petrol and turbo engines, gearboxes, chassis parts and half-cuts for MG ZS, HS, MG5 and export-market applications.'
    ),
    roewe: brand(
      'Roewe', 'roewe', 'R', 'China',
      'Roewe SAIC-platform engines, gearboxes, chassis parts and half-cuts.',
      E.mg,
      'Roewe shares SAIC engine and driveline architecture with MG. AsiaPower supplies Roewe-compatible powertrain and chassis components for RX5, i5 and commercial lines.'
    ),
    gac: brand(
      'GAC', 'gac', 'G', 'China',
      'GAC Trumpchi engines, gearboxes, chassis parts and half-cuts for domestic and export markets.',
      E.chineseOem,
      'AsiaPower sources GAC petrol and turbo engines, transmissions, chassis components and half-cuts for GS4, GS8 and Trumpchi export programs.'
    ),
    jac: brand(
      'JAC', 'jac', 'J', 'China',
      'JAC commercial and passenger powertrain supply — engines, gearboxes and chassis parts.',
      E.chineseOem,
      'AsiaPower supplies JAC engine and driveline components for T6, S4 and commercial pickup platforms serving African, Middle Eastern and Asian import markets.'
    ),
    dongfeng: brand(
      'Dongfeng', 'dongfeng', 'D', 'China',
      'Dongfeng passenger and commercial powertrain supply — engines, gearboxes and chassis components.',
      E.chineseOem,
      'AsiaPower sources Dongfeng-compatible engines, gearboxes, chassis parts and half-cuts for Fengon, Forthing and commercial vehicle rebuild programs.'
    ),
    faw: brand(
      'FAW', 'faw', 'F', 'China',
      'FAW Group engines, gearboxes, chassis parts and half-cuts — Bestune and Hongqi platforms.',
      E.chineseOem,
      'AsiaPower supplies FAW-compatible powertrain and chassis components for Bestune, Hongqi and commercial platforms through China-based sourcing channels.'
    ),
    foton: brand(
      'Foton', 'foton', 'F', 'China',
      'Foton commercial vehicle engines, gearboxes and chassis components for global export.',
      E.chineseOem,
      'AsiaPower sources Foton diesel and petrol engines, transmissions and chassis parts for Tunland, View and commercial fleet rebuild programs worldwide.'
    ),
    jmc: brand(
      'JMC', 'jmc', 'J', 'China',
      'JMC pickup and SUV powertrain supply — engines, gearboxes and chassis parts.',
      E.chineseOem,
      'AsiaPower supplies JMC-compatible engines, gearboxes, chassis components and half-cuts for Vigus, Yusheng and commercial pickup export markets.'
    ),
    maxus: brand(
      'Maxus', 'maxus', 'M', 'China',
      'Maxus van and SUV powertrain supply — diesel and petrol engines, gearboxes and chassis parts.',
      E.chineseOem,
      'AsiaPower sources Maxus G10, D90 and T60-compatible engines, transmissions and chassis components for commercial and passenger export programs.'
    ),
    ford: brand(
      'Ford', 'ford', 'F', 'USA / Global',
      'Ford Duratec and EcoBoost engines, gearboxes, chassis parts and half-cuts for global export.',
      E.ford,
      'AsiaPower supplies Ford Duratec and EcoBoost petrol engines, automatic and manual gearboxes, chassis parts and half-cuts for Ranger, Focus, Escape and commercial applications.'
    ),
    lincoln: brand(
      'Lincoln', 'lincoln', 'L', 'USA',
      'Lincoln premium Ford-platform engines, gearboxes and chassis components.',
      E.ford,
      'Lincoln models use Ford EcoBoost and Duratec architecture. AsiaPower sources Lincoln-compatible engines, transmissions, chassis parts and half-cuts for MKZ, Nautilus and Navigator programs.'
    ),
    chevrolet: brand(
      'Chevrolet', 'chevrolet', 'C', 'USA / Global',
      'Chevrolet GM-family engines, gearboxes, chassis parts and half-cuts for global importers.',
      E.gm,
      'AsiaPower supplies Chevrolet Ecotec and small-block engine families, transmissions, chassis parts and half-cuts for Cruze, Captiva, Colorado and export-market applications.'
    ),
    gmc: brand(
      'GMC', 'gmc', 'G', 'USA',
      'GMC truck and SUV powertrain supply — GM Ecotec and V6 engine platforms.',
      E.gm,
      'AsiaPower sources GMC-compatible GM engine and driveline components for Sierra, Terrain and commercial truck rebuild programs.'
    ),
    buick: brand(
      'Buick', 'buick', 'B', 'USA / China',
      'Buick GM-platform engines, gearboxes, chassis parts and half-cuts.',
      E.gm,
      'Buick models share GM global powertrain architecture. AsiaPower supplies Buick-compatible engines, transmissions and chassis components for Enclave, Encore and Regal applications.'
    ),
    cadillac: brand(
      'Cadillac', 'cadillac', 'C', 'USA',
      'Cadillac premium GM powertrain supply — Ecotec, V6 and turbo engine platforms.',
      E.gm,
      'AsiaPower sources Cadillac-compatible GM engines, gearboxes, chassis parts and half-cuts for ATS, XT5 and Escalade service and import programs.'
    ),
    volkswagen: brand(
      'Volkswagen', 'volkswagen', 'V', 'Germany',
      'Volkswagen EA engine family supply — petrol and TSI units, gearboxes, chassis parts and half-cuts.',
      E.vwGroup,
      'AsiaPower supplies Volkswagen EA111, EA211 and EA888 engines, DSG and manual gearboxes, chassis parts and half-cuts for Golf, Passat, Tiguan and commercial lines.'
    ),
    audi: brand(
      'Audi', 'audi', 'A', 'Germany',
      'Audi VW Group TFSI engines, gearboxes, chassis parts and half-cuts.',
      E.vwGroup,
      'Audi shares Volkswagen Group EA and TFSI architecture. AsiaPower sources Audi-compatible engines, transmissions and chassis components for A3, A4, Q5 and Q7 programs.'
    ),
    skoda: brand(
      'Skoda', 'skoda', 'S', 'Czech Republic',
      'Skoda VW Group platform engines, gearboxes and chassis components.',
      E.vwGroup,
      'Skoda models use Volkswagen Group MQB powertrain architecture. AsiaPower supplies Skoda-compatible EA engines, gearboxes and chassis parts for Octavia, Superb and Kodiaq applications.'
    ),
    seat: brand(
      'Seat', 'seat', 'S', 'Spain',
      'Seat VW Group TSI engines, gearboxes, chassis parts and half-cuts.',
      E.vwGroup,
      'Seat shares Volkswagen Group engine and driveline programs. AsiaPower sources Seat-compatible powertrain and chassis components for Ibiza, Leon and Ateca export markets.'
    ),
    'mercedes-benz': brand(
      'Mercedes-Benz', 'mercedes-benz', 'M', 'Germany',
      'Mercedes-Benz M-series engines, gearboxes, chassis parts and half-cuts for global export.',
      E.mercedes,
      'AsiaPower supplies Mercedes-Benz M111 through M276 engine families, automatic gearboxes, chassis components and half-cuts for C-Class, E-Class and commercial van applications.'
    ),
    bmw: brand(
      'BMW', 'bmw', 'B', 'Germany',
      'BMW N and B engine family supply — petrol and turbo units, gearboxes and chassis parts.',
      E.bmw,
      'AsiaPower sources BMW N42 through B58 engine platforms, ZF and Steptronic gearboxes, chassis parts and half-cuts for 3 Series, 5 Series and X Series applications.'
    ),
    mini: brand(
      'MINI', 'mini', 'M', 'UK / Germany',
      'MINI BMW-platform engines, gearboxes and chassis components.',
      E.bmw,
      'MINI models use BMW Group engine architecture. AsiaPower supplies MINI-compatible N and B engine units, gearboxes and chassis parts for Cooper, Countryman and Clubman programs.'
    ),
  };

  window.BRAND_CATALOG = BRAND_CATALOG;
})();
