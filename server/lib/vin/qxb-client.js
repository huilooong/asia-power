'use strict';

/**
 * QXB (汽修宝数据开放平台) VinDecoder API client.
 *
 * Endpoint: http://open-api2.0.nanxinwang.com
 * Docs:     http://open.qxbapp.com/interface
 * Auth:     QXB_APPID / QXB_SECRET (read from env — never hardcoded)
 *
 * Confirmed signing spec (from vendor docs, 2026-06-27):
 *   1. Collect: public params (appid, version, timestamp) + secret + interface params.
 *   2. Drop any param whose value is '' (empty string) and drop 'callback'.
 *   3. Sort remaining params by param name, ASCII ascending.
 *   4. urlencode each value, join as "k1=v1&k2=v2&...".
 *   5. sign = uppercase(md5(that string)).
 *   6. Send: public params + sign + interface params — secret itself is
 *      NEVER sent in the request, only used to compute sign.
 *
 * CONFIRMED WORKING (2026-06-27, real VIN LGBN22E28AY002810 → number:200):
 *   path: /VinDecoder/decode (乘用车精准解码版 — the interface this AsiaPower
 *   account is actually authorized for), version: "4.6.0", POST,
 *   application/x-www-form-urlencoded, single interface param `vin`.
 *
 * /VinDecoder/decodeNormal (乘用车常规解码版, v3.6.0) was also tried with
 * the same signing scheme — signature accepted (no longer -5 format error)
 * but rejected with number:-6 "您请求的接口未授权" (this account isn't
 * authorized for that interface). Do not use decodeNormal unless that
 * authorization changes.
 *
 * Also learned: passing version "1.0.0" against /VinDecoder/decode gives
 * number:-11 "接口版本错误" — version must match the specific interface's
 * documented version, it's not a fixed platform-wide default.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_ENDPOINT = 'http://open-api2.0.nanxinwang.com';
const DEFAULT_PATH = '/VinDecoder/decode';
const DEFAULT_VERSION = '4.6.0';

function readCredentials() {
  const appId = process.env.QXB_APPID;
  const secret = process.env.QXB_SECRET;
  if (!appId || !secret) {
    throw new Error(
      'QXB credentials missing. Set QXB_APPID and QXB_SECRET in .env before calling the VIN API.'
    );
  }
  return { appId, secret };
}

/**
 * Builds the signed request body per the confirmed QXB signing spec.
 * Returns { params, signString, sign } — `params` is what actually gets sent
 * (secret is excluded), `signString` is kept for traceability/debugging.
 */
function buildSignedParams(appId, secret, interfaceParams = {}, { version = DEFAULT_VERSION, timestamp } = {}) {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const all = { appid: appId, version, timestamp: ts, secret, ...interfaceParams };

  const toSign = Object.entries(all).filter(([key, value]) => {
    if (key === 'callback') return false;
    if (value === '' || value === undefined || value === null) return false;
    return true;
  });
  toSign.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const signString = toSign.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  const sign = crypto.createHash('md5').update(signString, 'utf8').digest('hex').toUpperCase();

  const params = { appid: appId, version, timestamp: ts, sign, ...interfaceParams };
  return { params, signString, sign };
}

function httpRequestForm(urlStr, { method = 'POST', headers = {}, formFields = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = Object.entries(formFields)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, rawBody: raw });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Decode a single VIN via QXB.
 *
 * Returns { request, response } with the FULL outgoing request (including
 * the sign string used, for auditability — secret itself is redacted) and
 * the FULL raw response, untrimmed, so the Mapping Layer can be built from
 * real, complete field names rather than assumptions.
 */
async function decodeVin(vin, { endpoint = DEFAULT_ENDPOINT, path = DEFAULT_PATH, version = DEFAULT_VERSION } = {}) {
  if (!vin || String(vin).trim().length !== 17) {
    return { invalid_vin: true, vin, reason: 'VIN must be exactly 17 characters' };
  }

  const { appId, secret } = readCredentials();
  const { params, signString, sign } = buildSignedParams(appId, secret, { vin }, { version });

  const url = new URL(path, endpoint);
  const requestDescriptor = {
    url: url.toString(),
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    formFields: params,
    signStringRedacted: signString.replace(secret, '***SECRET***'),
    sign,
    sentAt: new Date().toISOString(),
  };

  const res = await httpRequestForm(requestDescriptor.url, {
    method: 'POST',
    formFields: params,
  });

  let parsedBody;
  try {
    parsedBody = JSON.parse(res.rawBody);
  } catch {
    parsedBody = null;
  }

  return {
    request: requestDescriptor,
    response: {
      statusCode: res.statusCode,
      headers: res.headers,
      rawBody: res.rawBody,
      json: parsedBody,
      receivedAt: new Date().toISOString(),
    },
  };
}

module.exports = { decodeVin, readCredentials, buildSignedParams };
