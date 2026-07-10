'use strict';

/**
 * Indicative CIF estimates for AsiaPower export (Qingdao / Shanghai origin).
 * Rates are reference LCL / break-bulk for half-cuts — confirmed on enquiry.
 */

const INSURANCE_LOADING = 1.1;
const INSURANCE_RATE = 0.0035;
const MIN_INSURANCE_USD = 12;

const PORTS = [
  { id: 'tema-gh', port: 'Tema', country: 'Ghana', countryCode: 'GH', region: 'West Africa' },
  { id: 'lagos-ng', port: 'Lagos (Tin Can)', country: 'Nigeria', countryCode: 'NG', region: 'West Africa' },
  { id: 'cotonou-bj', port: 'Cotonou', country: 'Benin', countryCode: 'BJ', region: 'West Africa' },
  { id: 'douala-cm', port: 'Douala', country: 'Cameroon', countryCode: 'CM', region: 'West Africa' },
  { id: 'abidjan-ci', port: 'Abidjan', country: "Côte d'Ivoire", countryCode: 'CI', region: 'West Africa' },
  { id: 'mombasa-ke', port: 'Mombasa', country: 'Kenya', countryCode: 'KE', region: 'East Africa' },
  { id: 'dar-tz', port: 'Dar es Salaam', country: 'Tanzania', countryCode: 'TZ', region: 'East Africa' },
  { id: 'durban-za', port: 'Durban', country: 'South Africa', countryCode: 'ZA', region: 'Southern Africa' },
  { id: 'jebel-ali-ae', port: 'Jebel Ali', country: 'UAE', countryCode: 'AE', region: 'Middle East' },
  { id: 'dammam-sa', port: 'Dammam', country: 'Saudi Arabia', countryCode: 'SA', region: 'Middle East' },
  { id: 'jeddah-sa', port: 'Jeddah', country: 'Saudi Arabia', countryCode: 'SA', region: 'Middle East' },
  { id: 'singapore-sg', port: 'Singapore', country: 'Singapore', countryCode: 'SG', region: 'Southeast Asia' },
  { id: 'klang-my', port: 'Port Klang', country: 'Malaysia', countryCode: 'MY', region: 'Southeast Asia' },
  { id: 'jakarta-id', port: 'Jakarta', country: 'Indonesia', countryCode: 'ID', region: 'Southeast Asia' },
  { id: 'sydney-au', port: 'Sydney', country: 'Australia', countryCode: 'AU', region: 'Oceania' },
  { id: 'auckland-nz', port: 'Auckland', country: 'New Zealand', countryCode: 'NZ', region: 'Oceania' },
  { id: 'la-us', port: 'Los Angeles', country: 'United States', countryCode: 'US', region: 'Americas' },
  { id: 'houston-us', port: 'Houston', country: 'United States', countryCode: 'US', region: 'Americas' },
  { id: 'santos-br', port: 'Santos', country: 'Brazil', countryCode: 'BR', region: 'Americas' },
  { id: 'kingston-jm', port: 'Kingston', country: 'Jamaica', countryCode: 'JM', region: 'Caribbean' },
];

const FREIGHT_USD = {
  halfcut: {
    'tema-gh': 780,
    'lagos-ng': 820,
    'cotonou-bj': 850,
    'douala-cm': 880,
    'abidjan-ci': 860,
    'mombasa-ke': 920,
    'dar-tz': 950,
    'durban-za': 1100,
    'jebel-ali-ae': 520,
    'dammam-sa': 580,
    'jeddah-sa': 560,
    'singapore-sg': 380,
    'klang-my': 420,
    'jakarta-id': 480,
    'sydney-au': 980,
    'auckland-nz': 1050,
    'la-us': 1450,
    'houston-us': 1380,
    'santos-br': 1650,
    'kingston-jm': 1200,
  },
  truck: {
    'tema-gh': 1150,
    'lagos-ng': 1200,
    'cotonou-bj': 1220,
    'douala-cm': 1250,
    'abidjan-ci': 1230,
    'mombasa-ke': 1280,
    'dar-tz': 1310,
    'durban-za': 1480,
    'jebel-ali-ae': 780,
    'dammam-sa': 850,
    'jeddah-sa': 820,
    'singapore-sg': 620,
    'klang-my': 680,
    'jakarta-id': 720,
    'sydney-au': 1420,
    'auckland-nz': 1520,
    'la-us': 1980,
    'houston-us': 1850,
    'santos-br': 2200,
    'kingston-jm': 1680,
  },
  machinery: {
    'tema-gh': 1450,
    'lagos-ng': 1520,
    'cotonou-bj': 1550,
    'douala-cm': 1580,
    'abidjan-ci': 1560,
    'mombasa-ke': 1620,
    'dar-tz': 1650,
    'durban-za': 1850,
    'jebel-ali-ae': 980,
    'dammam-sa': 1050,
    'jeddah-sa': 1020,
    'singapore-sg': 820,
    'klang-my': 880,
    'jakarta-id': 920,
    'sydney-au': 1750,
    'auckland-nz': 1880,
    'la-us': 2450,
    'houston-us': 2280,
    'santos-br': 2680,
    'kingston-jm': 2100,
  },
};

const COUNTRY_DEFAULT_PORT = {
  GH: 'tema-gh',
  NG: 'lagos-ng',
  BJ: 'cotonou-bj',
  CM: 'douala-cm',
  CI: 'abidjan-ci',
  KE: 'mombasa-ke',
  TZ: 'dar-tz',
  ZA: 'durban-za',
  AE: 'jebel-ali-ae',
  SA: 'dammam-sa',
  SG: 'singapore-sg',
  MY: 'klang-my',
  ID: 'jakarta-id',
  AU: 'sydney-au',
  NZ: 'auckland-nz',
  US: 'houston-us',
  BR: 'santos-br',
  JM: 'kingston-jm',
};

function normalizeCargo(cargo) {
  const key = String(cargo || 'halfcut').trim().toLowerCase();
  if (key === 'truck' || key === 'trucks') return 'truck';
  if (key === 'machinery' || key === 'machine') return 'machinery';
  return 'halfcut';
}

function findPort(portId) {
  return PORTS.find((entry) => entry.id === portId) || null;
}

function listPorts(cargo) {
  const type = normalizeCargo(cargo);
  const table = FREIGHT_USD[type] || FREIGHT_USD.halfcut;
  return PORTS.map((entry) => ({
    ...entry,
    freightUsd: table[entry.id] ?? null,
  })).filter((entry) => entry.freightUsd != null);
}

function resolvePortFromCountryCode(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code) return null;
  const portId = COUNTRY_DEFAULT_PORT[code];
  return portId ? findPort(portId) : null;
}

function computeInsuranceUsd(exwUsd, freightUsd) {
  const base = Math.max(0, Number(exwUsd) || 0) + Math.max(0, Number(freightUsd) || 0);
  if (base <= 0) return MIN_INSURANCE_USD;
  const raw = base * INSURANCE_LOADING * INSURANCE_RATE;
  return Math.max(MIN_INSURANCE_USD, Math.round(raw));
}

function estimateCif({ portId, cargo, exwUsd }) {
  const type = normalizeCargo(cargo);
  const port = findPort(portId);
  if (!port) {
    const err = new Error('Unknown destination port');
    err.statusCode = 400;
    throw err;
  }

  const table = FREIGHT_USD[type] || FREIGHT_USD.halfcut;
  const freightUsd = table[port.id];
  if (freightUsd == null) {
    const err = new Error('Freight rate unavailable for this port');
    err.statusCode = 400;
    throw err;
  }

  const exw = Math.max(0, Number(exwUsd) || 0);
  const insuranceUsd = computeInsuranceUsd(exw, freightUsd);
  const cifUsd = exw + freightUsd + insuranceUsd;

  return {
    port,
    cargo: type,
    exwUsd: exw,
    freightUsd,
    insuranceUsd,
    cifUsd,
    currency: 'USD',
    origin: 'Qingdao / Shanghai, China',
    disclaimer: 'Indicative estimate only. Final CIF confirmed on enquiry.',
    insuranceFormula: '110% × 0.35% of (EXW + freight)',
  };
}

function geoHintFromClient(geo) {
  const countryCode = String(geo?.ipCountryCode || geo?.countryCode || '').trim().toUpperCase();
  const port = resolvePortFromCountryCode(countryCode);
  return {
    countryCode: countryCode || null,
    country: geo?.ipCountry || geo?.country || null,
    city: geo?.ipCity || geo?.city || null,
    suggestedPortId: port?.id || 'tema-gh',
    suggestedPort: port || findPort('tema-gh'),
  };
}

module.exports = {
  PORTS,
  listPorts,
  findPort,
  estimateCif,
  resolvePortFromCountryCode,
  geoHintFromClient,
  computeInsuranceUsd,
};
