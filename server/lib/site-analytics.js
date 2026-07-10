'use strict';

const fs = require('fs');
const path = require('path');
const { clientIp } = require('./rate-limit');
const { lookupIpGeo } = require('./ip-geo');
const { isInternalTestIp } = require('./analytics-internal-ips');

const MAX_PATH_LENGTH = 240;
const MAX_DAILY_IPS = 5000;
const RETAIN_DAYS = 90;
const FLUSH_MS = 15000;
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
  const searchTrendsFile = path.join(dataDir, 'site-search-trends.json');
  const MAX_SEARCH_TERMS = 500;
  const MAX_SEARCH_QUERY_LEN = 80;
  const geoPending = new Set();
  let store = null;
  let searchTrends = null;
  let dirty = false;
  let searchDirty = false;
  let flushTimer = null;

  function loadDailyFromDisk() {
    if (!fs.existsSync(dailyFile)) return {};
    try {
      const data = JSON.parse(fs.readFileSync(dailyFile, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  function getStore() {
    if (!store) store = loadDailyFromDisk();
    return store;
  }

  function flushDaily() {
    if (flushTimer) flushTimer = null;
    if (dirty && store) {
      dirty = false;
      fs.mkdirSync(path.dirname(dailyFile), { recursive: true });
      fs.writeFileSync(dailyFile, JSON.stringify(store, null, 2));
    }
    flushSearchTrends();
  }

  function loadSearchTrendsFromDisk() {
    if (!fs.existsSync(searchTrendsFile)) return { queries: {} };
    try {
      const data = JSON.parse(fs.readFileSync(searchTrendsFile, 'utf8'));
      return data && typeof data === 'object' && data.queries ? data : { queries: {} };
    } catch {
      return { queries: {} };
    }
  }

  function getSearchTrendsStore() {
    if (!searchTrends) searchTrends = loadSearchTrendsFromDisk();
    if (!searchTrends.queries) searchTrends.queries = {};
    return searchTrends;
  }

  function flushSearchTrends() {
    if (!searchDirty || !searchTrends) return;
    searchDirty = false;
    fs.mkdirSync(path.dirname(searchTrendsFile), { recursive: true });
    fs.writeFileSync(searchTrendsFile, JSON.stringify(searchTrends, null, 2));
  }

  function normalizeSearchQuery(raw) {
    const term = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_QUERY_LEN);
    return term.length >= 2 ? term : '';
  }

  function recordSearchQuery(raw) {
    const term = normalizeSearchQuery(raw);
    if (!term) return;
    const key = term.toLowerCase();
    const data = getSearchTrendsStore();
    if (!data.queries[key]) data.queries[key] = { q: term, n: 0 };
    data.queries[key].n += 1;
    data.queries[key].q = term;
    data.queries[key].last = new Date().toISOString();
    const keys = Object.keys(data.queries);
    if (keys.length > MAX_SEARCH_TERMS) {
      keys.sort((a, b) => (data.queries[a].n || 0) - (data.queries[b].n || 0));
      keys.slice(0, keys.length - MAX_SEARCH_TERMS).forEach((k) => delete data.queries[k]);
    }
    searchDirty = true;
    scheduleFlush();
  }

  function bootstrapSearchTrendsFromPaths() {
    const data = getStore();
    const out = getSearchTrendsStore();
    let changed = false;
    Object.values(data).forEach((bucket) => {
      Object.entries(bucket.paths || {}).forEach(([pagePath, count]) => {
        const match = String(pagePath).match(/[?&]q=([^&]+)/i);
        if (!match) return;
        let q = '';
        try {
          q = normalizeSearchQuery(decodeURIComponent(match[1].replace(/\+/g, ' ')));
        } catch {
          q = normalizeSearchQuery(match[1]);
        }
        if (!q) return;
        const key = q.toLowerCase();
        if (!out.queries[key]) {
          out.queries[key] = { q, n: 0, last: null };
          changed = true;
        }
        out.queries[key].n += Number(count) || 1;
      });
    });
    if (changed) {
      searchDirty = true;
      scheduleFlush();
    }
  }

  function getSearchTrending(limit = 15) {
    flushDaily();
    const data = getSearchTrendsStore();
    if (!Object.keys(data.queries).length) bootstrapSearchTrendsFromPaths();
    return Object.values(data.queries || {})
      .sort((a, b) => (b.n || 0) - (a.n || 0))
      .slice(0, Math.max(1, Math.min(30, Number(limit) || 15)))
      .map(({ q, n }) => ({ q, count: n }));
  }

  function scheduleFlush() {
    dirty = true;
    if (flushTimer) return;
    flushTimer = setTimeout(flushDaily, FLUSH_MS);
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
  }

  function pruneOldDays(data) {
    const keys = Object.keys(data).sort();
    if (keys.length <= RETAIN_DAYS) return;
    keys.slice(0, keys.length - RETAIN_DAYS).forEach((key) => delete data[key]);
  }

  function isBot(userAgent) {
    return BOT_UA.test(String(userAgent || ''));
  }

  function shouldTrackPage(pagePath) {
    const p = String(pagePath || '').split('?')[0];
    if (!p || p.startsWith('/api/') || p.startsWith('/uploads/')) return false;
    if (p.startsWith('/admin/')) return false;
    if (p.includes('/supplier-portal/half-cut-upload') || p.includes('/supplier-portal/truck-upload') || p.includes('/supplier-portal/truck-vehicle-upload') || p.includes('/supplier-portal/passenger-parts-upload')) return false;
    if (p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.png') || p.endsWith('.webp')) return false;
    return p.endsWith('.html') || p === '/' || p.endsWith('/') || !path.extname(p.replace(/\/$/, ''));
  }

  function ensureDayBucket(data, day) {
    if (!data[day]) {
      data[day] = {
        pageviews: 0,
        whatsappClicks: 0,
        uniqueIps: {},
        paths: {},
        countries: {},
        utmSources: {},
        utmCampaigns: {},
        updatedAt: new Date().toISOString(),
      };
    }
    if (!data[day].utmSources) data[day].utmSources = {};
    if (!data[day].utmCampaigns) data[day].utmCampaigns = {};
    return data[day];
  }

  function parseUtmFromPage(page) {
    const raw = String(page || '');
    const qIndex = raw.indexOf('?');
    if (qIndex < 0) return {};
    try {
      const params = new URLSearchParams(raw.slice(qIndex + 1));
      return {
        utmSource: String(params.get('utm_source') || '').trim().slice(0, 80),
        utmMedium: String(params.get('utm_medium') || '').trim().slice(0, 80),
        utmCampaign: String(params.get('utm_campaign') || '').trim().slice(0, 120),
      };
    } catch {
      return {};
    }
  }

  function recordUtm(bucket, page) {
    const { utmSource, utmMedium, utmCampaign } = parseUtmFromPage(page);
    if (utmSource) bumpMapCounter(bucket.utmSources, utmSource);
    if (utmCampaign) bumpMapCounter(bucket.utmCampaigns, utmCampaign);
    if (utmMedium && !bucket.utmMediums) bucket.utmMediums = {};
    if (utmMedium) bumpMapCounter(bucket.utmMediums || (bucket.utmMediums = {}), utmMedium);
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
      const data = getStore();
      const bucket = data[day];
      const entry = bucket?.uniqueIps?.[ip];
      if (!entry) return;
      entry.country = geo.country;
      entry.city = geo.city || null;
      entry.region = geo.region || null;
      bumpMapCounter(bucket.countries, geo.country);
      bucket.updatedAt = new Date().toISOString();
      scheduleFlush();
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
    const data = getStore();
    const bucket = ensureDayBucket(data, day);
    const now = new Date().toISOString();

    bucket.pageviews += 1;
    bumpMapCounter(bucket.paths, page || '/');
    recordUtm(bucket, page);

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

    pruneOldDays(data);
    scheduleFlush();

    if (ip !== 'unknown' && !entry.country) {
      enrichIpGeo(day, ip).catch(() => {});
    }
  }

  function recordEvent(req, eventType, meta = {}) {
    if (eventType === 'search_query') {
      recordSearchQuery(meta.q || meta.query);
      return;
    }
    if (eventType !== 'whatsapp_click') return;
    const day = dayKey(new Date(), timeZone);
    const data = getStore();
    const bucket = ensureDayBucket(data, day);
    bucket.whatsappClicks += 1;
    if (meta.page) bumpMapCounter(bucket.paths, String(meta.page).slice(0, MAX_PATH_LENGTH));
    bucket.updatedAt = new Date().toISOString();
    pruneOldDays(data);
    scheduleFlush();

    if (req) recordPageView(req, meta.page || '/');
  }

  function filterBucketForExternal(bucket) {
    if (!bucket) return bucket;
    const uniqueIps = {};
    let internalHits = 0;
    Object.entries(bucket.uniqueIps || {}).forEach(([ip, info]) => {
      const hits = info.hits || 0;
      if (isInternalTestIp(ip, hits)) {
        internalHits += hits;
        return;
      }
      uniqueIps[ip] = info;
    });
    const countries = {};
    Object.values(uniqueIps).forEach((info) => {
      if (info.country) bumpMapCounter(countries, info.country);
    });
    const pageviews = Math.max(0, (bucket.pageviews || 0) - internalHits);
    return {
      ...bucket,
      pageviews,
      uniqueIps,
      countries,
      _internalHitsExcluded: internalHits,
    };
  }

  function summarizeDay(day, bucket, options = {}) {
    const view = options.view || 'all';
    const source = view === 'external' ? filterBucketForExternal(bucket) : bucket;
    if (!source) {
      return {
        day,
        pageviews: 0,
        uniqueIpCount: 0,
        whatsappClicks: 0,
        topPaths: [],
        topCountries: [],
        topUtmSources: [],
        topUtmCampaigns: [],
        ips: [],
        view,
      };
    }

    const ips = Object.entries(source.uniqueIps || {})
      .map(([ip, info]) => ({
        ip,
        hits: info.hits || 0,
        country: info.country || null,
        city: info.city || null,
        region: info.region || null,
        lastPath: info.lastPath || null,
        firstSeen: info.firstSeen || null,
        lastSeen: info.lastSeen || null,
        internal: isInternalTestIp(ip, info.hits || 0),
      }))
      .sort((a, b) => b.hits - a.hits);

    return {
      day,
      pageviews: source.pageviews || 0,
      uniqueIpCount: ips.length,
      whatsappClicks: source.whatsappClicks || 0,
      topPaths: topEntries(source.paths, 10),
      topCountries: topEntries(source.countries, 10),
      topUtmSources: topEntries(source.utmSources, 8),
      topUtmCampaigns: topEntries(source.utmCampaigns, 8),
      ips,
      updatedAt: source.updatedAt || null,
      view,
      internalHitsExcluded: source._internalHitsExcluded || 0,
    };
  }

  function getSummary({ days = 7, day = null, view = 'all' } = {}) {
    flushDaily();
    const data = getStore();
    const viewMode = view === 'external' ? 'external' : 'all';
    if (day) return summarizeDay(day, data[day], { view: viewMode });

    const keys = Object.keys(data).sort().reverse().slice(0, Math.max(1, Number(days) || 7));
    const daySummaries = keys.map((key) => summarizeDay(key, data[key], { view: viewMode }));
    const totals = daySummaries.reduce((acc, d) => {
      acc.pageviews += d.pageviews || 0;
      acc.uniqueIpCount += d.uniqueIpCount || 0;
      acc.whatsappClicks += d.whatsappClicks || 0;
      acc.internalHitsExcluded += d.internalHitsExcluded || 0;
      return acc;
    }, { pageviews: 0, uniqueIpCount: 0, whatsappClicks: 0, internalHitsExcluded: 0 });

    return {
      timeZone,
      view: viewMode,
      totals,
      days: daySummaries,
    };
  }

  function buildDailyReportText(day = dayKey(new Date(), timeZone)) {
    flushDaily();
    const summary = summarizeDay(day, getStore()[day]);
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

  process.on('exit', flushDaily);

  return {
    dailyFile,
    searchTrendsFile,
    dayKey: (date) => dayKey(date, timeZone),
    recordPageView,
    recordEvent,
    recordSearchQuery,
    getSearchTrending,
    getSummary,
    buildDailyReportText,
    shouldTrackPage,
    flushDaily,
  };
}

module.exports = {
  createSiteAnalytics,
  dayKey,
};
