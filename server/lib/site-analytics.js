'use strict';

const fs = require('fs');
const path = require('path');
const { clientIp } = require('./rate-limit');
const { lookupIpGeo } = require('./ip-geo');

const MAX_PATH_LENGTH = 240;
const MAX_DAILY_IPS = 5000;
const RETAIN_DAYS = 90;
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|telegrambot|whatsapp|preview|headless/i;

function dayKey(date = new Date(), timeZone = process.env.TZ || 'Africa/Accra') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function createSiteAnalytics(dataDir, options = {}) {
  const timeZone = options.timeZone || process.env.TZ || 'Africa/Accra';
  const dailyFile = path.join(dataDir, 'site-analytics-daily.json');
  const geoPending = new Set();

  function loadDaily() {
    if (!fs.existsSync(dailyFile)) return {};
    try {
      const data = JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  function saveDaily(data) {
    fs.mkdirSync(path.dirname(dailyFile), { recursive: true });
    fs.writeFileSync(dailyFile, JSON.stringify(data, null, 2));
  }

  function pruneOldDays(store) {
    const keys = Object.keys(store).sort();
    if (keys.length <= RETAIN_DAYS) return;
    keys.slice(0, keys.length - RETAIN_DAYS).forEach((key) => delete store[key]);
  }

  function isBot(userAgent) {
    return BOT_UA.test(String(userAgent || ''));
  }

  function shouldTrackPage(pagePath) {
    const p = String(pagePath || '').split('?')[0];
    if (!p || p.startsWith('/api/') || p.startsWith('/uploads/')) return false;
    if (p.startsWith('/admin/')) return false;
    if (p.includes('/supplier-portal/half-cut-upload')) return false;
    if (p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.png') || p.endsWith('.webp')) return false;
    return p.endsWith('.html') || p === '/' || p.endsWith('/') || !path.extname(p.replace(/\/$/, ''));
  }

  function ensureDayBucket(store, day) {
    if (!store[day]) {
      store[day] = {
        pageviews: 0,
        whatsappClicks: 0,
        uniqueIps: {},
        paths: {},
        countries: {},
        updatedAt: new Date().toISOString(),
      };
    }
    return store[day];
  }

  function bumpMapCounter(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }

  function topEntries(map, limit = 8) {
    return Object.entries(map || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  async function enrichIpGeo(day, ip) {
    if (!ip || geoPending.has(`${day}:${ip}`)) return;
    geoPending.add(`${day}:${ip}`);
    try {
      const geo = await lookupIpGeo(ip);
      if (!geo?.country) return;
      const store = loadDaily();
      const bucket = store[day];
      const entry = bucket?.uniqueIps?.[ip];
      if (!entry) return;
      entry.country = geo.country;
      entry.city = geo.city || null;
      entry.region = geo.region || null;
      bumpMapCounter(bucket.countries, geo.country);
      bucket.updatedAt = new Date().toISOString();
      saveDaily(store);
    } catch {
      // ignore geo failures
    } finally {
      geoPending.delete(`${day}:${ip}`);
    }
  }

  function recordPageView(req, pagePath) {
    if (!req || req.method !== 'GET') return;
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua)) return;

    const page = String(pagePath || '').slice(0, MAX_PATH_LENGTH);
    if (!shouldTrackPage(page)) return;

    const ip = clientIp(req) || 'unknown';
    const day = dayKey(new Date(), timeZone);
    const store = loadDaily();
    const bucket = ensureDayBucket(store, day);
    const now = new Date().toISOString();

    bucket.pageviews += 1;
    bumpMapCounter(bucket.paths, page || '/');

    if (!bucket.uniqueIps[ip]) {
      if (Object.keys(bucket.uniqueIps).length >= MAX_DAILY_IPS) return;
      bucket.uniqueIps[ip] = {
        hits: 0,
        country: null,
        city: null,
        region: null,
        lastPath: page || '/',
        firstSeen: now,
        lastSeen: now,
      };
    }

    const entry = bucket.uniqueIps[ip];
    entry.hits += 1;
    entry.lastPath = page || '/';
    entry.lastSeen = now;
    bucket.updatedAt = now;

    pruneOldDays(store);
    saveDaily(store);

    if (ip !== 'unknown' && !entry.country) {
      enrichIpGeo(day, ip).catch(() => {});
    }
  }

  function recordEvent(req, eventType, meta = {}) {
    if (eventType !== 'whatsapp_click') return;
    const day = dayKey(new Date(), timeZone);
    const store = loadDaily();
    const bucket = ensureDayBucket(store, day);
    bucket.whatsappClicks += 1;
    if (meta.page) bumpMapCounter(bucket.paths, String(meta.page).slice(0, MAX_PATH_LENGTH));
    bucket.updatedAt = new Date().toISOString();
    pruneOldDays(store);
    saveDaily(store);

    if (req) recordPageView(req, meta.page || '/');
  }

  function summarizeDay(day, bucket) {
    if (!bucket) {
      return {
        day,
        pageviews: 0,
        uniqueIpCount: 0,
        whatsappClicks: 0,
        topPaths: [],
        topCountries: [],
        ips: [],
      };
    }

    const ips = Object.entries(bucket.uniqueIps || {})
      .map(([ip, info]) => ({
        ip,
        hits: info.hits || 0,
        country: info.country || null,
        city: info.city || null,
        region: info.region || null,
        lastPath: info.lastPath || null,
        firstSeen: info.firstSeen || null,
        lastSeen: info.lastSeen || null,
      }))
      .sort((a, b) => b.hits - a.hits);

    return {
      day,
      pageviews: bucket.pageviews || 0,
      uniqueIpCount: ips.length,
      whatsappClicks: bucket.whatsappClicks || 0,
      topPaths: topEntries(bucket.paths, 10),
      topCountries: topEntries(bucket.countries, 10),
      ips,
      updatedAt: bucket.updatedAt || null,
    };
  }

  function getSummary({ days = 7, day = null } = {}) {
    const store = loadDaily();
    if (day) return summarizeDay(day, store[day]);

    const keys = Object.keys(store).sort().reverse().slice(0, Math.max(1, Number(days) || 7));
    return {
      timeZone,
      days: keys.map((key) => summarizeDay(key, store[key])),
    };
  }

  function buildDailyReportText(day = dayKey(new Date(), timeZone)) {
    const summary = summarizeDay(day, loadDaily()[day]);
    const lines = [
      `🌐 Website traffic (${day}, ${timeZone})`,
      `Page views: ${summary.pageviews}`,
      `Unique IPs: ${summary.uniqueIpCount}`,
      `WhatsApp clicks: ${summary.whatsappClicks}`,
    ];

    if (summary.topPaths.length) {
      lines.push('', 'Top pages:');
      summary.topPaths.forEach(([page, count]) => lines.push(`- ${page} (${count})`));
    }

    if (summary.topCountries.length) {
      lines.push('', 'Top countries (IP geo):');
      summary.topCountries.forEach(([country, count]) => lines.push(`- ${country} (${count})`));
    }

    if (summary.ips.length) {
      lines.push('', 'Top IPs:');
      summary.ips.slice(0, 8).forEach((entry) => {
        const place = [entry.city, entry.country].filter(Boolean).join(', ');
        lines.push(`- ${entry.ip} (${entry.hits})${place ? ` · ${place}` : ''}`);
      });
    }

    return lines.join('\n');
  }

  return {
    dailyFile,
    dayKey: (date) => dayKey(date, timeZone),
    recordPageView,
    recordEvent,
    getSummary,
    buildDailyReportText,
    shouldTrackPage,
  };
}

module.exports = {
  createSiteAnalytics,
  dayKey,
};
