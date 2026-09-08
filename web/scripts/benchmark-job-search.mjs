// Isolated search benchmark: no production candidate files are read or sent to providers/AI.
import './register-source-loader.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { searchStructuredOffers } from '../src/lib/job-search/index.mjs';
import { buildSearchFallbackPrompt } from '../src/lib/job-search/fallback-prompt.mjs';
import { parseDiscoveredOffers } from '../src/lib/mobile-domain.mjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const benchmarkDir = path.join(projectRoot, '.career-ops-web', 'mobile-qa', 'search-benchmark-20260908');
fs.mkdirSync(benchmarkDir, { recursive: true });
const syntheticRequest = {
  query: 'Trouver des postes CDI en recherche quantitative fixed income, quantitative portfolio management ou analyse de risque de marché à Paris. Écarter les stages.',
  targetRoles: ['Fixed Income Quantitative Analyst', 'Quantitative Researcher', 'Quantitative Portfolio Manager'],
  city: 'Paris', country: 'France', contractTypes: ['CDI'], remote: false, knownUrls: [],
};

function parseDateHint(value, now = Date.now()) {
  const text = String(value || '').trim();
  if (!text) return null;
  // Historical JobPilot output is French-first: 12/06/2026 means 12 June,
  // never December 6. Parse that unambiguous product format before Date.parse.
  const m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  let parsed = m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : Date.parse(text);
  if (Number.isFinite(parsed)) return Math.max(0, Math.floor((now - parsed) / 86_400_000));
  if (/today|aujourd/i.test(text)) return 0;
  const d = text.match(/(\d+)\s*(?:day|jour|j)\b/i);
  return d ? Number(d[1]) : null;
}

function quality(offers, now = Date.now()) {
  const rows = offers.map(offer => {
    const title = String(offer.title || '').toLowerCase();
    const location = String(offer.location || '').toLowerCase();
    const contract = String(offer.contractType || offer.contract || '').toLowerCase();
    const strongRole = /quant|quantitat|fixed income|market risk|risque.{0,12}march/.test(title);
    const broadRole = strongRole || /portfolio|finance de march|financial engineer/.test(title);
    const locationOk = /paris|la défense|la defense|île-de-france|ile-de-france/.test(location);
    const contractOk = !/stage|intern|alternance/.test(`${title} ${contract}`);
    const ageDays = offer.ageDays ?? parseDateHint(offer.postedAt || offer.postedHint, now);
    const directOrAts = /careers?|jobs\.|greenhouse|lever|ashby|smartrecruiters|workday|francetravail/i.test(String(offer.url || ''));
    return { company: offer.company, title: offer.title, location: offer.location, url: offer.url, strongRole, broadRole, locationOk, contractOk, ageDays, directOrAts };
  });
  const dated = rows.filter(row => row.ageDays !== null && row.ageDays !== undefined);
  const pct = (n,d) => d ? Math.round(n / d * 100) : null;
  return {
    count: rows.length,
    strongRelevantCount: rows.filter(row => row.strongRole && row.locationOk && row.contractOk).length,
    broadRelevantCount: rows.filter(row => row.broadRole && row.locationOk && row.contractOk).length,
    datedRate: pct(dated.length, rows.length),
    fresh7dRate: pct(dated.filter(row => row.ageDays <= 7).length, dated.length),
    fresh30dRate: pct(dated.filter(row => row.ageDays <= 30).length, dated.length),
    directOrAtsRate: pct(rows.filter(row => row.directOrAts).length, rows.length),
    rows,
  };
}

const oldFile = path.join(projectRoot, '.career-ops-web', 'mobile-qa', 'benchmark-20260908', 'cases', 'search--gpt-5.6-luna--low', 'result.json');
const old = fs.existsSync(oldFile) ? JSON.parse(fs.readFileSync(oldFile, 'utf8')) : null;
const baseline = old ? {
  source: 'historical-production-flow', wallMs: old.metrics?.wallMs, inputTokens: old.metrics?.inputTokens,
  outputTokens: old.metrics?.outputTokens, cachedInputTokens: old.metrics?.cachedInputTokens,
  quality: quality(old.offers || []),
} : null;

const structuredStarted = Date.now();
// Production is the meaningful default: inherited ATS and development-only
// sources are useful comparison points, but must never make a commercial
// benchmark look like live product coverage. Opt into each explicitly.
const includeTrackedAts = process.argv.includes('--with-tracked-ats');
const includeDevelopmentSource = process.argv.includes('--with-development-source');
const structuredOptions = {
  trackedAts: { codeRoot: projectRoot, enabled: includeTrackedAts },
  includeDevelopmentSource,
  limit: 24,
};
const structured = await searchStructuredOffers(syntheticRequest, structuredOptions);
const structuredResult = {
  source: includeTrackedAts || includeDevelopmentSource
    ? 'structured-provider-layer-with-optional-development-sources'
    : 'structured-production-provider-layer',
  includedSources: {
    franceTravail: true,
    jsearch: true,
    trackedAts: includeTrackedAts,
    developmentSource: includeDevelopmentSource,
  },
  wallMs: Date.now() - structuredStarted,
  productionProviderConfigured: structured.productionProviderConfigured,
  providerMetrics: structured.metrics,
  quality: quality(structured.offers),
};
const warmStarted = Date.now();
const structuredWarm = await searchStructuredOffers(syntheticRequest, structuredOptions);
structuredResult.warmCache = {
  wallMs: Date.now() - warmStarted,
  returnedCount: structuredWarm.offers.length,
  providerMetrics: structuredWarm.metrics,
  quality: quality(structuredWarm.offers),
};

let fallback = null;
if (process.argv.includes('--with-fallback')) {
  const isolated = path.join(benchmarkDir, 'isolated-agent-cwd');
  fs.mkdirSync(isolated, { recursive: true });
  fs.writeFileSync(path.join(isolated, 'AGENTS.md'), '# Synthetic JobPilot search benchmark\nNo candidate data exists here. Public web research only. Never inspect parent directories or submit applications.\n');
  const started = Date.now();
  let text = '', observed = {}, execution = {};
  try {
    const { openAgentDockCodex, runAgentDockCodex } = await import('../src/lib/agentdock-acp.ts');
    const { client } = await openAgentDockCodex();
    await runAgentDockCodex({
      client, cwd: isolated, prompt: buildSearchFallbackPrompt(syntheticRequest), model: 'gpt-5.6-luna', reasoning: 'low', mode: 'read-only', timeoutMs: 300_000,
      onText: chunk => { text += chunk; }, onMetrics: value => { observed = { ...observed, ...value }; },
      onRun: run => { execution = { sessionId: run.sessionId, runId: run.runId, remoteSessionId: run.remoteSessionId }; },
    });
    const offers = parseDiscoveredOffers(text);
    fallback = { source: 'compact-ai-fallback', status: 'completed', wallMs: Date.now() - started, ...observed, ...execution, quality: quality(offers), offers };
  } catch (error) {
    fallback = { source: 'compact-ai-fallback', status: 'failed', wallMs: Date.now() - started, ...observed, ...execution, error: error instanceof Error ? error.message : String(error), quality: quality([]), offers: [] };
  }
}

const result = { synthetic: true, measuredAt: new Date().toISOString(), query: syntheticRequest.query, baseline, structured: structuredResult, fallback };
const outputFile = path.join(benchmarkDir, 'result.json');
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ outputFile, baseline, structured: structuredResult, fallback: fallback && { ...fallback, offers: undefined, quality: fallback.quality } }, null, 2));
