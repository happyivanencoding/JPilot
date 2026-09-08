import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as yaml from 'js-yaml';

const host = globalThis;
const cache = host.__jobPilotTrackedAtsCache ||= new Map();

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function isoDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const time = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const run = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function remoteSignal(job) {
  return /\bremote\b|télétravail|teletravail|home.?office/i.test(`${job?.title || ''} ${job?.location || ''}`);
}

/**
 * Transitional adapter around the original zero-token ATS provider catalogue.
 * New JobPilot clients depend only on the JobPilot search contract; this module
 * can disappear later without changing Android or the rest of the search pipeline.
 */
export async function searchTrackedAts(input, options = {}) {
  if (options.enabled !== true) return { id: 'tracked-ats', label: 'ATS directs', status: 'disabled', latencyMs: 0, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: [] };
  const codeRoot = options.codeRoot;
  if (!codeRoot) return { id: 'tracked-ats', label: 'ATS directs', status: 'unconfigured', latencyMs: 0, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: [] };
  const portalsPath = options.portalsPath || path.join(codeRoot, 'portals.yml');
  if (!fs.existsSync(/* turbopackIgnore: true */ portalsPath)) return { id: 'tracked-ats', label: 'ATS directs', status: 'unconfigured', latencyMs: 0, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: [] };
  const started = Date.now();
  const ttlMs = Math.max(30_000, Number(process.env.JOBPILOT_TRACKED_ATS_CACHE_MS || 900_000));
  const cacheKey = `${portalsPath}|${fs.statSync(/* turbopackIgnore: true */ portalsPath).mtimeMs}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.value, latencyMs: Date.now() - started, cacheHit: true };
  }

  const config = yaml.load(fs.readFileSync(/* turbopackIgnore: true */ portalsPath, 'utf8')) || {};
  const entries = Array.isArray(config.tracked_companies) ? config.tracked_companies.filter(entry => entry && entry.enabled !== false && typeof entry.name === 'string') : [];
  const providersDir = path.join(codeRoot, 'providers');
  const registry = await import(pathToFileURL(path.join(providersDir, '_registry.mjs')).href);
  const http = await import(pathToFileURL(path.join(providersDir, '_http.mjs')).href);
  const providers = await registry.loadProviders(providersDir);
  const ctx = http.makeHttpCtx();
  const concurrency = Math.max(1, Math.min(24, Number(process.env.JOBPILOT_TRACKED_ATS_CONCURRENCY || 16)));
  let boardsAttempted = 0;
  let boardsSucceeded = 0;
  const failures = [];

  const groups = await pool(entries, concurrency, async entry => {
    const resolved = registry.resolveProvider(entry, providers, { skipIds: ['local-parser'] });
    if (!resolved?.provider) return [];
    boardsAttempted++;
    try {
      const rows = await resolved.provider.fetch(entry, ctx);
      boardsSucceeded++;
      return (Array.isArray(rows) ? rows : []).flatMap(job => {
        const url = clean(job?.url, 2000);
        const title = clean(job?.title, 300);
        const company = clean(job?.company || entry.name, 300);
        if (!/^https?:\/\//i.test(url) || !title || !company) return [];
        return [{
          url,
          title,
          company,
          location: clean(job?.location, 300),
          source: 'tracked-ats',
          sourceLabel: clean(resolved.provider.id, 100),
          direct: true,
          remote: remoteSignal(job),
          postedAt: isoDate(job?.postedAt),
          postedHint: isoDate(job?.postedAt) || '',
          contractType: 'unknown',
          description: clean(job?.description, 12000),
          verification: 'unconfirmed',
          providerJobId: clean(job?.id, 300),
        }];
      });
    } catch (error) {
      failures.push({ company: clean(entry.name, 120), provider: resolved.provider.id, error: clean(error instanceof Error ? error.message : error, 240) });
      return [];
    }
  });

  const offers = groups.flat();
  const value = {
    id: 'tracked-ats', label: 'ATS directs', status: boardsSucceeded ? 'ok' : (boardsAttempted ? 'error' : 'unconfigured'),
    latencyMs: Date.now() - started,
    rawCount: offers.length,
    apiCalls: boardsAttempted,
    estimatedCostUsd: 0,
    boardsAttempted,
    boardsSucceeded,
    boardsFailed: failures.length,
    failures: failures.slice(0, 8),
    offers,
  };
  cache.clear();
  cache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value });
  return value;
}
