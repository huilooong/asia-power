'use strict';

const http = require('http');
const { clientIp } = require('./rate-limit');

const CACHE = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 3000;
const LOOKUP_TIMEOUT_MS = 2500;

function isPrivateIp(ip) {
  if (!ip || ip === 'unknown') return true;
  if (ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) {
    return true;
  }
  if (/^fc|^fd|^fe80/i.test(ip.replace(/:/g, ''))) return true;
  return false;
}

function cacheGet(ip) {
  const entry = CACHE.get(ip);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(ip);
    return undefined;
  }
  return entry.value;
}

function cacheSet(ip, value) {
  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  CACHE.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function fetchIpApi(ip) {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city`;
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: LOOKUP_TIMEOUT_MS }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.status !== 'success') return resolve(null);
          resolve({
            country: String(data.country || '').trim() || null,
            countryCode: String(data.countryCode || '').trim() || null,
            region: String(data.regionName || '').trim() || null,
            city: String(data.city || '').trim() || null,
          });
        } catch {
          resolve(null);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

async function lookupIpGeo(ip) {
  const normalized = String(ip || '').trim();
  if (!normalized || isPrivateIp(normalized)) return null;

  const cached = cacheGet(normalized);
  if (cached !== undefined) return cached;

  const geo = await fetchIpApi(normalized);
  cacheSet(normalized, geo);
  return geo;
}

async function resolveClientGeo(req) {
  const ip = clientIp(req);
  const geo = await lookupIpGeo(ip);
  return {
    ip,
    ipCountry: geo?.country || null,
    ipCity: geo?.city || null,
    ipRegion: geo?.region || null,
    ipCountryCode: geo?.countryCode || null,
  };
}

function formatIpLocation(lead) {
  const city = String(lead?.ipCity || '').trim();
  const region = String(lead?.ipRegion || '').trim();
  const country = String(lead?.ipCountry || '').trim();
  const parts = [];
  if (city) parts.push(city);
  if (region && region !== city) parts.push(region);
  if (country) parts.push(country);
  if (parts.length) return parts.join(', ');
  if (lead?.clientIp) return 'Unknown location';
  return null;
}

module.exports = {
  lookupIpGeo,
  resolveClientGeo,
  formatIpLocation,
  isPrivateIp,
};
