'use strict';

const fs = require('fs');
const path = require('path');

let S3Client;
let PutObjectCommand;
let CopyObjectCommand;
let GetObjectCommand;

function loadS3() {
  if (S3Client) return;
  ({ S3Client, PutObjectCommand, CopyObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'));
}

function env(name) {
  return String(process.env[name] || '').trim();
}

function bucket() {
  return env('CLOUDFLARE_R2_BUCKET') || 'asia-power-media';
}

function publicBase() {
  return (env('CLOUDFLARE_R2_PUBLIC_BASE') || 'https://media.asia-power.com').replace(/\/$/, '');
}

function isEnabled() {
  return !!(env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && env('CLOUDFLARE_ACCOUNT_ID'));
}

let client;
function s3() {
  loadS3();
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env('R2_ACCESS_KEY_ID'),
        secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      },
    });
  }
  return client;
}

function objectKeyFromUploadsPath(uploadsPath) {
  return String(uploadsPath || '').replace(/^\//, '');
}

function pendingPhotoKey(filename) {
  return `uploads/pending/photos/${filename}`;
}

function pendingVideoKey(filename) {
  return `uploads/pending/videos/${filename}`;
}

function publicPhotoKey(filename) {
  return `uploads/photos/${filename}`;
}

function publicVideoKey(filename) {
  return `uploads/videos/${filename}`;
}

function siteRelativeUrl(key) {
  const clean = String(key || '').replace(/^\//, '');
  return clean.startsWith('uploads/') ? `/${clean}` : `/uploads/${clean}`;
}

function publicUrlForKey(key) {
  return `${publicBase()}${siteRelativeUrl(key)}`;
}

function mimeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  };
  return map[ext] || 'application/octet-stream';
}

async function putObjectBuffer(key, contentType, body) {
  loadS3();
  await s3().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: 'public, max-age=604800',
  }));
}

async function putObjectFromFile(filePath, key) {
  const body = fs.readFileSync(filePath);
  await putObjectBuffer(key, mimeForFile(filePath), body);
}

async function copyObject(fromKey, toKey) {
  loadS3();
  await s3().send(new CopyObjectCommand({
    Bucket: bucket(),
    CopySource: `${bucket()}/${fromKey}`,
    Key: toKey,
  }));
}

async function getObjectBuffer(key) {
  loadS3();
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

function createPresignedPutUrl() {
  return null;
}

function uploadConfig() {
  // Presigned browser PUT is not wired yet (createPresignedPutUrl returns null).
  // Server multipart upload still stores pending media in R2 when configured.
  const directUpload = false;
  return {
    r2: isEnabled(),
    directUpload,
    bucket: bucket(),
    publicBase: publicBase(),
  };
}

module.exports = {
  isEnabled,
  putObjectBuffer,
  putObjectFromFile,
  getObjectBuffer,
  copyObject,
  pendingPhotoKey,
  pendingVideoKey,
  publicPhotoKey,
  publicVideoKey,
  siteRelativeUrl,
  objectKeyFromUploadsPath,
  publicUrlForKey,
  createPresignedPutUrl,
  uploadConfig,
};
