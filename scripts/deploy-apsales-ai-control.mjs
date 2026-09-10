#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generateReleaseId, runPreDeployValidation, snapshotRemotePaths, runPostDeployValidation, buildReleaseRecord, writeReleaseJson } from './lib/release-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = 'apsales-ai-control';
const remote = 'root@159.65.86.24';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'deploy/apsales-ai-control-manifest.json')));
function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...options });
  if (r.status !== 0) throw Error(`${cmd} failed: ${r.stderr || r.stdout || r.error}`);
  return r.stdout;
}
const short = run('git', ['rev-parse', '--short', 'HEAD']).trim();
const releaseId = generateReleaseId(target, short);
const timestamp = new Date().toISOString();
const localDir = path.join(root, 'releases', releaseId);
const stage = `/root/.openclaw/workspace/inventory-site/releases/${releaseId}/payload`;
const pre = runPreDeployValidation({ root, target, remote, allowDirty: false, yes: process.argv.includes('--yes'), releaseId });
console.log(JSON.stringify({ releaseId, pre }, null, 2));
if (pre.status !== 'pass') process.exit(1);
fs.mkdirSync(localDir, { recursive: true });
if (!snapshotRemotePaths({ remote, releaseId, paths: manifest.files.map(f => f.remote) })) throw Error('Snapshot failed');
const bundle = path.join(localDir, 'payload');
const sources = [...new Set([...manifest.files.map(f => f.source), 'deploy/apsales-ai-control-manifest.json', 'scripts/apsales-ai-release-remote.py'])];
for (const source of sources) {
  const dest = path.join(bundle, source); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(root, source), dest);
}
run('rsync', ['-a', bundle + '/', `${remote}:${stage}/`]);
function phase(name) {
  return run('ssh', ['-o', 'BatchMode=yes', remote, 'python3', `${stage}/scripts/apsales-ai-release-remote.py`, name, stage, releaseId]);
}
let post = { status: 'fail', checks: [] };
try {
  console.log(phase('prepare'));
  console.log(phase('activate'));
  post = await runPostDeployValidation({ root, target, remote, baseUrl: 'https://asia-power.com', releaseId });
  const services = run('ssh', ['-o', 'BatchMode=yes', remote, 'systemctl', 'is-active', ...manifest.services]).trim();
  post.checks.push({ name: 'whatsapp_and_command_center', status: services.split(/\s+/).every(s => s === 'active') ? 'pass' : 'fail', detail: services });
  if (post.checks.some(c => c.status === 'fail')) post.status = 'fail';
} catch (error) {
  post.checks.push({ name: 'activation', status: 'fail', detail: error.message });
}
if (post.status !== 'pass') {
  try { console.log(phase('rollback')); }
  catch (error) { post.checks.push({ name: 'rollback', status: 'fail', detail: error.message }); }
}
const release = buildReleaseRecord({ releaseId, git: pre.git, target, remote, timestamp, changedFiles: sources, pre, post, backupPath: pre.backup_path, backupMode: pre.backup_mode, localReleaseJson: path.join(localDir, 'release.json') });
release.approval = 'CEO explicitly approved deployment in current task: 是';
release.remote_file_manifest = manifest.files;
release.recovery.restore_command = `ssh ${remote} python3 ${stage}/scripts/apsales-ai-release-remote.py rollback ${stage} ${releaseId}`;
release.recovery.note = 'Rollback preserves pause/data and leaves the old bridge stopped until a guard-compatible version is restored.';
writeReleaseJson({ remote, release, localDir });
console.log(JSON.stringify({ releaseId, status: post.status, backup: pre.backup_path, rollback: release.recovery.restore_command }));
if (post.status !== 'pass') process.exitCode = 1;
