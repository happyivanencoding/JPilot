import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const STOPWORDS = new Set(['job','jobs','role','roles','poste','postes','offre','offres','emploi','emplois','the','and','for','with','from','dans','pour','avec','des','les','une','un','de','du','et','en','paris','france','remote','hybrid','cdi','cdd','stage','internship','alternance','apprenticeship','analyst','manager','junior','senior']);

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalize(value) {
  return clean(value, 4000).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function ftsTokens(input) {
  const text = [input?.queries?.join(' '), input?.franceTravailQueries?.join(' '), input?.targetRoles?.join(' '), input?.query].filter(Boolean).join(' ');
  return [...new Set(normalize(text).split(/[^\p{L}\p{N}+#.]+/u).filter(token => token.length >= 2 && !STOPWORDS.has(token)))].slice(0, 14);
}

function contractWhere(types = []) {
  const clauses = [];
  for (const type of types) {
    if (type === 'Stage') clauses.push('j.is_stage=1');
    else if (type === 'Alternance') clauses.push('j.is_alternance=1');
    else if (type === 'CDI') clauses.push('j.is_cdi=1');
    else if (type === 'CDD') clauses.push('j.is_cdd=1');
    else if (/int[eé]rim/i.test(type)) clauses.push('j.is_interim=1');
  }
  return clauses.length ? `(${clauses.join(' OR ')})` : '';
}

function parseJson(value, fallback = []) {
  try { const parsed = JSON.parse(String(value || '')); return parsed ?? fallback; } catch { return fallback; }
}

function primaryContract(types) {
  if (!types.length) return 'unknown';
  return types.length === 1 ? types[0] : types.join(' / ');
}

export function searchJobIndex(input, options = {}) {
  const dbPath = options.dbPath || process.env.JOBPILOT_JOB_INDEX_DB;
  if (!dbPath) return { id:'job-index', label:'Onward Job Index', status:'unconfigured', latencyMs:0, rawCount:0, apiCalls:0, estimatedCostUsd:0, offers:[] };
  if (!fs.existsSync(dbPath)) return { id:'job-index', label:'Onward Job Index', status:'unavailable', latencyMs:0, rawCount:0, apiCalls:0, estimatedCostUsd:0, offers:[], error:'index file missing' };
  const started = Date.now();
  const db = new DatabaseSync(dbPath, { readOnly:true, timeout:2500 });
  try {
    const terms = ftsTokens(input);
    const params = [];
    const where = ['j.active=1', '(j.published_at IS NULL OR j.published_at <= ?)'];
    params.push(new Date(Date.now() + 86_400_000).toISOString());
    const contract = contractWhere(input.contractTypes || []);
    if (contract) where.push(contract);
    const maxRows = Math.max(24, Math.min(240, Number(options.limit || 100)));
    let rows;
    if (terms.length) {
      const match = terms.map(token => `"${token.replaceAll('"','')}"`).join(' OR ');
      const parisOrder = normalize(input.city) === 'paris' ? 'j.is_paris DESC, j.is_ile_de_france DESC,' : '';
      const sql = `SELECT j.*, bm25(jobs_fts, 8.0, 3.0, 2.0, 1.0) AS fts_rank FROM jobs_fts JOIN jobs j ON j.rowid=jobs_fts.rowid WHERE jobs_fts MATCH ? AND ${where.join(' AND ')} ORDER BY ${parisOrder} fts_rank ASC, COALESCE(j.published_at,'') DESC LIMIT ?`;
      rows = db.prepare(sql).all(match, ...params, maxRows);
    } else {
      const sql = `SELECT j.*, 0 AS fts_rank FROM jobs j WHERE ${where.join(' AND ')} ORDER BY j.is_paris DESC, COALESCE(j.published_at,'') DESC LIMIT ?`;
      rows = db.prepare(sql).all(...params, maxRows);
    }
    let meta = {};
    try { meta = Object.fromEntries(db.prepare('SELECT key,value FROM index_meta').all().map(row => [String(row.key), String(row.value)])); } catch {}
    const offers = rows.map(row => {
      const contractTypes = parseJson(row.contract_types, []);
      const providers = parseJson(row.providers, []);
      return {
        url: clean(row.url, 2000),
        title: clean(row.title, 300),
        company: clean(row.company, 300),
        location: clean(row.location, 300),
        country: clean(row.country || 'France', 80),
        source: 'job-index',
        sourceLabel: providers.length ? `Onward Job Index · ${providers.join(' · ')}` : 'Onward Job Index',
        direct: Boolean(clean(row.apply_url || row.url, 2000)),
        remote: Number(row.remote || 0) === 1,
        postedAt: row.published_at || null,
        postedHint: row.published_at || '',
        contractType: primaryContract(contractTypes),
        contractTypes,
        description: clean(row.description, 6000),
        providerJobId: clean(row.id, 300),
        indexProviders: providers,
        indexFtsRank: Number(row.fts_rank || 0),
        verification: 'indexed',
      };
    }).filter(offer => offer.url && offer.title);
    const syncedAt = meta.synced_at || meta.built_at || '';
    const syncAgeMs = syncedAt && Number.isFinite(Date.parse(syncedAt)) ? Math.max(0, Date.now() - Date.parse(syncedAt)) : null;
    return {
      id:'job-index', label:'Onward Job Index', status:'ok', latencyMs:Date.now()-started, rawCount:offers.length, apiCalls:0, estimatedCostUsd:0, offers,
      indexedCount:Number(meta.active_jobs || meta.job_count || 0) || null,
      syncedAt:syncedAt || null,
      syncAgeMs,
    };
  } finally {
    db.close();
  }
}
