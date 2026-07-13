/**
 * AsiaPower — Engine card identity + structured applications
 * APUI-VEHICLE-ENGINE-001
 *
 * Card line: Engine Code · {Displacement} {Fuel}
 * Displacement backfill is directory-derived only when exact code match
 * has no multi-version conflict. Never mutates inventory records.
 *
 * Compatible Vehicles: only stably parsed, normalized, deduped model names.
 */
(function () {
  'use strict';

  var AMBIGUOUS_TOKEN_RE =
    /\b(applications?|turbo|series|platform|related|export|commercial|petrol|diesel|hybrid|non-hybrid|small car)\b/i;
  var YEAR_IN_TOKEN_RE = /\b(19|20)\d{2}\b/;
  var MARKET_HINT_RE = /\b(us|usa|eu|europe|japan|china|gulf|middle east|mea|gcc)\b/i;

  function normCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  function normCodeKey(value) {
    return normCode(value).replace(/[\s-]+/g, '');
  }

  function isBlankDisp(raw) {
    var s = String(raw || '').trim();
    return !s || s === '—' || s === '-' || /^n\/?a$/i.test(s) || /not verified/i.test(s);
  }

  function formatLiters(raw) {
    if (isBlankDisp(raw)) return '';
    var match = String(raw).match(/(\d+(?:\.\d+)?)/);
    if (!match) return '';
    var liters = Number(match[1]);
    if (!Number.isFinite(liters) || liters <= 0) return '';
    var text = liters % 1 === 0 ? liters.toFixed(1) : String(liters);
    return text + 'L';
  }

  function formatFuel(raw) {
    var s = String(raw || '').trim();
    if (!s || s === '—' || /not verified/i.test(s)) return '';
    var lower = s.toLowerCase();
    if (lower === 'petrol' || lower === 'gasoline') return 'Petrol';
    if (lower === 'diesel') return 'Diesel';
    if (lower === 'hybrid') return 'Hybrid';
    if (lower === 'electric' || lower === 'ev') return 'Electric';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function isDisplacementLikeCode(code) {
    return /^\d+(\.\d+)?L$/i.test(String(code || '').trim());
  }

  function listDirectoryHits(code) {
    var key = normCodeKey(code);
    if (!key) return [];
    var directory = window.ENGINE_DIRECTORY || {};
    var hits = [];
    Object.keys(directory).forEach(function (slug) {
      var entry = directory[slug];
      (entry && entry.models ? entry.models : []).forEach(function (m) {
        if (normCodeKey(m.code) === key) {
          hits.push({
            brandSlug: slug,
            brandName: entry.name || slug,
            model: m,
          });
        }
      });
    });
    return hits;
  }

  /**
   * Exact-code catalog lookup with conflict detection.
   * Conflict = same normalized code with differing displacement or fuel across directory rows.
   */
  function lookupCatalogModelExact(code, brandSlug) {
    var hits = listDirectoryHits(code);
    if (!hits.length) return { model: null, conflict: false, hits: [] };

    var disps = {};
    var fuels = {};
    hits.forEach(function (h) {
      var d = formatLiters(h.model.displacement) || String(h.model.displacement || '').trim().toLowerCase();
      var f = formatFuel(h.model.fuel || h.model.type) || String(h.model.fuel || '').trim().toLowerCase();
      if (d) disps[d] = true;
      if (f) fuels[f] = true;
    });
    var conflict = Object.keys(disps).length > 1 || Object.keys(fuels).length > 1;
    if (conflict) return { model: null, conflict: true, hits: hits };

    if (brandSlug) {
      var branded = hits.find(function (h) {
        return h.brandSlug === brandSlug;
      });
      if (branded) return { model: branded.model, conflict: false, hits: hits, brandName: branded.brandName };
    }
    return {
      model: hits[0].model,
      conflict: false,
      hits: hits,
      brandName: hits[0].brandName,
    };
  }

  function lookupCatalogModel(code, brandSlug) {
    return lookupCatalogModelExact(code, brandSlug).model;
  }

  /**
   * Traceable displacement/fuel resolution.
   * source: inventory | directory-derived | ''
   * Does not mutate input.
   */
  function resolveDisplacementFuelTraceable(input) {
    var src = input || {};
    var code = normCode(src.code || src.engineCode);
    if (isDisplacementLikeCode(code)) {
      code = '';
    }

    var inventoryDisp = formatLiters(src.displacement);
    var inventoryFuel = formatFuel(src.fuel || src.fuelType || src.type);

    var out = {
      code: code,
      displacement: inventoryDisp,
      fuel: inventoryFuel,
      displacementSource: inventoryDisp ? 'inventory' : '',
      fuelSource: inventoryFuel ? 'inventory' : '',
      directoryConflict: false,
      directoryMatched: false,
    };

    if (!code || (out.displacement && out.fuel)) return out;

    var looked = lookupCatalogModelExact(code, src.brandSlug || src.slug);
    out.directoryConflict = Boolean(looked.conflict);
    if (looked.conflict || !looked.model) return out;

    out.directoryMatched = true;
    if (!out.displacement) {
      var d = formatLiters(looked.model.displacement);
      if (d) {
        out.displacement = d;
        out.displacementSource = 'directory-derived';
      }
    }
    if (!out.fuel) {
      var f = formatFuel(looked.model.fuel || looked.model.type);
      if (f) {
        out.fuel = f;
        out.fuelSource = 'directory-derived';
      }
    }
    return out;
  }

  function resolveEngineCardParts(input) {
    var r = resolveDisplacementFuelTraceable(input);
    return { code: r.code, displacement: r.displacement, fuel: r.fuel };
  }

  function formatDisplacementFuel(input) {
    var parts = resolveEngineCardParts(input);
    return [parts.displacement, parts.fuel].filter(Boolean).join(' ');
  }

  function formatEngineCodeDisplacementFuel(input) {
    var parts = resolveEngineCardParts(input);
    if (!parts.code) return formatDisplacementFuel(input);
    var tail = [parts.displacement, parts.fuel].filter(Boolean).join(' ');
    return tail ? parts.code + ' · ' + tail : parts.code;
  }

  function normalizeVehicleToken(raw) {
    var s = String(raw || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return '';
    // Drop trailing fuel words left after split
    s = s.replace(/\s+(petrol|diesel|hybrid)$/i, '').trim();
    return s;
  }

  function isStructuredVehicleToken(token) {
    var s = normalizeVehicleToken(token);
    if (!s || s.length < 2 || s.length > 42) return false;
    if (AMBIGUOUS_TOKEN_RE.test(s) && !/^(Land Cruiser|Hilux|Prado)\b/i.test(s)) return false;
    if (YEAR_IN_TOKEN_RE.test(s)) return false;
    if (MARKET_HINT_RE.test(s)) return false;
    if (/^\d+(\.\d+)?L$/i.test(s)) return false;
    // Reject free-text fragments
    if (/\b(and|with|for|including)\b/i.test(s)) return false;
    // Allow letters, digits, spaces, hyphen, ampersand, slash (Land Cruiser 80/100 kept only if whole token structured)
    if (!/^[A-Za-z0-9][A-Za-z0-9 .&\-\/]*$/.test(s)) return false;
    // Slash series like "80/100" alone is ambiguous unless prefixed with model
    if (/^\d{2,3}\/\d{2,3}/.test(s)) return false;
    if (/\bseries\b/i.test(s)) return false;
    return true;
  }

  function dedupeKey(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  /**
   * Parse free-text applications into structured vehicle names only.
   * Returns { vehicles: string[], rejected: string[], raw: string }
   */
  function parseStructuredApplications(applicationsText, brandName) {
    var raw = String(applicationsText || '').trim();
    var rejected = [];
    var vehicles = [];
    var seen = {};
    if (!raw) return { vehicles: vehicles, rejected: rejected, raw: raw };

    var parts = raw.split(/[,;]/).map(function (p) {
      return p.trim();
    }).filter(Boolean);

    parts.forEach(function (part) {
      var cleaned = normalizeVehicleToken(part);
      if (!cleaned) return;
      if (!isStructuredVehicleToken(cleaned)) {
        rejected.push(part);
        return;
      }
      // Title-case lightly without destroying acronyms
      var display = cleaned.replace(/\b([a-z])/g, function (m) {
        return m.toUpperCase();
      });
      // Prefer "Brand Model" display when brand known and token lacks brand
      if (brandName && !new RegExp('^' + brandName + '\\b', 'i').test(display)) {
        // keep short model token for cards; detail may prefix brand
      }
      var key = dedupeKey(display);
      if (seen[key]) return;
      seen[key] = true;
      vehicles.push(display);
    });

    return { vehicles: vehicles, rejected: rejected, raw: raw };
  }

  function formatCompatibleVehiclesSummary(applicationsText, opts) {
    var options = opts || {};
    var limit = options.limit == null ? 3 : options.limit;
    var parsed = parseStructuredApplications(applicationsText, options.brandName);
    if (!parsed.vehicles.length) return '';
    if (parsed.vehicles.length <= limit) {
      return (options.prefix === false ? '' : 'Fits ') + parsed.vehicles.join(' · ');
    }
    var shown = parsed.vehicles.slice(0, Math.max(2, limit - 1));
    var rest = parsed.vehicles.length - shown.length;
    return (options.prefix === false ? '' : 'Fits ') + shown.join(' · ') + ' · +' + rest + ' Models';
  }

  function formatCompatibleVehiclesList(applicationsText, brandName) {
    var parsed = parseStructuredApplications(applicationsText, brandName);
    return parsed.vehicles.map(function (v) {
      if (brandName && !new RegExp('^' + brandName + '\\b', 'i').test(v)) {
        return brandName + ' ' + v;
      }
      return v;
    });
  }

  function formatEngineDetailH1(input) {
    var src = input || {};
    var brand = String(src.brand || src.brandName || '').trim();
    var parts = resolveEngineCardParts(src);
    var bits = [brand, parts.code, parts.displacement, parts.fuel, 'Engine'].filter(Boolean);
    return bits.join(' ');
  }

  function formatHalfCutVehicleTitle(input) {
    var src = input || {};
    var brand = String(src.brand || '').trim();
    var model = String(src.model || '').trim();
    return [brand, model].filter(Boolean).join(' ');
  }

  function formatHalfCutDetailH1(input) {
    var src = input || {};
    var vehicle = formatHalfCutVehicleTitle(src);
    var eng = formatEngineCodeDisplacementFuel(src).replace(/\s·\s/g, ' ');
    if (!vehicle) return eng ? eng + ' Half Cut' : 'Half Cut';
    if (!eng) return vehicle + ' Half Cut';
    return vehicle + ' Half Cut — ' + eng;
  }

  function formatHalfCutSeoTitle(input) {
    var src = input || {};
    var vehicle = formatHalfCutVehicleTitle(src);
    var parts = resolveEngineCardParts(src);
    var mid = [parts.code, parts.displacement].filter(Boolean).join(' ');
    var core = [vehicle, 'Half Cut', mid].filter(Boolean).join(' ');
    var status = String(src.status || '').trim();
    if (/^reserved$/i.test(status)) return core + ' — Reserved | AsiaPower';
    if (/^sold$/i.test(status)) return core + ' — Sold | AsiaPower';
    return core + ' | AsiaPower';
  }

  window.EngineCardLabel = {
    formatLiters: formatLiters,
    formatFuel: formatFuel,
    formatDisplacementFuel: formatDisplacementFuel,
    formatEngineCodeDisplacementFuel: formatEngineCodeDisplacementFuel,
    resolveEngineCardParts: resolveEngineCardParts,
    resolveDisplacementFuelTraceable: resolveDisplacementFuelTraceable,
    lookupCatalogModel: lookupCatalogModel,
    lookupCatalogModelExact: lookupCatalogModelExact,
    parseStructuredApplications: parseStructuredApplications,
    formatCompatibleVehiclesSummary: formatCompatibleVehiclesSummary,
    formatCompatibleVehiclesList: formatCompatibleVehiclesList,
    formatEngineDetailH1: formatEngineDetailH1,
    formatHalfCutVehicleTitle: formatHalfCutVehicleTitle,
    formatHalfCutDetailH1: formatHalfCutDetailH1,
    formatHalfCutSeoTitle: formatHalfCutSeoTitle,
    isStructuredVehicleToken: isStructuredVehicleToken,
  };
})();
