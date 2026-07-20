'use strict';

/**
 * Lightweight host metrics for Telegram hourly/daily reports.
 * Never throws out of collectSystemMetrics / formatMetricsSummary —
 * individual fields degrade to "unknown" on failure.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const DEFAULT_SERVICES = ['inventory-site.service', 'apsales-whatsapp-bridge.service'];

function safeExec(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: opts.timeout || 4000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function collectDisk() {
  try {
    // Prefer Node fs.statfs when available (Node 18.15+ / 19+)
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync('/');
      const total = Number(s.blocks) * Number(s.bsize);
      const free = Number(s.bavail) * Number(s.bsize);
      if (total > 0) {
        const usedPct = Math.round(((total - free) / total) * 100);
        return {
          usedPct,
          usedGb: Math.round((total - free) / 1e9),
          totalGb: Math.round(total / 1e9),
        };
      }
    }
  } catch {
    /* fall through */
  }
  const out = safeExec('df', ['-P', '-k', '/']);
  if (!out) return null;
  // df -P: Filesystem 1024-blocks Used Available Capacity Mounted
  const rows = out.split('\n').filter(Boolean);
  const data = rows[rows.length - 1];
  if (!data) return null;
  const parts = data.split(/\s+/);
  if (parts.length < 5) return null;
  const totalK = Number(parts[1]);
  const usedK = Number(parts[2]);
  if (!totalK) return null;
  return {
    usedPct: Math.round((usedK / totalK) * 100),
    usedGb: Math.round(usedK / 1e6),
    totalGb: Math.round(totalK / 1e6),
  };
}

function collectMemory() {
  try {
    // Linux: MemAvailable is the realistic free figure
    const raw = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalMatch = raw.match(/^MemTotal:\s+(\d+)/m);
    const availMatch = raw.match(/^MemAvailable:\s+(\d+)/m);
    if (totalMatch && availMatch) {
      const totalKb = Number(totalMatch[1]);
      const availKb = Number(availMatch[1]);
      const usedKb = totalKb - availKb;
      return {
        usedPct: Math.round((usedKb / totalKb) * 100),
        usedMb: Math.round(usedKb / 1024),
        totalMb: Math.round(totalKb / 1024),
      };
    }
  } catch {
    /* fall through */
  }
  try {
    const total = os.totalmem();
    const free = os.freemem();
    if (total > 0) {
      return {
        usedPct: Math.round(((total - free) / total) * 100),
        usedMb: Math.round((total - free) / 1e6),
        totalMb: Math.round(total / 1e6),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function collectUptime() {
  try {
    const sec = os.uptime();
    if (!Number.isFinite(sec) || sec < 0) return null;
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((sec % 3600) / 60);
    return `${hours}h ${mins}m`;
  } catch {
    return null;
  }
}

function collectServices(services = DEFAULT_SERVICES) {
  const out = {};
  for (const name of services) {
    const status = safeExec('systemctl', ['is-active', name]);
    out[name.replace(/\.service$/, '')] = status || 'unknown';
  }
  return out;
}

/**
 * @returns {object} metrics bag; never throws
 */
function collectSystemMetrics(options = {}) {
  try {
    return {
      disk: collectDisk(),
      memory: collectMemory(),
      uptime: collectUptime(),
      services: collectServices(options.services || DEFAULT_SERVICES),
      collectedAt: new Date().toISOString(),
    };
  } catch {
    return {
      disk: null,
      memory: null,
      uptime: null,
      services: {},
      collectedAt: new Date().toISOString(),
      error: 'collect_failed',
    };
  }
}

/**
 * Short Telegram-friendly text. Never throws.
 */
function formatMetricsSummary(metrics) {
  try {
    const m = metrics && typeof metrics === 'object' ? metrics : {};
    const lines = [];

    if (m.disk && Number.isFinite(m.disk.usedPct)) {
      lines.push(
        `- Disk: ${m.disk.usedPct}% used` +
          (m.disk.usedGb != null && m.disk.totalGb != null
            ? ` (${m.disk.usedGb}/${m.disk.totalGb} GB)`
            : ''),
      );
    } else {
      lines.push('- Disk: unknown');
    }

    if (m.memory && Number.isFinite(m.memory.usedPct)) {
      lines.push(
        `- Memory: ${m.memory.usedPct}% used` +
          (m.memory.usedMb != null && m.memory.totalMb != null
            ? ` (${m.memory.usedMb}/${m.memory.totalMb} MB)`
            : ''),
      );
    } else {
      lines.push('- Memory: unknown');
    }

    lines.push(`- Uptime: ${m.uptime || 'unknown'}`);

    const services = m.services && typeof m.services === 'object' ? m.services : {};
    const svcBits = Object.entries(services).map(([k, v]) => `${k}=${v}`);
    lines.push(`- Services: ${svcBits.length ? svcBits.join(', ') : 'unknown'}`);

    return lines.join('\n');
  } catch {
    return '- Disk: unknown\n- Memory: unknown\n- Uptime: unknown\n- Services: unknown';
  }
}

const DISK_WARN_PCT = Number(process.env.MEMORY_WATCH_DISK_WARN_PCT || 85);
const DISK_CRIT_PCT = Number(process.env.MEMORY_WATCH_DISK_CRIT_PCT || 95);
const MEM_WARN_PCT = Number(process.env.MEMORY_WATCH_MEM_WARN_PCT || 85);
const MEM_CRIT_PCT = Number(process.env.MEMORY_WATCH_MEM_CRIT_PCT || 95);

/**
 * Returns alert strings in "key: message" form (key used by callers for
 * per-alert cooldown dedup). Never throws — degrades to no alerts.
 */
function evaluateAlerts(metrics) {
  const alerts = [];
  try {
    const m = metrics && typeof metrics === 'object' ? metrics : {};

    if (m.disk && Number.isFinite(m.disk.usedPct)) {
      const gb = m.disk.usedGb != null && m.disk.totalGb != null ? ` (${m.disk.usedGb}/${m.disk.totalGb} GB)` : '';
      if (m.disk.usedPct >= DISK_CRIT_PCT) {
        alerts.push(`disk_critical: Disk ${m.disk.usedPct}% used${gb} — critical`);
      } else if (m.disk.usedPct >= DISK_WARN_PCT) {
        alerts.push(`disk_warning: Disk ${m.disk.usedPct}% used${gb} — high`);
      }
    }

    if (m.memory && Number.isFinite(m.memory.usedPct)) {
      const mb = m.memory.usedMb != null && m.memory.totalMb != null ? ` (${m.memory.usedMb}/${m.memory.totalMb} MB)` : '';
      if (m.memory.usedPct >= MEM_CRIT_PCT) {
        alerts.push(`memory_critical: Memory ${m.memory.usedPct}% used${mb} — critical`);
      } else if (m.memory.usedPct >= MEM_WARN_PCT) {
        alerts.push(`memory_warning: Memory ${m.memory.usedPct}% used${mb} — high`);
      }
    }

    const services = m.services && typeof m.services === 'object' ? m.services : {};
    for (const [name, status] of Object.entries(services)) {
      if (status && status !== 'active') {
        alerts.push(`service_${name}: ${name} is "${status}" (expected active)`);
      }
    }
  } catch {
    return [];
  }
  return alerts;
}

module.exports = {
  collectSystemMetrics,
  formatMetricsSummary,
  evaluateAlerts,
};
