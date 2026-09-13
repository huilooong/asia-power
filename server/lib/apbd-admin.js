'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function safeUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return SAFE_URL_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : '';
  } catch (_) {
    return '';
  }
}

function latestCampaignFile(asiaRoot) {
  const root = path.join(asiaRoot, 'runtime', 'apbd', 'solo_trade', 'campaigns');
  if (!fs.existsSync(root)) return '';
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'campaign.json'))
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({ candidate, mtime: fs.statSync(candidate).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.candidate || '';
}

function canonicalIndex(asiaRoot) {
  const data = readJson(path.join(asiaRoot, 'runtime', 'apbd', 'leads', 'db', 'companies.json'), {});
  const rows = Array.isArray(data) ? data : (data.companies || []);
  return new Map(rows.filter((row) => row && row.id).map((row) => [String(row.id), row]));
}

function summarizeNative(leads, companies) {
  const summary = {
    companiesChecked: 0,
    publicEmailsChecked: 0,
    officialDomainEmails: 0,
    freeMailboxes: 0,
    unresolvedDomains: 0,
    roleMailboxes: 0,
    namedPeopleWithEvidence: 0,
    emailPatternHypotheses: 0,
    sendEligible: 0,
    outreachSent: 0,
  };
  for (const lead of leads) {
    const company = companies.get(String(lead.apbd_company_id || lead.apbdId || ''));
    const native = company?.native_enrichment;
    if (!native || native.version !== 'apbd-native-enrichment-v1') continue;
    const metrics = native.summary || {};
    summary.companiesChecked += 1;
    summary.publicEmailsChecked += Number(metrics.public_emails_checked || 0);
    summary.officialDomainEmails += Number(metrics.official_domain_emails || 0);
    summary.freeMailboxes += Number(metrics.free_mailboxes || 0);
    summary.unresolvedDomains += Number(metrics.unresolved_domains || 0);
    summary.roleMailboxes += Number(metrics.role_mailboxes || 0);
    summary.namedPeopleWithEvidence += Number(metrics.named_people_with_evidence || 0);
    summary.emailPatternHypotheses += Number(metrics.email_pattern_hypotheses || 0);
    summary.sendEligible += Number(metrics.send_eligible || 0);
    summary.outreachSent += native.outreach_sent ? 1 : 0;
  }
  return summary;
}

function summarizeHunter(leads) {
  const summary = {
    plan: 'Free / opt-in only',
    domainsTested: 0,
    contactsFound: 0,
    newContacts: 0,
    valid: 0,
    invalid: 0,
    unknown: 0,
    namedContacts: 0,
  };
  for (const lead of leads) {
    const hunter = lead?.provider_enrichment?.hunter;
    if (!hunter) continue;
    summary.domainsTested += 1;
    summary.contactsFound += Number(hunter.contacts_found || hunter.result?.contacts?.length || 0);
    summary.newContacts += Number(hunter.new_contacts || 0);
    for (const contact of hunter.result?.contacts || []) {
      const status = String(contact.verification_status || contact.status || 'unknown').toLowerCase();
      if (status === 'valid') summary.valid += 1;
      else if (status === 'invalid') summary.invalid += 1;
      else summary.unknown += 1;
      if (String(contact.name || '').trim()) summary.namedContacts += 1;
    }
  }
  return summary;
}

function sanitizeRuntimeCampaign(campaign, asiaRoot) {
  const leads = Array.isArray(campaign.leads) ? campaign.leads : [];
  const companies = canonicalIndex(asiaRoot);
  const scores = leads.map((lead) => Number(lead.score?.overall_score || 0));
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  for (const lead of leads) {
    const grade = String(lead.score?.grade || 'D').toUpperCase();
    if (Object.hasOwn(grades, grade)) grades[grade] += 1;
  }
  const brief = campaign.brief || {};
  const publicLeads = leads.map((lead) => {
    const company = companies.get(String(lead.apbd_company_id || ''));
    const native = company?.native_enrichment?.summary || {};
    const sources = (lead.source_urls || [lead.source_url, lead.website])
      .map(safeUrl).filter(Boolean).slice(0, 5);
    return {
      id: String(lead.lead_id || ''),
      apbdId: String(lead.apbd_company_id || ''),
      company: String(lead.company || lead.display_name || 'Unnamed company').slice(0, 180),
      city: String(lead.city || lead.country || '').slice(0, 160),
      type: String(lead.business_type || '').slice(0, 220),
      website: safeUrl(lead.website),
      status: String(lead.status || 'research'),
      score: Number(lead.score?.overall_score || 0),
      grade: String(lead.score?.grade || 'D').toUpperCase(),
      confidence: Number(lead.score?.confidence || 0),
      source: String(lead.data_source || (sources[0] ? 'public_web' : 'public_directory')),
      notes: (lead.score?.notes || []).map((note) => String(note).slice(0, 240)).slice(0, 5),
      sources,
      hunter: {
        searched: Boolean(lead.provider_enrichment?.hunter),
        found: Number(lead.provider_enrichment?.hunter?.contacts_found || 0),
        new: Number(lead.provider_enrichment?.hunter?.new_contacts || 0),
      },
      native: {
        checked: Boolean(company?.native_enrichment),
        publicEmailsChecked: Number(native.public_emails_checked || 0),
        roleMailboxes: Number(native.role_mailboxes || 0),
        namedPeopleWithEvidence: Number(native.named_people_with_evidence || 0),
        sendEligible: 0,
      },
    };
  });
  return {
    schemaVersion: 'apbd-admin-promotion-v1',
    generatedAt: new Date().toISOString(),
    dataMode: 'runtime_redacted',
    campaign: {
      id: String(campaign.campaign_id || ''),
      name: String(campaign.name || 'APBD Solo Trade').slice(0, 180),
      productKeywords: (brief.product_keywords || []).map(String).slice(0, 10),
      targetMarkets: (brief.target_markets || []).map(String).slice(0, 10),
      customerTypes: (brief.customer_types || []).map(String).slice(0, 10),
      searchDepth: Number(brief.search_depth || 0),
      maxCustomers: Number(brief.max_customers || 0),
      contactEnrichment: Boolean(brief.enable_contact_enrichment),
    },
    summary: {
      totalLeads: leads.length,
      apbdLinked: leads.filter((lead) => lead.apbd_company_id).length,
      averageScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
      gradeA: grades.A,
      gradeB: grades.B,
      gradeC: grades.C,
      gradeD: grades.D,
      outreachReady: leads.filter((lead) => lead.status === 'approved_for_outreach').length,
      sent: leads.reduce((count, lead) => count + (lead.activities || []).filter((row) => row.type === 'sent').length, 0),
    },
    hunter: summarizeHunter(leads),
    apollo: { configured: false, used: false, organizationsFound: 0, peopleFound: 0 },
    native: summarizeNative(leads, companies),
    governance: {
      externalSend: 'disabled_requires_independent_approval',
      guessedEmails: 'disabled',
      smtpRecipientProbe: 'disabled',
    },
    leads: publicLeads,
  };
}

function buildPromotionSnapshot(asiaRoot) {
  const campaignFile = latestCampaignFile(asiaRoot);
  const campaign = campaignFile ? readJson(campaignFile) : null;
  if (campaign) return sanitizeRuntimeCampaign(campaign, asiaRoot);
  const fallback = path.join(asiaRoot, 'docs', 'previews', 'apbd-solo-trade-002', 'sample-campaign.json');
  const preview = readJson(fallback);
  if (!preview) {
    return {
      schemaVersion: 'apbd-admin-promotion-v1',
      generatedAt: new Date().toISOString(),
      dataMode: 'empty',
      campaign: {},
      summary: { totalLeads: 0, outreachReady: 0, sent: 0 },
      hunter: {},
      apollo: { configured: false, used: false },
      native: summarizeNative([], new Map()),
      governance: { externalSend: 'disabled_requires_independent_approval' },
      leads: [],
    };
  }
  return {
    ...preview,
    schemaVersion: 'apbd-admin-promotion-v1',
    generatedAt: new Date().toISOString(),
    dataMode: 'redacted_preview_fallback',
    apollo: { configured: false, used: false, organizationsFound: 0, peopleFound: 0 },
    native: summarizeNative(preview.leads || [], canonicalIndex(asiaRoot)),
    governance: {
      externalSend: 'disabled_requires_independent_approval',
      guessedEmails: 'disabled',
      smtpRecipientProbe: 'disabled',
    },
  };
}

function sanitizeRunOptions(input = {}) {
  const country = String(input.country || 'VE').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw Object.assign(new Error('country must be an ISO-2 code'), { statusCode: 400 });
  const city = String(input.city || '').trim();
  if (city.length > 100 || /[\r\n\0]/.test(city)) throw Object.assign(new Error('invalid city'), { statusCode: 400 });
  const limit = Number(input.limit ?? 10);
  const workers = Number(input.workers ?? 3);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Object.assign(new Error('limit must be 1-100'), { statusCode: 400 });
  if (!Number.isInteger(workers) || workers < 1 || workers > 8) throw Object.assign(new Error('workers must be 1-8'), { statusCode: 400 });
  return { country, city, limit, workers };
}

function createNativeEnrichmentController(asiaRoot, options = {}) {
  const stateFile = path.join(asiaRoot, 'runtime', 'apbd', 'leads', 'native-enrichment-job.json');
  const logFile = path.join(asiaRoot, 'runtime', 'apbd', 'leads', 'native-enrichment-job.log');
  const script = path.join(asiaRoot, 'scripts', 'apbd_leads_native_enrich.py');
  const spawnProcess = options.spawnProcess || spawn;

  function writeState(state) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    return state;
  }

  function status() {
    const state = readJson(stateFile, { status: 'idle', outreachSent: false });
    if (state.status === 'running' && state.pid) {
      try { process.kill(Number(state.pid), 0); } catch (_) {
        state.status = 'interrupted';
        state.finishedAt = new Date().toISOString();
        writeState(state);
      }
    }
    return { ...state, outreachSent: false };
  }

  function start(input = {}) {
    const current = status();
    if (current.status === 'running') throw Object.assign(new Error('native enrichment is already running'), { statusCode: 409 });
    if (!fs.existsSync(script)) throw Object.assign(new Error('native enrichment script is unavailable'), { statusCode: 503 });
    const run = sanitizeRunOptions(input);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const log = fs.openSync(logFile, 'a', 0o600);
    const args = [script, '--country', run.country, '--limit', String(run.limit), '--workers', String(run.workers)];
    if (run.city) args.push('--city', run.city);
    const child = spawnProcess(process.env.APBD_PYTHON || 'python3', args, {
      cwd: asiaRoot,
      stdio: ['ignore', log, log],
      shell: false,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    const started = writeState({
      status: 'running',
      pid: child.pid,
      startedAt: new Date().toISOString(),
      finishedAt: '',
      options: run,
      outreachSent: false,
    });
    child.once('error', (error) => writeState({ ...started, status: 'failed_to_start', finishedAt: new Date().toISOString(), error: String(error.message || error).slice(0, 240) }));
    child.once('close', (code, signal) => {
      fs.closeSync(log);
      writeState({ ...started, status: code === 0 ? 'complete' : 'failed', exitCode: code, signal: signal || '', finishedAt: new Date().toISOString(), outreachSent: false });
    });
    return started;
  }

  return { status, start, stateFile, logFile };
}

module.exports = {
  buildPromotionSnapshot,
  createNativeEnrichmentController,
  safeUrl,
  sanitizeRunOptions,
};
