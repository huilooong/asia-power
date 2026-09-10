"""Narrow staged installer called by the OPS-005 release runner; no customer sends."""
import ast
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

phase, stage_arg, release_id = sys.argv[1:]
stage = Path(stage_arg)
release = Path('/root/.openclaw/workspace/inventory-site/releases') / release_id
manifest = json.loads((stage / 'deploy/apsales-ai-control-manifest.json').read_text())
records = manifest['files']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout

def backup_path(remote):
    return release / 'snapshots' / remote.lstrip('/').replace('/', '_')

def restore():
    # Never restart an older bridge that cannot respect existing manual pauses.
    run(['systemctl', 'stop', 'apsales-whatsapp-bridge.service'])
    for record in records:
        saved = backup_path(record['remote'])
        if saved.is_file():
            shutil.copy2(saved, record['remote'])
    run(['systemctl', 'restart', 'asia-power-telegram-bot.service'])
    print(json.dumps({'rollback': 'restored_original_files_bridge_stays_stopped', 'pause_data_preserved': True}))

with open('/var/lock/apsales-ai-control-release.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    if phase == 'rollback':
        restore()
    elif phase == 'prepare':
        prepared = []
        for i, record in enumerate(records):
            remote = Path(record['remote'])
            actual = digest(remote)
            if actual != record['expected_sha256']:
                raise RuntimeError(f'Production drift: {remote}')
            if actual is not None and digest(backup_path(record['remote'])) != actual:
                raise RuntimeError(f'Backup verification failed: {remote}')
            candidate = stage / 'prepared' / str(i) / remote.name
            candidate.parent.mkdir(parents=True, exist_ok=True)
            if record.get('patch'):
                shutil.copy2(remote, candidate)
                run(['patch', '--batch', '-p1', '-d', str(candidate.parent), '-i', str(stage / record['source'])])
            else:
                shutil.copy2(stage / record['source'], candidate)
            if remote.suffix == '.py':
                ast.parse(candidate.read_text())
            if remote.suffix == '.mjs':
                run(['node', '--check', str(candidate)])
            prepared.append({**record, 'candidate': str(candidate), 'candidate_sha256': digest(candidate)})
        (stage / 'prepared.json').write_text(json.dumps(prepared, indent=2))
        print(json.dumps({'prepared': len(prepared), 'baseline_and_backups_verified': True}))
    elif phase == 'activate':
        prepared = json.loads((stage / 'prepared.json').read_text())
        for record in prepared:
            if digest(Path(record['remote'])) != record['expected_sha256']:
                raise RuntimeError(f'Production drift before activation: {record["remote"]}')
            if digest(Path(record['candidate'])) != record['candidate_sha256']:
                raise RuntimeError('Staged payload changed')
        run(['systemctl', 'stop', *manifest['services']])
        try:
            for record in prepared:
                target = Path(record['remote'])
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_name(target.name + '.' + release_id)
                shutil.copy2(record['candidate'], temporary)
                temporary.chmod(target.stat().st_mode & 0o777 if target.exists() else 0o644)
                os.replace(temporary, target)
            for record in prepared:
                if digest(Path(record['remote'])) != record['candidate_sha256']:
                    raise RuntimeError('Installed file hash mismatch')
            run(['node', '--input-type=module', '-e', 'await import("/root/.openclaw/extensions/apsales-live-draft/apsales-whatsapp-session.mjs");'])
            run(['systemctl', 'start', *manifest['services']])
        except Exception:
            restore()
            raise
        print(json.dumps({'installed': len(prepared), 'hashes_match': True, 'services_started': manifest['services']}))
    else:
        raise ValueError('Unknown phase')
