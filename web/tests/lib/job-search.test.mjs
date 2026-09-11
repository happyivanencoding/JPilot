import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderInput, rankSearchResults, searchStructuredOffers } from '../../src/lib/job-search/index.mjs';
import { bilingualRoleQueries } from '../../src/lib/job-search/role-vocabulary.mjs';
import { searchRequestFromConfig } from '../../src/lib/job-search/mobile-context.mjs';
import { normalizeOffer } from '../../src/lib/mobile-domain.mjs';
import { contractMatches, operationKey } from '../../src/lib/mobile-state.mjs';

const NOW = Date.parse('2026-09-08T08:00:00+02:00');

function response(json, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => json };
}

test('generic mobile search derives provider queries from profile targets without sending CV content', () => {
  const request = searchRequestFromConfig(
    'Selon mon CV, trouver des postes ouverts à Paris ou en télétravail depuis la France.',
    {
      candidate: { location: 'Paris, France' },
      target_roles: {
        primary: ['Quantitative Researcher', 'Quantitative Portfolio Manager'],
        archetypes: [{ name: 'Applied AI / AI Product Systems' }],
        contract_types: ['CDI'], remote: 'hybrid',
      },
    },
    ['https://example.com/already-known'],
  );
  const input = buildProviderInput(request);
  assert.deepEqual(input.queries, ['Quantitative Researcher', 'Quantitative Portfolio Manager', 'Applied AI / AI Product Systems']);
  assert.equal(input.city, 'Paris');
  assert.equal(input.country, 'France');
  assert.equal(input.remoteRequested, true);
  assert.deepEqual(input.contractTypes, ['CDI']);
  assert.equal(JSON.stringify(input).includes('CV secret body'), false);
});

test('flexible Europe search spends one existing JSearch probe on Europe instead of hard-locking all calls to France', async () => {
  const urls = [];
  const fetchImpl = async (url) => { urls.push(String(url)); return response({ data: { jobs: [] } }); };
  await searchStructuredOffers({
    query: '', targetRoles: ['Junior Brand Manager','Junior CRM Analyst','International Marketing Coordinator'],
    city: 'Paris', country: 'France', contractTypes: ['CDI'], flexibleEurope: true, fallbackPolicy: 'closest', knownUrls: [],
  }, { jsearch: { apiKey: 'test', fetchImpl }, now: NOW });
  const jsearchUrls = urls.filter(url => url.includes('jsearch'));
  assert.equal(jsearchUrls.length, 3);
  assert.equal(new URL(jsearchUrls[0]).searchParams.get('country'), 'fr');
  assert.equal(new URL(jsearchUrls[1]).searchParams.get('country'), 'fr');
  assert.equal(new URL(jsearchUrls[2]).searchParams.has('country'), false);
  assert.match(new URL(jsearchUrls[2]).searchParams.get('query'), /Europe/);
});

test('France Travail query probes translate a sparse French quant request into local market vocabulary', () => {
  const input = buildProviderInput({
    query: 'Trouver des postes CDI de recherche quantitative fixed income et risque de marché à Paris.',
    targetRoles: ['Quantitative Researcher'], city: 'Paris', country: 'France',
  });
  assert.deepEqual(input.franceTravailQueries, ['quant', 'risque de marché', 'obligataire']);
});

test('explicit Chinese quant search is canonicalized and overrides unrelated profile directions', () => {
  assert.deepEqual(bilingualRoleQueries('量化分析师'), [
    'quantitative analyst', 'quantitative researcher', 'analyste quantitatif', 'quant analyst', 'recherche quantitative',
  ]);
  const request = searchRequestFromConfig('量化分析师', {
    candidate: { location: 'Paris, France' },
    target_roles: {
      primary: ['Junior Brand Manager', 'Recruitment'],
      fallback_policy: 'closest',
    },
  });
  const input = buildProviderInput(request);
  assert.equal(input.hasExplicitIntent, true);
  assert.deepEqual(input.queries, ['quantitative analyst', 'quantitative researcher', 'analyste quantitatif']);
  assert.deepEqual(input.franceTravailQueries, ['quant', 'analyste quantitatif', 'recherche quantitative']);
  assert.ok(input.targetRoles.includes('量化分析师'));
  assert.ok(input.targetRoles.includes('quantitative analyst'));
  assert.equal(input.targetRoles.some(role => /marketing|recruit/i.test(role)), false);
});

test('explicit quant search rejects unrelated closest fallbacks instead of filling the list', () => {
  const request = {
    query: '量化分析师', targetRoles: ['Junior Brand Manager', 'Recruitment'], city: 'Paris', country: 'France',
    contractTypes: [], fallbackPolicy: 'closest', knownUrls: [],
  };
  const rows = [
    { url:'https://example.invalid/quant-risk', company:'Target A', title:'Quantitative Risk Analyst', location:'Paris, France', contractType:'CDI', description:'Market risk models and quantitative analytics.' },
    { url:'https://example.invalid/quant-research', company:'Target B', title:'Quantitative Researcher', location:'Paris, France', contractType:'CDI', description:'Systematic research and portfolio models.' },
    { url:'https://example.invalid/data', company:'Noise A', title:'Data Analyst', location:'Paris, France', contractType:'Stage', description:'Business reporting and dashboards.' },
    { url:'https://example.invalid/marketing', company:'Noise B', title:'Chargé de Marketing Stratégique Mobilité', location:'Paris, France', contractType:'Stage', description:'Marketing campaigns.' },
    { url:'https://example.invalid/recruitment', company:'Noise C', title:'Stage Chargé de Recrutement', location:'Paris, France', contractType:'Stage', description:'Recruitment support.' },
  ];
  const result = rankSearchResults(request, rows, [], { now: NOW });
  assert.deepEqual(new Set(result.offers.map(offer => offer.url)), new Set([rows[0].url, rows[1].url]));
  assert.ok(result.offers.every(offer => offer.relevanceTier === 'strong'));
  const noQuant = rankSearchResults(request, rows.slice(2), [], { now: NOW });
  assert.equal(noQuant.offers.length, 0);
  assert.equal(noQuant.metrics.closestCount, 0);
});

test('flexible junior-marketing search broadens provider recall according to each contract without changing the target contract', () => {
  const expected = {
    CDI: { query: 'junior marketing', ft: 'marketing' },
    CDD: { query: 'fixed term marketing', ft: 'marketing' },
    Stage: { query: 'internship marketing', ft: 'stage marketing' },
    Alternance: { query: 'alternance apprenticeship marketing', ft: 'alternance marketing' },
  };
  for (const [contract, values] of Object.entries(expected)) {
    const input = buildProviderInput({
      query: '', targetRoles: ['Junior Brand Manager','Junior CRM Analyst'], city: 'Paris', country: 'France',
      contractTypes: [contract], strictContract: false, fallbackPolicy: 'closest', seniority: 'junior',
    });
    assert.equal(input.contractTypes[0], contract);
    assert.equal(input.queries[1], values.query);
    assert.equal(input.franceTravailQueries[0], values.ft);
    assert.equal(input.franceTravailQueries.includes('risque de marché'), false);
    assert.match(input.queries[2], /business/);
  }
});

test('structured search deduplicates, rejects known URLs and confirmed contract mismatches, and keeps search relevance distinct from fit', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return response({ data: { jobs: [
      {
        job_id: 'quant-1', job_title: 'Fixed Income Quantitative Analyst', employer_name: 'Alpha AM',
        job_location: 'Paris, France', job_description: 'Fixed income portfolio research and market risk modelling.',
        job_posted_at: '1 day ago', job_posted_at_datetime_utc: '2026-09-07T06:00:00.000Z',
        job_apply_link: 'https://alpha.example/jobs/quant?utm_source=google', job_apply_is_direct: true,
        job_employment_types: ['FULLTIME'],
      },
      {
        job_id: 'quant-1-duplicate', job_title: 'Fixed Income Quantitative Analyst', employer_name: 'Alpha AM',
        job_location: 'Paris, France', job_description: 'Duplicate listing.',
        job_posted_at_datetime_utc: '2026-09-07T06:00:00.000Z',
        job_apply_link: 'https://alpha.example/jobs/quant?utm_source=another', job_apply_is_direct: true,
        job_employment_types: ['FULLTIME'],
      },
      {
        job_id: 'intern-1', job_title: 'Quantitative Research Intern', employer_name: 'Beta',
        job_location: 'Paris, France', job_description: 'Quant internship.',
        job_posted_at_datetime_utc: '2026-09-08T05:00:00.000Z', job_apply_link: 'https://beta.example/intern',
        job_employment_types: ['INTERN'],
      },
      {
        job_id: 'sales-1', job_title: 'Account Executive', employer_name: 'Gamma',
        job_location: 'Paris, France', job_description: 'Works with financial portfolios and risk teams.',
        job_posted_at_datetime_utc: '2026-09-08T05:00:00.000Z', job_apply_link: 'https://gamma.example/sales',
        job_employment_types: ['FULLTIME'],
      },
    ] } });
  };
  const result = await searchStructuredOffers({
    query: 'fixed income quantitative risk Paris CDI',
    targetRoles: ['Fixed Income Quantitative Analyst'], city: 'Paris', country: 'France', contractTypes: ['CDI'], knownUrls: [],
  }, { jsearch: { apiKey: 'test', fetchImpl }, now: NOW, limit: 20 });
  assert.equal(calls, 2); // explicit query + one distinct profile role
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].title, 'Fixed Income Quantitative Analyst');
  assert.equal(result.offers[0].source, 'jsearch');
  assert.equal(result.offers[0].ageDays, 1);
  assert.ok(result.offers[0].searchRelevance >= 70);
  assert.equal('score' in result.offers[0], false);
  assert.ok(result.metrics.rawCount > result.metrics.returnedCount);
  assert.ok(result.metrics.contractRemoved >= 1);
  assert.ok(result.metrics.duplicateRate > 0);
});

test('known URL removal happens before results reach mobile discovery', async () => {
  const fetchImpl = async () => response({ data: [{
    job_id: 'known', job_title: 'Quantitative Researcher', employer_name: 'Known AM', job_location: 'Paris, France',
    job_posted_at_datetime_utc: '2026-09-08T04:00:00.000Z', job_apply_link: 'https://known.example/job/1?utm_campaign=x',
    job_employment_types: ['FULLTIME'],
  }] });
  const result = await searchStructuredOffers({
    query: 'quantitative researcher Paris', targetRoles: ['Quantitative Researcher'], city: 'Paris', country: 'France',
    knownUrls: ['https://known.example/job/1'], contractTypes: [],
  }, { jsearch: { apiKey: 'test', fetchImpl }, now: NOW });
  assert.equal(result.offers.length, 0);
  assert.ok(result.metrics.knownRemoved >= 1);
});

test('one slow JSearch query does not discard another successful v2 response', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 2) throw new Error('simulated timeout');
    return response({ data: { jobs: [{
      job_id: 'partial', job_title: 'Quantitative Researcher', employer_name: 'Example AM',
      job_location: 'Paris, France', job_posted_at_datetime_utc: '2026-09-08T04:00:00.000Z',
      job_apply_link: 'https://example.com/quant', job_employment_types: ['FULLTIME'],
    }] } });
  };
  const result = await searchStructuredOffers({
    query: 'quantitative researcher Paris', targetRoles: ['Quantitative Researcher'], city: 'Paris', country: 'France',
    contractTypes: [], knownUrls: [],
  }, { jsearch: { apiKey: 'test', fetchImpl }, now: NOW });
  const run = result.metrics.providers.find(provider => provider.id === 'jsearch');
  assert.equal(calls, 2);
  assert.equal(run.status, 'partial');
  assert.equal(result.productionProviderSucceeded, true);
  assert.equal(result.offers.length, 1);
});

test('weak domain or geography signals may survive as fallback but never masquerade as a strong Paris market-risk match', async () => {
  const fetchImpl = async () => response({ data: [
    {
      job_id: 'property-risk', job_title: 'Risk Consultant - Property', employer_name: 'Insurance Co',
      job_location: 'Paris, France', job_description: 'Property prevention and engineering risk inspections.',
      job_posted_at_datetime_utc: '2026-09-08T04:00:00.000Z', job_apply_link: 'https://insurance.example/property-risk',
      job_employment_types: ['FULLTIME'],
    },
    {
      job_id: 'portfolio-unknown-place', job_title: 'Portfolio Solutions Team Lead', employer_name: 'Insurance Co',
      job_location: '', job_description: 'Insurance portfolio solutions and bordereaux.',
      job_posted_at_datetime_utc: '2026-09-08T04:00:00.000Z', job_apply_link: 'https://insurance.example/portfolio',
      job_employment_types: ['FULLTIME'],
    },
  ] });
  const result = await searchStructuredOffers({
    query: 'fixed income quantitative portfolio market risk Paris CDI', targetRoles: ['Quantitative Portfolio Manager'],
    city: 'Paris', country: 'France', contractTypes: ['CDI'], knownUrls: [],
  }, { jsearch: { apiKey: 'test', fetchImpl }, now: NOW });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].title, 'Portfolio Solutions Team Lead');
  assert.notEqual(result.offers[0].relevanceTier, 'strong');
  assert.equal(result.offers[0].locationFit, 'unknown');
  assert.equal(result.metrics.strongCount, 0);
  assert.equal(result.metrics.locationRemoved, 0);
});

test('when exact quant roles are scarce, a genuinely adjacent portfolio role is kept and labelled instead of forcing zero results', async () => {
  const fetchImpl = async () => response({ data: [{
    job_id: 'adjacent-portfolio', job_title: 'Portfolio Solutions Team Lead', employer_name: 'Asset Co',
    job_location: '', job_description: 'Portfolio analytics and investment solutions for institutional clients.',
    job_posted_at_datetime_utc: '2026-09-07T04:00:00.000Z', job_apply_link: 'https://asset.example/portfolio-solutions',
    job_employment_types: ['FULLTIME'],
  }] });
  const result = await searchStructuredOffers({
    query: 'fixed income quantitative portfolio market risk Paris CDI', targetRoles: ['Quantitative Portfolio Manager'],
    city: 'Paris', country: 'France', contractTypes: ['CDI'], knownUrls: [],
  }, { jsearch: { apiKey: 'test', fetchImpl }, now: NOW });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].relevanceTier, 'adjacent');
  assert.match(result.offers[0].why, /adjacente/);
  assert.equal(result.metrics.adjacentCount, 1);
});

test('mobile offer normalization preserves provider provenance and does not turn null metrics into zero', () => {
  const offer = normalizeOffer({
    url: 'https://example.com/job', company: 'Example', title: 'Quant', source: 'france-travail', sourceLabel: 'France Travail',
    postedAt: '2026-09-08T05:00:00Z', direct: true, ageDays: null, searchRelevance: null, dataQuality: null,
    country: 'France', relevanceTier: 'closest', contractType: 'Alternance', contractOptions: ['Stage','Alternance'],
  });
  assert.equal(offer.source, 'france-travail');
  assert.equal(offer.country, 'France');
  assert.equal(offer.direct, true);
  assert.equal(offer.ageDays, null);
  assert.equal(offer.searchRelevance, null);
  assert.equal(offer.dataQuality, null);
  assert.equal(offer.relevanceTier, 'closest');
  assert.deepEqual(offer.contractOptions, ['Stage','Alternance']);
});

test('unknown provider contract still lets a Stage title be rejected against CDI', () => {
  const check = contractMatches({ title: 'Quantitative Research Internship', contractType: 'unknown' }, ['CDI']);
  assert.equal(check.type, 'Stage');
  assert.equal(check.matches, false);
});

for (const desired of ['CDI', 'CDD', 'Stage', 'Alternance']) {
  test(`${desired}: confirmed match stays, confirmed and unknown mismatches are removed under confirmed-only policy`, () => {
    const other = ({ CDI: 'CDD', CDD: 'Stage', Stage: 'Alternance', Alternance: 'CDI' })[desired];
    const request = {
      query: '', targetRoles: ['Junior Brand Manager', 'Junior CRM Analyst'], city: 'Paris', country: 'France',
      contractTypes: [desired], strictContract: true, seniority: 'junior', languages: { french: 'B1', english: 'C1' },
    };
    const rows = [
      { url: `https://example.invalid/${desired}/match`, company: `Match ${desired}`, title: 'Junior Brand Manager', location: 'Paris', contractType: desired, description: 'International team, English working language.' },
      { url: `https://example.invalid/${desired}/wrong`, company: `Wrong ${desired}`, title: 'Junior Brand Manager', location: 'Paris', contractType: other, description: 'International team.' },
      { url: `https://example.invalid/${desired}/unknown`, company: `Unknown ${desired}`, title: 'Junior CRM Analyst', location: 'Paris', contractType: 'unknown', description: 'International team, contract duration not stated.' },
    ];
    const result = rankSearchResults(request, rows, [], { now: NOW });
    assert.deepEqual(new Set(result.offers.map(offer => offer.url)), new Set([rows[0].url]));
    assert.equal(result.offers.find(offer => offer.url === rows[0].url).contractType, desired);
    assert.equal(result.offers.find(offer => offer.url === rows[2].url), undefined);
    assert.equal(result.metrics.contractRemoved, 1);
    assert.equal(result.metrics.contractUnknownRetained, 0);
    assert.equal(result.metrics.contractUnknownRemoved, 1);
  });
}

for (const desired of ['Stage','Alternance']) {
  test(`mixed Stage/Alternance posting is valid when searching ${desired}`, () => {
    const row = {
      url: `https://example.invalid/mixed/${desired}`, company: 'Mixed Contract', title: 'Stage/Alternance Business Analyst Junior',
      location: 'Paris', contractType: 'unknown', description: "Stage de 6 mois ou contrat d'apprentissage. Business analysis and project support.",
    };
    const result = rankSearchResults({
      query: '', targetRoles: ['Business Analyst Junior'], city: 'Paris', country: 'France', contractTypes: [desired], strictContract: true,
      seniority: 'junior', languages: { french: 'B1', english: 'C1' },
    }, [row], [], { now: NOW });
    assert.equal(result.offers.length, 1);
    assert.equal(result.offers[0].contractType, desired);
    assert.deepEqual(new Set(result.offers[0].contractOptions), new Set(['Stage','Alternance']));
    assert.match(result.offers[0].why, /(Stage.*Alternance|Alternance.*Stage)/);
  });
}

test('authoritative declared contract is not polluted by generic internship/apprenticeship experience mentioned in the description', () => {
  const row = {
    url: 'https://example.invalid/declared/cdi', company: 'Declared Contract', title: 'Chargé CRM Junior',
    location: 'Paris', contractType: 'CDI', description: "Une première expérience en alternance ou en stage est appréciée. Le poste proposé est un CDI.",
  };
  const result = rankSearchResults({
    query: '', targetRoles: ['Junior CRM Analyst'], city: 'Paris', country: 'France', contractTypes: ['CDI'], strictContract: true,
    seniority: 'junior', languages: { french: 'B1', english: 'C1' },
  }, [row], [], { now: NOW });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].contractType, 'CDI');
  assert.deepEqual(result.offers[0].contractOptions, ['CDI']);
});

test('French chef de rayon produits does not masquerade as chef de produit marketing', () => {
  const rows = [
    { url:'https://example.invalid/product-manager', company:'Target', title:'Assistant chef de produit', location:'Paris', contractType:'CDI', description:'Marketing produit.' },
    { url:'https://example.invalid/rayon', company:'Retail', title:'Chef de rayon produits alimentaires', location:'Paris', contractType:'CDI', description:'Management de rayon et approvisionnement.' },
  ];
  const result = rankSearchResults({
    query:'', targetRoles:['Junior Product Marketing','Junior Brand Manager'], city:'Paris', country:'France', contractTypes:['CDI'], strictContract:true, fallbackPolicy:'closest', seniority:'junior',
  }, rows, [], { now: NOW });
  assert.equal(result.offers[0].url, rows[0].url);
  assert.equal(result.offers[0].relevanceTier, 'strong');
  assert.equal(result.offers.some(offer=>offer.url===rows[1].url), false);
});

test('closest fallback returns a small off-target business set only when no strong or adjacent role survives', () => {
  const request = {
    query: '', targetRoles: ['Junior Brand Manager', 'Junior CRM Analyst'], city: 'Paris', country: 'France',
    contractTypes: ['CDI'], strictContract: true, fallbackPolicy: 'closest', fallbackLimit: 5,
    seniority: 'junior', languages: { french: 'B1', english: 'C1' },
  };
  const rows = [
    { url: 'https://example.invalid/closest/sales', company: 'Fallback A', title: 'Junior Account Executive', location: 'Paris', contractType: 'CDI', description: 'Customer accounts.' },
    { url: 'https://example.invalid/closest/hr', company: 'Fallback B', title: 'HR Assistant', location: 'Paris', contractType: 'CDI', description: 'Recruiting support.' },
    { url: 'https://example.invalid/closest/senior', company: 'Fallback C', title: 'Senior Account Director', location: 'Paris', contractType: 'CDI', description: '5 years of experience.' },
    { url: 'https://example.invalid/closest/confirmed', company: 'Fallback D', title: 'Business Analyst Confirmé', location: 'Paris', contractType: 'CDI', description: 'Business transformation.' },
    { url: 'https://example.invalid/closest/responsable', company: 'Fallback E', title: 'Responsable Marketing', location: 'Paris', contractType: 'CDI', description: 'Local marketing ownership.' },
  ];
  const fallback = rankSearchResults(request, rows, [], { now: NOW });
  assert.equal(fallback.offers.length, 5);
  assert.ok(fallback.offers.every(offer => offer.relevanceTier === 'closest'));
  assert.ok(fallback.offers.some(offer => offer.title === 'Junior Account Executive'));
  const seniorFallback = fallback.offers.find(offer => offer.title === 'Responsable Marketing');
  assert.equal(seniorFallback.seniorityFit, 'above-target');
  assert.match(seniorFallback.why, /Séniorité probablement au-dessus/);
  assert.equal(fallback.metrics.closestCount, 5);
  assert.ok(fallback.metrics.seniorityDemoted >= 2);
  assert.match(fallback.offers[0].why, /option disponible hors cible/i);

  const withAdjacent = rankSearchResults(request, [
    ...rows,
    { url: 'https://example.invalid/closest/communication', company: 'Adjacent', title: 'Communication Assistant', location: 'Paris', contractType: 'CDI', description: 'Campaign and content coordination.' },
  ], [], { now: NOW });
  assert.ok(withAdjacent.offers.some(offer => offer.relevanceTier === 'adjacent'));
  assert.equal(withAdjacent.offers.some(offer => offer.relevanceTier === 'closest'), false);
});

test('seniority, language, role family and location are soft risks: a confirmed-contract role survives as labelled closest when nothing better exists', () => {
  const row = {
    url: 'https://example.invalid/soft-risks', company: 'Fallback Employer', title: 'Responsable Commercial',
    location: 'Lyon, France', contractType: 'CDI', description: 'Fluent French required. 5 years of experience. Client acquisition and account development.',
  };
  const result = rankSearchResults({
    query: '', targetRoles: ['Junior Brand Manager','Junior CRM Analyst'], city: 'Paris', country: 'France',
    contractTypes: ['CDI'], strictContract: true, fallbackPolicy: 'closest', fallbackLimit: 6,
    seniority: 'junior', languages: { french: 'B1', english: 'C1' }, relocation: false,
  }, [row], [], { now: NOW });
  assert.equal(result.offers.length, 1);
  const offer = result.offers[0];
  assert.equal(offer.contractType, 'CDI');
  assert.equal(offer.relevanceTier, 'closest');
  assert.equal(offer.seniorityFit, 'above-target');
  assert.equal(offer.roleFit, 'outside-primary');
  assert.equal(offer.locationFit, 'same-country');
  assert.equal(offer.languageFit, 'french-development-needed');
  assert.match(offer.why, /Séniorité probablement au-dessus/);
  assert.match(offer.why, /hors cible marketing principale/);
  assert.match(offer.why, /Hors Paris, mais dans le pays cible/);
  assert.equal(result.metrics.contractRemoved, 0);
});

test('explicit 2-4 years of experience is a soft seniority risk, while a two-year contract duration is not', () => {
  const rows = [
    { url:'https://example.invalid/experience', company:'Experience', title:'Chargé Marketing Digital', location:'Paris', contractType:'CDI', description:'Expérience significative (2 à 4 ans minimum) sur un poste similaire.' },
    { url:'https://example.invalid/duration', company:'Duration', title:'Assistant Marketing', location:'Paris', contractType:'Alternance', description:'Contrat en alternance de 2 ans. Première expérience bienvenue.' },
  ];
  const cdi = rankSearchResults({query:'',targetRoles:['Digital Marketing Junior'],city:'Paris',country:'France',contractTypes:['CDI'],strictContract:true,fallbackPolicy:'closest',seniority:'junior'},[rows[0]],[],{now:NOW});
  assert.equal(cdi.offers[0].seniorityFit,'above-target');
  assert.equal(cdi.offers[0].relevanceTier,'closest');
  const alternance = rankSearchResults({query:'',targetRoles:['Digital Marketing Junior'],city:'Paris',country:'France',contractTypes:['Alternance'],strictContract:true,fallbackPolicy:'closest',seniority:'junior'},[rows[1]],[],{now:NOW});
  assert.equal(alternance.offers[0].seniorityFit,'target-or-unknown');
});

test('remote job in another declared country is kept only as a location-risk fallback, not treated as France-compatible remote', () => {
  const row = {
    url: 'https://example.invalid/us-remote', company: 'Remote Employer', title: 'Junior Marketing Coordinator',
    location: 'Anywhere, NY', country: 'United States', remote: true, contractType: 'CDI', description: 'Remote marketing coordination.',
  };
  const result = rankSearchResults({
    query: '', targetRoles: ['Junior Marketing Coordinator'], city: 'Paris', country: 'France',
    contractTypes: ['CDI'], strictContract: true, fallbackPolicy: 'closest', seniority: 'junior', remote: true,
  }, [row], [], { now: NOW });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].relevanceTier, 'closest');
  assert.equal(result.offers[0].locationFit, 'outside-europe');
  assert.match(result.offers[0].why, /Hors Europe/);
});

test('visible US-state location overrides contradictory provider country metadata and remains only a location-risk fallback', () => {
  const row = {
    url: 'https://example.invalid/conflicting-country', company: 'Provider Conflict', title: 'Marketing Intern',
    location: 'Anywhere, GA', country: 'FR', remote: true, contractType: 'Stage', description: 'Remote marketing internship.',
  };
  const result = rankSearchResults({
    query: '', targetRoles: ['Marketing Intern'], city: 'Paris', country: 'France', contractTypes: ['Stage'],
    strictContract: true, fallbackPolicy: 'closest', seniority: 'junior', remote: true,
  }, [row], [], { now: NOW });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].relevanceTier, 'closest');
  assert.equal(result.offers[0].locationFit, 'outside-europe');
});

test('visible USA title overrides contradictory provider country metadata', () => {
  const row = {
    url: 'https://example.invalid/conflicting-usa-title', company: 'Provider Conflict', title: 'Performance Marketing Specialist (Remote - USA)',
    location: 'Anywhere', country: 'FR', remote: true, contractType: 'CDD', description: 'Remote marketing role.',
  };
  const result = rankSearchResults({
    query: '', targetRoles: ['Digital Marketing Junior'], city: 'Paris', country: 'France', contractTypes: ['CDD'],
    strictContract: true, fallbackPolicy: 'closest', seniority: 'junior', remote: true,
  }, [row], [], { now: NOW });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].relevanceTier, 'closest');
  assert.equal(result.offers[0].locationFit, 'outside-europe');
});

test('another European country stays in the normal ranked pool with a mobility note', () => {
  const row = {
    url: 'https://example.invalid/eu-remote', company: 'EU Employer', title: 'Junior Marketing Coordinator',
    location: 'Berlin, Germany', country: 'Germany', remote: true, contractType: 'CDI', description: 'International marketing coordination.',
  };
  const result = rankSearchResults({
    query: '', targetRoles: ['Junior Marketing Coordinator'], city: 'Paris', country: 'France',
    contractTypes: ['CDI'], strictContract: true, fallbackPolicy: 'closest', seniority: 'junior', remote: true,
  }, [row], [], { now: NOW });
  assert.equal(result.offers.length, 1);
  assert.notEqual(result.offers[0].relevanceTier, 'closest');
  assert.equal(result.offers[0].locationFit, 'europe-other');
  assert.match(result.offers[0].why, /Autre pays européen/);
});

test('V1 operation keys invalidate pre-contract analysis and pre-provider search results', () => {
  const searchKey = operationKey('search', { query: 'marketing Paris' }, { id: 'cv-v1' }, [], '2026-09-08');
  const v1SearchKey = operationKey('search', { query: '量化分析师', experience: 'v1' }, { id: 'cv-v1' }, [], '2026-09-08');
  const analysisKey = operationKey('analysis', {}, { id: 'cv-v1' }, [], '2026-09-08');
  assert.match(searchKey, /search-v6-live-providers/);
  assert.match(v1SearchKey, /search-v10-explicit-intent/);
  assert.match(analysisKey, /analysis-v2-v1-directions/);
  assert.notEqual(searchKey, JSON.stringify(['search', 'search-v5-soft-ranking', 'cv-v1', 'marketing Paris', '2026-09-08']));
  assert.notEqual(v1SearchKey, JSON.stringify(['search', 'search-v9-onward-area', 'cv-v1', '量化分析师', '2026-09-08']));
  assert.notEqual(analysisKey, JSON.stringify(['analysis', 'cv-v1']));
});
