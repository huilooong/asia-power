#!/usr/bin/env node
'use strict';

/**
 * QXB VinDecoder/decode connectivity test — Step 9/10 of the VIN integration plan.
 *
 * This is a CONNECTIVITY check only. It does not represent a business result
 * and does not feed the knowledge base's confirmed dictionaries. It uses the
 * VIN from the existing `SUB-TEST` submission record (data/half-cut-submissions.json),
 * which is itself placeholder test data, not a real customer vehicle — there is
 * currently no real VIN anywhere in AsiaPower's inventory to test with.
 *
 * Usage:
 *   node scripts/vin-connectivity-test.js [VIN]
 *
 * Requires QXB_APPID / QXB_SECRET in .env, and a confirmed auth scheme in
 * server/lib/vin/qxb-client.js (buildAuthParams) — until that exists this
 * script will fail fast with a clear error, by design.
 */

const path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadEnv } = require('../server/lib/load-env');
loadEnv(ROOT);

const { decodeVin } = require('../server/lib/vin/qxb-client');
const { createVehicleKnowledgeBase } = require('../server/lib/vin/knowledge-base');

const TEST_VIN = process.argv[2] || 'MR0BA3CD500123456';

async function main() {
  console.log('=== QXB Connectivity Test ===');
  console.log('VIN under test (placeholder/test data, not real inventory):', TEST_VIN);

  const kb = createVehicleKnowledgeBase(path.join(ROOT, 'data'));
  const cached = kb.getCachedVin(TEST_VIN);
  if (cached) {
    console.log('\n[VIN Cache] Already have a cached result for this VIN — skipping API call.');
    console.log(JSON.stringify(cached, null, 2));
    return;
  }

  let result;
  try {
    result = await decodeVin(TEST_VIN);
  } catch (err) {
    console.error('\n[FAILED] Could not call QXB API:');
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  if (result.invalid_vin) {
    console.error('\n[invalid_vin]', result.reason);
    process.exitCode = 1;
    return;
  }

  console.log('\n--- FULL REQUEST ---');
  console.log(JSON.stringify(result.request, null, 2));
  console.log('\n--- FULL RESPONSE ---');
  console.log(JSON.stringify(result.response, null, 2));

  kb.cacheVinResult(TEST_VIN, result.response.json || result.response.rawBody, {
    source: 'qxb-connectivity-test',
    requestedAt: result.request.sentAt,
  });
  console.log('\n[VIN Cache] Raw response saved to data/knowledge-base/vin-cache.json for Mapping Layer review.');
}

main();
