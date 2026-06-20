'use strict';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function assertProductionEnv() {
  if (!isProduction()) return;

  const required = ['ADMIN_PASSWORD', 'SUPPLIER_UPLOAD_KEY', 'MEDIA_ACCESS_SECRET'];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  isProduction,
  assertProductionEnv,
};
