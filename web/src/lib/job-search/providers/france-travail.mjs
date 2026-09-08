const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
const SEARCH_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
const SCOPES = 'api_offresdemploiv2 o2dsoffre';

let cachedToken = null;

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function countryCode(country) {
  return /france/i.test(String(country || '')) ? 'fr' : '';
}

async function accessToken(clientId, clientSecret, fetchImpl) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: SCOPES });
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`France Travail OAuth HTTP ${response.status}`);
  const json = await response.json();
  if (!json?.access_token) throw new Error('France Travail OAuth: access_token absent');
  cachedToken = { value: json.access_token, expiresAt: Date.now() + Math.max(60, Number(json.expires_in || 1200)) * 1000 };
  return cachedToken.value;
}

function offerUrl(job) {
  const candidates = [
    job?.origineOffre?.urlOrigine,
    ...(Array.isArray(job?.origineOffre?.partenaires) ? job.origineOffre.partenaires.map(x => x?.url) : []),
  ].filter(Boolean);
  const external = candidates.find(value => /^https?:\/\//i.test(String(value)));
  return external || (job?.id ? `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(job.id)}` : '');
}

function contractType(job) {
  if (job?.alternance === true || /apprentissage|alternance/i.test(String(job?.natureContrat || ''))) return 'Alternance';
  const raw = `${job?.typeContrat || ''} ${job?.typeContratLibelle || ''}`;
  if (/\bCDI\b/i.test(raw)) return 'CDI';
  if (/\bCDD\b/i.test(raw)) return 'CDD';
  if (/\bstage\b|intern/i.test(raw)) return 'Stage';
  return 'unknown';
}

function companyName(job) {
  return clean(job?.entreprise?.nom || job?.entreprise?.entrepriseAdaptee || 'Employeur non précisé', 300);
}

export async function searchFranceTravail(input, options = {}) {
  const clientId = options.clientId || process.env.JOBPILOT_FRANCE_TRAVAIL_CLIENT_ID || process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.JOBPILOT_FRANCE_TRAVAIL_CLIENT_SECRET || process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { id: 'france-travail', label: 'France Travail', status: 'unconfigured', latencyMs: 0, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: [] };
  const fetchImpl = options.fetchImpl || fetch;
  const started = Date.now();
  const token = await accessToken(clientId, clientSecret, fetchImpl);
  const queries = (input.franceTravailQueries?.length ? input.franceTravailQueries : input.queries).slice(0, 3);
  const responses = await Promise.allSettled(queries.map(async query => {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('motsCles', query);
    url.searchParams.set('range', '0-49');
    url.searchParams.set('sort', '1');
    if (input.contractTypes?.length) {
      const supported = input.contractTypes.filter(x => ['CDI', 'CDD'].includes(x));
      if (supported.length) url.searchParams.set('typeContrat', supported.join(','));
    }
    // France Travail's commune filter requires INSEE codes. Until the product owns a geocoder,
    // location remains a deterministic post-filter instead of guessing a code from a city name.
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000) });
    if (response.status === 204) return { resultats: [] };
    if (!response.ok && response.status !== 206) throw new Error(`France Travail HTTP ${response.status}`);
    return await response.json();
  }));
  const successful = responses.filter(result => result.status === 'fulfilled').map(result => result.value);
  const failures = responses.filter(result => result.status === 'rejected').map(result => result.reason instanceof Error ? result.reason.message : String(result.reason));
  if (!successful.length) throw new Error(failures[0] || 'France Travail returned no usable response.');
  const offers = successful.flatMap(json => Array.isArray(json?.resultats) ? json.resultats : []).flatMap(job => {
    const url = offerUrl(job);
    if (!/^https?:\/\//i.test(url) || !job?.intitule) return [];
    const postedAt = clean(job?.dateCreation, 100);
    return [{
      url,
      title: clean(job.intitule, 300),
      company: companyName(job),
      location: clean(job?.lieuTravail?.libelle || job?.lieuTravail?.commune, 300),
      country: 'France',
      source: 'france-travail',
      sourceLabel: job?.origineOffre?.origine === '2' ? 'France Travail · partenaire' : 'France Travail',
      direct: Boolean(job?.origineOffre?.urlOrigine),
      remote: /télétravail|teletravail|remote/i.test(`${job?.description || ''} ${job?.contexteTravail?.horaires || ''}`),
      postedAt: postedAt || null,
      postedHint: postedAt || '',
      contractType: contractType(job),
      description: clean(job?.description, 12000),
      providerJobId: clean(job?.id, 100),
      verification: 'unconfirmed',
    }];
  });
  return {
    id: 'france-travail', label: 'France Travail', status: failures.length ? 'partial' : 'ok', latencyMs: Date.now() - started,
    rawCount: offers.length, apiCalls: queries.length, estimatedCostUsd: 0, offers,
    failures: failures.slice(0, 3),
    countryCode: countryCode(input.country),
  };
}
