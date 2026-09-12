import {load} from 'cheerio';

// Public employer boards verified 2026-09-12 at careers.smartrecruiters.com/{id}.
// Protocol: https://developers.smartrecruiters.com/reference/v1listpostings
// Details: https://developers.smartrecruiters.com/reference/v1getposting
export const DEFAULT_SMARTRECRUITERS_COMPANIES = ['Wavestone1', 'Sia'];
const ROOT = 'https://api.smartrecruiters.com/v1/companies/';
const clean = (value, max = 500) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const bounded = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.max(1, Math.min(max, Math.floor(Number(value)))) : fallback;
const webUrl = value => {try {const url = new URL(value); return url.protocol === 'https:' ? url.href : '';} catch {return '';}};

export function smartRecruitersCompanies(value = process.env.JOBPILOT_SMARTRECRUITERS_COMPANIES) {
  const values = value === undefined ? DEFAULT_SMARTRECRUITERS_COMPANIES : Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(values.map(value => clean(value, 100)).filter(value => /^[a-zA-Z0-9_-]+$/.test(value)))].slice(0, 10);
}

function contractEvidence(job) {
  const raw = clean(`${job.typeOfEmployment?.id || ''} ${job.typeOfEmployment?.label || ''} ${job.name || ''}`, 700);
  let type = 'unknown';
  if (/\balternance\b|\bapprenti\w*|\bapprentice\w*/i.test(raw)) type = 'Alternance';
  else if (/\bintern\b|\binternship\b|\bstage\b|\bstagiaire\b/i.test(raw)) type = 'Stage';
  else if (/\bCDD\b/i.test(raw)) type = 'CDD';
  else if (/\bCDI\b/i.test(raw)) type = 'CDI';
  // full_time, permanent and temporary metadata are not proof of a French contract.
  return {type, raw};
}

export function normalizeSmartRecruitersPosting(job, companyIdentifier) {
  if (!job || job.active === false || job.visibility !== 'PUBLIC') return null;
  const url = webUrl(job.postingUrl), applyUrl = webUrl(job.applyUrl);
  if (!url || !clean(job.name) || !clean(job.company?.name)) return null;
  const sections = job.jobAd?.sections || {};
  const html = Object.values(sections).map(section => typeof section?.text === 'string' ? section.text : '').join('\n');
  const $ = load(html); $('script,style').remove(); $('p,li,br,h1,h2,h3').prepend(' ');
  const contract = contractEvidence(job);
  const country = clean(job.location?.country, 2).toLowerCase();
  const date = Date.parse(job.releasedDate);
  return {
    url, applyUrl, title: clean(job.name, 300), company: clean(job.company.name, 300),
    country, location: clean(job.location?.fullLocation || [job.location?.city, job.location?.region, country].filter(Boolean).join(', '), 300),
    source: 'smartrecruiters', sourceLabel: 'SmartRecruiters · employer posting', direct: true,
    remote: job.location?.remote === true, postedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
    postedHint: clean(job.releasedDate, 60), contractType: contract.type,
    description: clean($.root().text(), 12000), verification: 'unconfirmed',
    contractEvidence: {source: 'SmartRecruiters typeOfEmployment and posting title', raw: contract.raw},
    provenance: {provider: 'smartrecruiters', companyIdentifier, postingId: clean(job.id, 100), postingUrl: url, applyUrl, country, typeOfEmployment: {id: clean(job.typeOfEmployment?.id, 100), label: clean(job.typeOfEmployment?.label, 100)}},
  };
}

async function pool(items, concurrency, work) {
  let cursor = 0;
  const result = new Array(items.length);
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, async () => {
    while (cursor < items.length) {const index = cursor++; result[index] = await work(items[index]);}
  }));
  return result;
}

export async function searchSmartRecruiters(input, options = {}) {
  const started = Date.now();
  const base = {id: 'smartrecruiters', label: 'SmartRecruiters', latencyMs: 0, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: []};
  if (options.enabled === false) return {...base, status: 'disabled'};
  const companies = smartRecruitersCompanies(options.companies);
  if (!companies.length) return {...base, status: 'unconfigured'};
  const queries = [...new Set([...(input.franceTravailQueries || []), ...(input.queries || [])].map(value => clean(value, 120)).filter(Boolean))].slice(0, 6);
  if (!queries.length) return {...base, status: 'disabled'};
  const fetchImpl = options.fetchImpl || fetch, errors = [];
  let apiCalls = 0, truncated = false;
  const read = async url => {
    apiCalls++;
    const response = await fetchImpl(url, {method: 'GET', redirect: 'error', signal: AbortSignal.timeout(bounded(options.timeoutMs, 8000, 15000)), headers: {accept: 'application/json'}});
    if (!response.ok) throw new Error(`SmartRecruiters HTTP ${response.status}`);
    return response.json();
  };
  const limit = bounded(options.pageSize, 20, 100), maxOffers = bounded(options.maxOffers, 60, 150);
  const lists = await pool(companies.flatMap(company => queries.map(query => ({company, query}))), 4, async ({company, query}) => {
    try {
      const url = new URL(`${ROOT}${encodeURIComponent(company)}/postings`);
      url.searchParams.set('destination', 'PUBLIC'); url.searchParams.set('q', query); url.searchParams.set('limit', String(limit)); url.searchParams.set('offset', '0');
      const country = clean(input.countryCode || (/^france$/i.test(input.country || '') ? 'fr' : ''), 2).toLowerCase();
      if (/^[a-z]{2}$/.test(country)) url.searchParams.set('country', country);
      const data = await read(url.href);
      if (!Array.isArray(data?.content)) throw new Error('SmartRecruiters invalid list response');
      if (Number(data.totalFound) > data.content.length) truncated = true;
      return data.content.filter(row => row.visibility === 'PUBLIC' && /^[a-zA-Z0-9-]+$/.test(String(row.id || ''))).map(row => ({company, id: String(row.id)}));
    } catch (error) {errors.push({company, error: clean(error.message, 180)}); return [];}
  });
  // Interleave probes so one large board cannot consume the entire detail budget.
  const interleaved = [];
  for (let index = 0; index < Math.max(0, ...lists.map(rows => rows.length)); index++) {
    for (const rows of lists) if (rows[index]) interleaved.push(rows[index]);
  }
  const unique = [...new Map(interleaved.map(row => [`${row.company}/${row.id}`, row])).values()];
  if (unique.length > maxOffers) truncated = true;
  const details = await pool(unique.slice(0, maxOffers), 6, async ({company, id}) => {
    try {return normalizeSmartRecruitersPosting(await read(`${ROOT}${encodeURIComponent(company)}/postings/${encodeURIComponent(id)}`), company);}
    catch (error) {errors.push({company, error: clean(error.message, 180)}); return null;}
  });
  const offers = details.filter(Boolean);
  return {...base, status: errors.length ? (offers.length ? 'partial' : 'error') : 'ok', offers, rawCount: offers.length, apiCalls, latencyMs: Date.now() - started, errors, truncated};
}
