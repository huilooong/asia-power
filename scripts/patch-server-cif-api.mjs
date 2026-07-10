#!/usr/bin/env node
import fs from 'fs';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node patch-server-cif-api.mjs <server.js path>');
  process.exit(1);
}

let text = fs.readFileSync(target, 'utf8');

if (!text.includes('cif-shipping.js')) {
  const needle = "const { resolveClientGeo } = require(ipGeoPath || path.join(__dirname, '..', 'server', 'lib', 'ip-geo.js'));";
  const insert = `${needle}
const cifShippingPath = [
  path.join(__dirname, 'lib', 'cif-shipping.js'),
  path.join(__dirname, '..', 'server', 'lib', 'cif-shipping.js'),
].find((candidate) => fs.existsSync(candidate));
const cifShipping = require(cifShippingPath || path.join(__dirname, '..', 'server', 'lib', 'cif-shipping.js'));`;
  if (!text.includes(needle)) throw new Error('ip-geo require line not found');
  text = text.replace(needle, insert);
}

if (!text.includes('/api/shipping/ports')) {
  const needle = "      if (req.method === 'POST' && p === '/api/register') {";
  const block = `      if (req.method === 'GET' && p === '/api/shipping/ports') {
        const url = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);
        const cargo = url.searchParams.get('cargo') || 'halfcut';
        return json(res, 200, { ok: true, ports: cifShipping.listPorts(cargo) });
      }

      if (req.method === 'GET' && p === '/api/shipping/geo-hint') {
        const geo = await resolveClientGeo(req);
        return json(res, 200, { ok: true, ...cifShipping.geoHintFromClient(geo) });
      }

      if (req.method === 'GET' && p === '/api/shipping/cif-estimate') {
        const url = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);
        try {
          const estimate = cifShipping.estimateCif({
            portId: url.searchParams.get('portId'),
            cargo: url.searchParams.get('cargo'),
            exwUsd: url.searchParams.get('exwUsd'),
          });
          return json(res, 200, { ok: true, ...estimate });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Estimate failed' });
        }
      }

${needle}`;
  if (!text.includes(needle)) throw new Error('register route anchor not found');
  text = text.replace(needle, block);
}

fs.writeFileSync(target, text);
console.log(`patched ${target}`);
