#!/usr/bin/env node
/**
 * Regression: JAC passenger series (S3 / Refine) must not stay in truck cab.
 * Usage: node scripts/verify-jac-s3-passenger-mistag.mjs
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nameNorm = require(path.join(__dirname, '..', 'server', 'lib', 'vehicle-name-normalize.js'));

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

assert(nameNorm.isJacPassengerModel('JAC', 'S3', hc250613.title), 'JAC S3 is a passenger model');
assert(!nameNorm.isJacPassengerModel('JAC', 'Shuailing', jacTruck.title), 'JAC Shuailing stays truck');
assert(!nameNorm.isJacPassengerModel('JAC', '轻型货车', jacLightTruck.title), 'JAC light truck stays truck');
assert(nameNorm.looksLikePassengerBrand(hc250613), 'HC250613 looks like passenger');
assert(!nameNorm.looksLikePassengerBrand(jacTruck), 'Shuailing does not look like passenger');
assert(nameNorm.looksLikePassengerBrand(refineM5), 'Refine M5 looks like passenger');

const fixed = nameNorm.normalizeListingMeta(hc250613);
assert(fixed.vehicleCategory === 'passenger', `HC250613 category → passenger (got ${fixed.vehicleCategory})`);
assert(fixed.truckPartType === '', `HC250613 truckPartType cleared (got ${JSON.stringify(fixed.truckPartType)})`);
assert(fixed.vehicleCondition !== 'Driver Cab', `HC250613 leaves Driver Cab (got ${fixed.vehicleCondition})`);
assert(fixed.passengerPartType === 'front', 'HC250613 keeps passengerPartType=front');
assert(fixed.vehicleCondition === 'Front Cut', `HC250613 condition → Front Cut from ppt (got ${fixed.vehicleCondition})`);

const truckMeta = nameNorm.normalizeListingMeta(jacTruck);
assert(truckMeta.vehicleCategory === 'truck', 'Shuailing stays truck after normalize');
assert(truckMeta.truckPartType === 'cab', 'Shuailing stays cab');

const lightMeta = nameNorm.normalizeListingMeta(jacLightTruck);
assert(lightMeta.vehicleCategory === 'truck', 'JAC 轻型货车 stays truck');

console.log('\nAll JAC S3 passenger-mistag checks passed.');
