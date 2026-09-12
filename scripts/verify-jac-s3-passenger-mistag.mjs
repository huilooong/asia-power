#!/usr/bin/env node
/**
 * Regression: passenger/engine listings must not stay in truck cab,
 * and Hyundai commercial trucks must not stay in passenger.
 * Usage: node scripts/verify-jac-s3-passenger-mistag.mjs
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nameNorm = require(path.join(__dirname, '..', 'server', 'lib', 'vehicle-name-normalize.js'));
const { toPublicItem } = require(path.join(__dirname, '..', 'server', 'lib', 'half-cut-public.js'));

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

const hc250613 = {
  stockId: 'HC250613',
  brand: 'JAC',
  model: 'S3',
  title: '2018 JAC S3 HFC4GB2.3E 5MT. 6MT. CVT 2WD',
  vehicleCategory: 'truck',
  vehicleCondition: 'Driver Cab',
  truckPartType: 'cab',
  passengerPartType: 'front',
  slug: 'jac-s3-2018-hfc4gb2-3e-truck-cab-hc250613',
  priceUsd: 300,
  includedParts: ['Front clip assembly'],
};

const jacTruck = {
  stockId: 'HC250126',
  brand: 'JAC',
  model: 'Shuailing',
  title: '2017 JAC Shuailing 2WD',
  vehicleCategory: 'truck',
  vehicleCondition: 'Driver Cab',
  truckPartType: 'cab',
  slug: 'jac-shuailing-2017-cab-truck-cab-hc250126',
};

const jacLightTruck = {
  stockId: 'HC250621',
  brand: 'JAC',
  model: '轻型货车',
  title: '2015 JAC 15010228 2WD',
  vehicleCategory: 'truck',
  vehicleCondition: 'Truck Part',
  truckPartType: 'other',
};

const refineM5 = {
  stockId: 'HC250153',
  brand: 'JAC',
  model: 'Refine M5',
  title: '2013 JAC Refine M5 HFC4GA3.1D 6MT 2WD',
  vehicleCategory: 'passenger',
  vehicleCondition: 'Half Cut',
};

const xc60 = {
  stockId: 'HC250581',
  brand: 'Volvo',
  model: 'XC60',
  title: '2017 Volvo XC60 B4204T11 8AT 2WD',
  vehicleCategory: 'truck',
  vehicleCondition: 'Driver Cab',
  truckPartType: 'cab',
  slug: 'volvo-xc60-2017-b4204t11-truck-cab-hc250581',
  includedParts: ['Engine & gearbox assembly', 'Front clip', 'Wiring harness', 'Radiator pack'],
};

const volvoTruck = {
  stockId: 'HC259999',
  brand: 'Volvo',
  model: 'FH16',
  title: '2018 Volvo FH16 2WD',
  vehicleCategory: 'truck',
  vehicleCondition: 'Driver Cab',
  truckPartType: 'cab',
};

const mighty = {
  stockId: 'HC250102',
  brand: 'Hyundai Trucks',
  model: 'Mighty',
  title: '2018 Hyundai Trucks Mighty 2WD',
  vehicleCategory: 'passenger',
  vehicleCondition: 'Half Cut',
};

const hyundaiLightTruck = {
  stockId: 'HC250074',
  brand: 'Hyundai',
  model: '2018',
  title: '2018 Hyundai 2018 D6CF48E5 MT 2WD',
  engineCode: 'D6CF48E5',
  vehicleCategory: 'truck',
  vehicleCondition: 'Truck Half Cut',
  truckPartType: 'vehicle',
};

const kuayue = {
  stockId: 'HC250154',
  brand: 'Changan Kuayue',
  model: 'Xinbao Mini',
  title: '2016 Changan Kuayue Xinbao Mini DK12-10 5MT 2WD',
  vehicleCategory: 'truck',
  vehicleCondition: 'Truck Half Cut',
  truckPartType: 'vehicle',
};

const usedTire = {
  stockId: 'HC250585',
  brand: 'BYD',
  model: 'F3',
  title: '2024 BYD F3 2WD',
  vehicleCategory: 'passenger',
  vehicleCondition: 'Used Tire',
  passengerPartType: 'tire',
};

const xcient = {
  stockId: 'HC250516',
  brand: 'Hyundai Trucks',
  model: 'Xcient',
  title: '2020 Hyundai Trucks Xcient D6CF44F5 MT 2WD — Export Used Car',
  vehicleCategory: 'passenger',
  vehicleCondition: 'Running Vehicle',
  isExportUsedCar: true,
};

assert(nameNorm.isJacPassengerModel('JAC', 'S3', hc250613.title), 'JAC S3 is a passenger model');
assert(!nameNorm.isJacPassengerModel('JAC', 'Shuailing', jacTruck.title), 'JAC Shuailing stays truck');
assert(nameNorm.isVolvoPassengerModel('Volvo', 'XC60', xc60.title), 'Volvo XC60 is a passenger model');
assert(!nameNorm.isVolvoPassengerModel('Volvo', 'FH16', volvoTruck.title), 'Volvo FH16 stays truck');
assert(nameNorm.isHyundaiCommercialTruck('Hyundai Trucks', 'Mighty', mighty.title), 'Hyundai Mighty is commercial truck');
assert(!nameNorm.looksLikePassengerBrand(mighty), 'Hyundai Trucks is not a passenger brand');

const engine = nameNorm.normalizeListingMeta(hc250613);
assert(engine.vehicleCategory === 'passenger', `613 category → passenger (got ${engine.vehicleCategory})`);
assert(engine.passengerPartType === 'engine', `613 ppt → engine (got ${engine.passengerPartType})`);
assert(engine.vehicleCondition === 'Engine Assembly', `613 cond → Engine Assembly (got ${engine.vehicleCondition})`);
assert(engine.truckPartType === '', '613 truckPartType cleared');

const half = nameNorm.normalizeListingMeta(xc60);
assert(half.vehicleCategory === 'passenger', `581 category → passenger (got ${half.vehicleCategory})`);
assert(half.vehicleCondition === 'Half Cut', `581 cond → Half Cut (got ${half.vehicleCondition})`);
assert(half.truckPartType === '', '581 truckPartType cleared');

const truckMeta = nameNorm.normalizeListingMeta(jacTruck);
assert(truckMeta.vehicleCategory === 'truck', 'Shuailing stays truck');
assert(nameNorm.normalizeListingMeta(volvoTruck).vehicleCategory === 'truck', 'Volvo FH stays truck');

const mightyMeta = nameNorm.normalizeListingMeta(mighty);
assert(mightyMeta.vehicleCategory === 'truck', `Mighty → truck (got ${mightyMeta.vehicleCategory})`);
assert(mightyMeta.truckPartType === 'cab', `Mighty → cab (got ${mightyMeta.truckPartType})`);

const xcientMeta = nameNorm.normalizeListingMeta(xcient);
assert(xcientMeta.vehicleCategory === 'truck', `Xcient → truck (got ${xcientMeta.vehicleCategory})`);
assert(xcientMeta.vehicleCondition === 'Running Vehicle', 'Xcient stays running vehicle');

const pub613 = toPublicItem(hc250613);
assert(pub613.vehicleCategory === 'passenger', 'public 613 is passenger');
assert(pub613.passengerPartType === 'engine', 'public 613 is dedicated engine');
assert(pub613.vehicleCondition === 'Engine Assembly', 'public 613 Engine Assembly');

const pub581 = toPublicItem(xc60);
assert(pub581.vehicleCategory === 'passenger', 'public 581 is passenger');
assert(pub581.vehicleCondition === 'Half Cut', 'public 581 is half-cut');

const keep074 = nameNorm.normalizeListingMeta(hyundaiLightTruck);
assert(keep074.vehicleCategory === 'truck', 'Hyundai D6CF stays truck');
assert(keep074.vehicleCondition === 'Truck Half Cut', 'Hyundai D6CF stays truck half-cut');
assert(nameNorm.normalizeListingMeta(kuayue).vehicleCategory === 'truck', 'Changan Kuayue stays truck');
const tire = nameNorm.normalizeListingMeta(usedTire);
assert(tire.passengerPartType === 'tire', 'Used tire keeps ppt=tire');
assert(toPublicItem(usedTire).passengerPartType === 'tire', 'public tire listing unchanged');
assert(toPublicItem(hyundaiLightTruck).vehicleCondition === 'Truck Half Cut', 'public Hyundai D6CF unchanged');

console.log('\nAll category-mistag checks passed.');
