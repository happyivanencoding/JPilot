const ENDPOINT = 'https://www.arbeitnow.com/api/job-board-api';

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function inferContract(job) {
  const raw = `${job?.title || ''} ${(job?.tags || []).join(' ')}`;
  if (/intern|internship|\bstage\b|praktik/i.test(raw)) return 'Stage';
  if (/apprentice|alternance|apprentissage|ausbildung/i.test(raw)) return 'Alternance';
  if (/\bCDD\b|fixed.?term/i.test(raw)) return 'CDD';
  if (/\bCDI\b|permanent/i.test(raw)) return 'CDI';
  return 'unknown';
}

// Development benchmark source only. Arbeitnow's public terms require a backlink and
// its general use licence is not a suitable default foundation for a commercial product.
export async function searchArbeitnow(input, options = {}) {
  if (!options.enabled) return { id: 'arbeitnow-dev', label: 'Arbeitnow (dev)', status: 'disabled', latencyMs: 0, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: [] };
  const started = Date.now();
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(ENDPOINT, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Arbeitnow HTTP ${response.status}`);
  const json = await response.json();
  const offers = (Array.isArray(json?.data) ? json.data : []).flatMap(job => {
    const url = clean(job?.url, 2000);
    if (!/^https?:\/\//i.test(url) || !job?.title || !job?.company_name) return [];
    const epoch = Number(job?.created_at);
    const postedAt = Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : null;
    return [{
      url,
      title: clean(job.title, 300),
      company: clean(job.company_name, 300),
      location: clean(job.location, 300),
      source: 'arbeitnow-dev',
      sourceLabel: 'Arbeitnow',
      direct: false,
      remote: job?.remote === true,
      postedAt,
      postedHint: postedAt || '',
      contractType: inferContract(job),
      description: clean(job.description, 12000),
      verification: 'unconfirmed',
      requiresAttribution: true,
      developmentOnly: true,
    }];
  });
  return { id: 'arbeitnow-dev', label: 'Arbeitnow (dev)', status: 'ok', latencyMs: Date.now() - started, rawCount: offers.length, apiCalls: 1, estimatedCostUsd: 0, offers };
}
