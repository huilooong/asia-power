'use strict';

/**
 * POST /api/vin/decode — supplier-facing VIN auto-fill backed by QXB + approved facts.
 */

const { createRateLimiter } = require('../rate-limit');
const { decodeVin } = require('./qxb-client');
const { applyMapping } = require('./mapping-layer');
const { localizeForDisplay, seedKnowledgeBase, pickPublicName } = require('./localize');
const { createVehicleKnowledgeBase } = require('./knowledge-base');

const BRAND_SLUG_MAP = {
  Toyota: 'toyota', Lexus: 'lexus', Honda: 'honda', Acura: 'acura', Nissan: 'nissan',
  Infiniti: 'infiniti', Mazda: 'mazda', Mitsubishi: 'mitsubishi', Subaru: 'subaru',
  Suzuki: 'suzuki', Daihatsu: 'daihatsu', Hyundai: 'hyundai', Kia: 'kia', Genesis: 'genesis',
  BYD: 'byd', Geely: 'geely', Zeekr: 'zeekr', 'Lynk & Co': 'lynk-co', Geometry: 'geometry',
  Chery: 'chery', Exeed: 'exeed', Jetour: 'jetour', Omoda: 'omoda', Jaecoo: 'jaecoo',
  'Great Wall': 'great-wall', Haval: 'haval', Tank: 'tank', Ora: 'ora', MG: 'mg',
  Roewe: 'roewe', GAC: 'gac', Changan: 'changan', JAC: 'jac', Dongfeng: 'dongfeng',
  FAW: 'faw', Foton: 'foton', JMC: 'jmc', Maxus: 'maxus', Ford: 'ford', Lincoln: 'lincoln',
  Chevrolet: 'chevrolet', GMC: 'gmc', Buick: 'buick', Cadillac: 'cadillac',
  Volkswagen: 'volkswagen', Audi: 'audi', Skoda: 'skoda', Seat: 'seat',
  'Mercedes-Benz': 'mercedes-benz', BMW: 'bmw', MINI: 'mini', Porsche: 'porsche',
  Ssangyong: 'ssangyong', Isuzu: 'isuzu', Hawtai: 'hawtai', Wuling: 'wuling', Volvo: 'volvo',
  'Citroën': 'citroen', Peugeot: 'peugeot', Dodge: 'dodge', Jeep: 'jeep', 'Changan Kuayue': 'changan-kuayue',
  'Land Rover': 'land-rover', Jaguar: 'jaguar', Chrysler: 'chrysler', Liebao: 'liebao',
  Baojun: 'baojun', 'Dongfeng Fengguang': 'dongfeng-fengguang',
};

function createVinDecodeHandler(rootDir) {
  const path = require('path');
  const kb = createVehicleKnowledgeBase(path.join(rootDir, 'data'));
  seedKnowledgeBase(kb);
  const limitDecode = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 60 });

  return async function handleVinDecode(req, res, json) {
    if (!limitDecode(req)) {
      json(res, 200, { ok: false, reason: 'rate_limited' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      json(res, 200, { ok: false, reason: 'invalid_request' });
      return;
    }

    const vin = String(body?.vin || '').trim().toUpperCase();
    if (vin.length !== 17) {
      json(res, 200, { ok: false, reason: 'invalid_vin' });
      return;
    }

    const approvedFact = kb.getApprovedVinFact(vin);
    if (approvedFact) {
      json(res, 200, {
        ok: true,
        vin,
        source: 'approved_vin_facts',
        brand: approvedFact.brand || '',
        brandSlug: approvedFact.brandSlug || '',
        model: approvedFact.model || '',
        year: approvedFact.year || '',
        engineCode: approvedFact.engineCode || '',
        transmissionCode: approvedFact.transmissionCode || '',
        gearboxModel: approvedFact.gearboxModel || '',
        displacement: approvedFact.displacement || '',
        fuelType: approvedFact.fuelType || '',
        drivetrain: approvedFact.drivetrain || '',
      });
      return;
    }

    let rawResponse;
    const cached = kb.getCachedVin(vin);
    if (cached) {
      rawResponse = cached.rawResponse;
    } else {
      try {
        const result = await decodeVin(vin);
        if (result.invalid_vin) {
          json(res, 200, { ok: false, reason: 'invalid_vin' });
          return;
        }
        rawResponse = result.response.json;
        kb.cacheVinResult(vin, rawResponse, { source: 'qxb-supplier-upload', requestedAt: result.request.sentAt });
      } catch (err) {
        json(res, 200, { ok: false, reason: 'qxb_unavailable', message: err.message });
        return;
      }
    }

    if (!rawResponse || rawResponse.number !== 200) {
      const qxbMsg = rawResponse?.message || '';
      const qxbNum = rawResponse?.number;
      if (qxbNum === 9005 || /限额/.test(qxbMsg)) {
        json(res, 200, { ok: false, reason: 'qxb_unavailable', message: qxbMsg || 'QXB API quota exceeded' });
        return;
      }
      json(res, 200, { ok: false, reason: 'not_found', message: qxbMsg || undefined });
      return;
    }

    const { mapped } = applyMapping(rawResponse);
    if (!mapped) {
      json(res, 200, { ok: false, reason: 'not_found' });
      return;
    }
    const display = localizeForDisplay(mapped, kb, { brandSlugMap: BRAND_SLUG_MAP, vin, autoLearn: true });

    // Prefer English; never blank a field QXB successfully returned (CEO 2026-07-10).
    const brand = pickPublicName(display.brandEnglish, mapped.brand);
    const model = pickPublicName(display.seriesEnglish, mapped.series);

    json(res, 200, {
      ok: true,
      vin,
      source: 'qxb',
      brand,
      brandSlug: display.brandSlug || BRAND_SLUG_MAP[brand] || '',
      model,
      year: mapped.year ? Number(mapped.year) : '',
      engineCode: mapped.engineCode || '',
      transmissionCode: mapped.transmissionCode || '',
      gearboxModel: mapped.gearboxModel || '',
      displacement: display.displacement || '',
      fuelType: pickPublicName(display.fuelType, mapped.fuelTypeRaw),
      drivetrain: pickPublicName(display.drivetrain, mapped.drivetrainRaw),
      qxbBrand: mapped.brand || '',
      qxbSeries: mapped.series || '',
      autoLearned: Boolean(display.needsTranslation?.length),
    });
  };
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = { createVinDecodeHandler, BRAND_SLUG_MAP };
