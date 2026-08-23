'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createInventoryAuditLog(dataDir) {
  const file = path.join(dataDir, 'inventory-audit-log.jsonl');

  function append(event) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const record = {
      id: `AUD-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      at: new Date().toISOString(),
      ...event,
    };
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch {}
    return record;
  }

  function listForStock(stockId, limit = 40) {
    if (!fs.existsSync(file)) return [];
    const target = String(stockId || '').trim().toUpperCase();
    if (!target) return [];
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const matches = [];
    for (let index = lines.length - 1; index >= 0 && matches.length < limit; index -= 1) {
      try {
        const event = JSON.parse(lines[index]);
        if (String(event.stockId || '').toUpperCase() === target) matches.push(event);
      } catch {
        // A damaged historical line must not block later audit records.
      }
    }
    return matches;
  }

  return { file, append, listForStock };
}

module.exports = { createInventoryAuditLog };
