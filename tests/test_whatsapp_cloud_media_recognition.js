'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  recognizeInboundMedia,
  applyRecognitionToNormalized,
} = require('../server/lib/whatsapp-cloud-media-recognition.js');

function baseNormalized(overrides = {}) {
  return {
    wa_id: '8613800138000',
    message_id: 'wamid.TEST',
    message_type: 'text',
    text: '',
    media: null,
    ...overrides,
  };
}

test('image OCR VIN merges correctly', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'media-rec-'));
  const mediaDir = path.join(workspace, 'media');
  const recognized = await recognizeInboundMedia(
    baseNormalized({
      message_type: 'image',
      text: 'please check',
      media: { id: 'media-img-1' },
    }),
    {
      workspace,
      mediaDir,
      mediaVinEnabled: true,
      downloadWhatsAppMedia: async () => ({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
        filename: 'plate.jpg',
      }),
      runPython: async () => ({
        status: 'success',
        best_vin: 'JTDBT923X01234567',
        vin_candidates: [{ vin: 'JTDBT923X01234567', valid_format: true }],
      }),
      retainOrDiscardPhoto: async () => ({ kept: true }),
    },
  );

  assert.equal(recognized.kind, 'image');
  assert.equal(recognized.vin, 'JTDBT923X01234567');
  assert.equal(recognized.error, null);

  const normalized = baseNormalized({ text: 'please check' });
  applyRecognitionToNormalized(normalized, recognized);
  assert.match(normalized.text, /VIN: JTDBT923X01234567/);
  assert.match(normalized.text, /please check/);
});

test('voice STT transcript returned', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'media-rec-'));
  const recognized = await recognizeInboundMedia(
    baseNormalized({
      message_type: 'audio',
      media: { id: 'media-aud-1', voice: true },
    }),
    {
      workspace,
      mediaDir: path.join(workspace, 'media'),
      voiceSttEnabled: true,
      downloadWhatsAppMedia: async () => ({
        buffer: Buffer.from('ogg'),
        mimeType: 'audio/ogg',
        filename: 'voice.ogg',
      }),
      runPython: async () => ({
        status: 'success',
        text: 'I need a 2AZ engine for Camry',
        confidence: 0.9,
      }),
    },
  );

  assert.equal(recognized.kind, 'voice');
  assert.equal(recognized.transcript, 'I need a 2AZ engine for Camry');
  assert.ok(!recognized.error);

  const normalized = baseNormalized({ text: '' });
  applyRecognitionToNormalized(normalized, recognized);
  assert.equal(normalized.text, 'I need a 2AZ engine for Camry');
});

test('audio without voice=true does not trigger STT', async () => {
  let downloaded = false;
  let pythonCalled = false;
  const recognized = await recognizeInboundMedia(
    baseNormalized({
      message_type: 'audio',
      media: { id: 'media-aud-2', voice: false },
    }),
    {
      workspace: fs.mkdtempSync(path.join(os.tmpdir(), 'media-rec-')),
      voiceSttEnabled: true,
      downloadWhatsAppMedia: async () => {
        downloaded = true;
        return { buffer: Buffer.from('x'), mimeType: 'audio/mpeg', filename: 'a.mp3' };
      },
      runPython: async () => {
        pythonCalled = true;
        return { status: 'success', text: 'nope' };
      },
    },
  );

  assert.equal(recognized.skipped, true);
  assert.equal(recognized.reason, 'audio_not_voice');
  assert.equal(downloaded, false);
  assert.equal(pythonCalled, false);
});

test('script failure returns {error} and does not throw', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'media-rec-'));
  const recognized = await recognizeInboundMedia(
    baseNormalized({
      message_type: 'image',
      media: { id: 'media-img-fail' },
    }),
    {
      workspace,
      mediaDir: path.join(workspace, 'media'),
      mediaVinEnabled: true,
      downloadWhatsAppMedia: async () => ({
        buffer: Buffer.from('img'),
        mimeType: 'image/jpeg',
        filename: 'bad.jpg',
      }),
      runPython: async () => {
        throw new Error('python exploded');
      },
      retainOrDiscardPhoto: async ({ tmpPath }) => {
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        return { kept: false };
      },
    },
  );

  assert.equal(recognized.kind, 'image');
  assert.ok(recognized.error);
  assert.match(String(recognized.error), /python exploded/);
});

test('download failure returns {error} without throw', async () => {
  await assert.doesNotReject(async () => {
    const recognized = await recognizeInboundMedia(
      baseNormalized({
        message_type: 'image',
        media: { id: 'media-img-dl' },
      }),
      {
        workspace: fs.mkdtempSync(path.join(os.tmpdir(), 'media-rec-')),
        mediaVinEnabled: true,
        downloadWhatsAppMedia: async () => {
          throw new Error('graph_down');
        },
      },
    );
    assert.equal(recognized.kind, 'image');
    assert.match(recognized.error, /graph_down/);
  });
});
