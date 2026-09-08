const ENDPOINT = 'https://api.openwebninja.com/jsearch/search-v2';

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function directOption(job) {
  const options = Array.isArray(job?.apply_options) ? job.apply_options : [];
  return options.find(option => option?.is_direct && /^https?:\/\//i.test(String(option.apply_link || '')))
    || options.find(option => /^https?:\/\//i.test(String(option?.apply_link || '')))
    || null;
}

function contractType(job) {
  const types = Array.isArray(job?.job_employment_types) ? job.job_employment_types : [];
  if (types.includes('INTERN') || /intern|stage/i.test(String(job?.job_employment_type || ''))) return 'Stage';
  // FULLTIME/PARTTIME describe working time, not CDI/CDD. Do not turn them into a contract claim.
  return 'unknown';
}

function jobsFromResponse(json) {
  // search-v2 returns { data: { jobs, cursor } }; retain the older array shape
  // for a safe provider migration and for cached fixture compatibility.
  if (Array.isArray(json?.data?.jobs)) return json.data.jobs;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

export async function searchJSearch(input, options = {}) {
  const apiKey = options.apiKey || process.env.JOBPILOT_JSEARCH_API_KEY || process.env.OPENWEBNINJA_API_KEY;
  if (!apiKey) return { id: 'jsearch', label: 'JSearch', status: 'unconfigured', latencyMs: 0, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: [] };
  const fetchImpl = options.fetchImpl || fetch;
  const started = Date.now();
  const maxQueries = Math.max(1, Math.min(3, Number(process.env.JOBPILOT_JSEARCH_MAX_QUERIES || 3)));
  const baseQueries = input.queries.slice(0, maxQueries);
  const queries = input.flexibleEurope && input.countryCode && maxQueries >= 2
    ? baseQueries.slice(0, maxQueries - 1).map(query => ({ query, europeWide: false })).concat([{ query: baseQueries.at(-1) || baseQueries[0], europeWide: true }])
    : baseQueries.map(query => ({ query, europeWide: false }));
  const costPerRequest = Number(process.env.JOBPILOT_JSEARCH_COST_PER_REQUEST_USD || '0.005');
  const datePosted = String(process.env.JOBPILOT_JSEARCH_DATE_POSTED || 'month').toLowerCase();
  const timeoutMs = Math.max(3_000, Math.min(30_000, Number(process.env.JOBPILOT_JSEARCH_TIMEOUT_MS || 15_000)));
  const responses = await Promise.allSettled(queries.map(async ({ query, europeWide }) => {
    const url = new URL(ENDPOINT);
    url.searchParams.set('query', europeWide ? `${query} Europe` : input.city ? `${query} jobs in ${input.city}` : query);
    if (input.countryCode && !europeWide) url.searchParams.set('country', input.countryCode);
    url.searchParams.set('date_posted', ['today', '3days', 'week', 'month', 'all'].includes(datePosted) ? datePosted : 'month');
    url.searchParams.set('num_pages', '1');
    if (input.remoteOnly) url.searchParams.set('work_from_home', 'true');
    const response = await fetchImpl(url, { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`JSearch HTTP ${response.status}`);
    return await response.json();
  }));
  const successful = responses.filter(result => result.status === 'fulfilled').map(result => result.value);
  const failures = responses.filter(result => result.status === 'rejected').map(result => result.reason instanceof Error ? result.reason.message : String(result.reason));
  if (!successful.length) throw new Error(failures[0] || 'JSearch returned no usable response.');
  const offers = successful.flatMap(jobsFromResponse).flatMap(job => {
    const option = directOption(job);
    const url = clean(option?.apply_link || job?.job_apply_link, 2000);
    if (!/^https?:\/\//i.test(url)) return [];
    const postedAt = clean(job?.job_posted_at_datetime_utc || '', 100);
    return [{
      url,
      title: clean(job?.job_title, 300),
      company: clean(job?.employer_name || job?.job_publisher, 300),
      location: clean(job?.job_location, 300),
      country: clean(job?.job_country, 100),
      source: 'jsearch',
      sourceLabel: clean(job?.job_publisher || 'JSearch', 120),
      direct: Boolean(option?.is_direct || job?.job_apply_is_direct),
      remote: job?.job_is_remote === true,
      postedAt: postedAt || null,
      postedHint: clean(job?.job_posted_at || postedAt, 100),
      contractType: contractType(job),
      description: clean(job?.job_description, 12000),
      providerJobId: clean(job?.job_id, 300),
      verification: 'unconfirmed',
    }];
  }).filter(job => job.title && job.company);
  return {
    id: 'jsearch', label: 'JSearch', status: failures.length ? 'partial' : 'ok', latencyMs: Date.now() - started,
    rawCount: offers.length, apiCalls: queries.length,
    estimatedCostUsd: Number.isFinite(costPerRequest) ? queries.length * costPerRequest : null,
    failures: failures.slice(0, 3),
    offers,
  };
}
