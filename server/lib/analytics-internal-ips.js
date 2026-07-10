'use strict';

/** Ghana office / internal QA IPs — presentation-layer filter only; raw data unchanged. */
const INTERNAL_TEST_IPS = new Set([
  '154.160.0.87',
  '154.160.16.2',
  '154.160.2.165',
  '154.160.22.51',
  '154.161.159.43',
  '154.161.36.176',
  '154.161.50.101',
]);

const INTERNAL_PREFIXES = ['154.160.', '154.161.'];

function isInternalTestIp(ip, hits = 0) {
  if (!ip || ip === 'unknown') return false;
  if (INTERNAL_TEST_IPS.has(ip)) return true;
  if (hits > 50 && INTERNAL_PREFIXES.some((p) => ip.startsWith(p))) return true;
  return false;
}

module.exports = {
  INTERNAL_TEST_IPS,
  INTERNAL_PREFIXES,
  isInternalTestIp,
};
