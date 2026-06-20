'use strict';

function clientIp(req) {
  const trustProxy = process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production';
  let ip = req.socket?.remoteAddress || 'unknown';
  if (trustProxy) {
    const realIp = req.headers['x-real-ip'];
    if (realIp) ip = String(realIp).trim();
    else {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) ip = String(forwarded).split(',')[0].trim();
    }
  }
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

function createRateLimiter({ windowMs = 60_000, max = 60, keyFn = clientIp } = {}) {
  const hits = new Map();

  return function allow(req) {
    const key = keyFn(req);
    const now = Date.now();
    const bucket = hits.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    hits.set(key, bucket);
    return bucket.count <= max;
  };
}

module.exports = { createRateLimiter, clientIp };
