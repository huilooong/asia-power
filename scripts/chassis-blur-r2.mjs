#!/usr/bin/env node
/**
 * R2 helper for chassis blur batch job.
 * Usage:
 *   node scripts/chassis-blur-r2.mjs get uploads/photos/foo.webp /tmp/foo.webp
 *   node scripts/chassis-blur-r2.mjs put /tmp/foo.webp uploads/photos/foo.webp image/webp
 *   node scripts/chassis-blur-r2.mjs backup uploads/photos/foo.webp backups/chassis-originals/foo.webp
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile('/root/.openclaw/workspace/inventory-site/.env');

const { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand } = await import('@aws-sdk/client-s3');

function bucket() {
  return String(process.env.CLOUDFLARE_R2_BUCKET || 'asia-power-media').trim();
}

function client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function keyFromArg(arg) {
  return String(arg || '').replace(/^\//, '');
}

async function readBody(res) {
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function getObject(key, outPath) {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: keyFromArg(key) }));
  const body = await readBody(res);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body);
  return body.length;
}

async function putObject(localPath, key, contentType) {
  const body = fs.readFileSync(localPath);
  await client().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: keyFromArg(key),
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: 'public, max-age=604800',
  }));
  return body.length;
}

async function backupObject(fromKey, toKey) {
  await client().send(new CopyObjectCommand({
    Bucket: bucket(),
    CopySource: `${bucket()}/${keyFromArg(fromKey)}`,
    Key: keyFromArg(toKey),
  }));
}

const [,, cmd, a, b, c] = process.argv;

try {
  if (cmd === 'get') {
    const bytes = await getObject(a, b);
    console.log(JSON.stringify({ ok: true, bytes, key: keyFromArg(a), out: b }));
  } else if (cmd === 'put') {
    const bytes = await putObject(a, b, c);
    console.log(JSON.stringify({ ok: true, bytes, key: keyFromArg(b) }));
  } else if (cmd === 'backup') {
    await backupObject(a, b);
    console.log(JSON.stringify({ ok: true, from: keyFromArg(a), to: keyFromArg(b) }));
  } else {
    console.error('Usage: get <key> <out> | put <file> <key> [mime] | backup <from> <to>');
    process.exit(2);
  }
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
}
