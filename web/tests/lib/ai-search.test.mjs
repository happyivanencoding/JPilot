import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSearchPlan, classifySearchOffers, searchOffersPrompt, validateSearchPlan, validateSearchOfferClasses} from '../../src/lib/job-search/ai-search.mjs';
import {buildProviderInput, rankSearchResults} from '../../src/lib/job-search/index.mjs';

test('unknown multilingual occupations reach planning without a hardcoded role gate', async () => {
  const request = {query: '生态声学研究员 / bioacoustique', targetRoles: ['sales'], hasExplicitIntent: true};
  const expected = {queries: ['bioacoustics researcher'], franceTravailQueries: ['chercheur en bioacoustique']};
  assert.deepEqual(await prepareSearchPlan(request, async prompt => {
    assert.ok(prompt.includes(request.query));
    assert.match(prompt, /targetRoles must not broaden it/);
    return expected;
  }), expected);
});

test('classification preserves exact indices and maps multilingual direct and evidenced adjacent jobs', async () => {
  const offers = [{title: 'Chercheur en bioacoustique'}, {title: 'Acoustic ecologist'}, {title: 'Commercial'}];
  const result = await classifySearchOffers({query: '生态声学研究员'}, offers, async () => ({offers: [
    {id: 2, tier: 'unrelated', reason: 'Sales duties'},
    {id: 0, tier: 'direct', reason: 'Bioacoustics research'},
    {id: 1, tier: 'adjacent', reason: 'Ecological acoustics duties'},
  ]}));
  assert.equal(result.get(0).tier, 'strong'); assert.equal(result.get(1).tier, 'adjacent'); assert.equal(result.get(2).tier, 'none');
});

test('rejects malformed plans rather than silently accepting fabricated or empty output', () => {
  for (const value of [null, {}, {queries: [], franceTravailQueries: ['x']}, {queries: ['x'], franceTravailQueries: ['y'], url: 'invented'}, {queries: ['a','b','c','d'], franceTravailQueries: ['y']}, {queries: ['https://example.com'], franceTravailQueries: ['y']}]) assert.throws(() => validateSearchPlan(value));
});

test('classification rejects omissions, duplicate and invented IDs, invalid tiers and added URLs', () => {
  const valid = {id: 0, tier: 'direct', reason: 'Matching duties'};
  for (const rows of [[], [valid, valid], [{...valid, id: 1}], [{...valid, id: '0'}], [{...valid, tier: 'strong'}], [{...valid, url: 'https://invented'}], [{...valid, reason: ''}]]) assert.throws(() => validateSearchOfferClasses({offers: rows}, 1));
});

test('bounded input excludes URLs, caps descriptions, and handles zero without a model call', async () => {
  const prompt = searchOffersPrompt({query: 'test'}, [{title: 'Title', description: 'x'.repeat(1800), url: 'https://private.example'}]);
  assert.ok(!prompt.includes('https://private.example')); assert.ok(!prompt.includes('x'.repeat(1501)));
  assert.throws(() => searchOffersPrompt({}, Array(151).fill({})));
  assert.equal((await classifySearchOffers({}, [], () => {throw new Error('unexpected call');})).size, 0);
});

test('provider input uses exactly the AI market probes without legacy aliases or contract suffixes', () => {
  const aiPlan = {queries: ['credit underwriting analyst', 'commercial credit analyst'], franceTravailQueries: ['analyste engagements', 'analyste crédit']};
  const input = buildProviderInput({query: 'Analyste crédit Paris CDI', targetRoles: ['Marketing'], city: 'Paris', country: 'France', contractTypes: ['CDI'], strictContract: true, aiPlan});
  assert.deepEqual(input.queries, aiPlan.queries);
  assert.deepEqual(input.franceTravailQueries, aiPlan.franceTravailQueries);
  assert.deepEqual(input.contractTypes, ['CDI']);
  assert.equal(input.city, 'Paris');
});

test('ranker accepts AI direct relevance for an unfamiliar multilingual occupation', () => {
  const request = {query: '生态声学研究员', city: 'Paris', country: 'France', contractTypes: ['CDI'], strictContract: true};
  const offer = {url: 'https://example.invalid/acoustics', title: 'Chargé de recherche en acoustique écologique', company: 'Lab', location: 'Paris, France', contractType: 'CDI', description: 'Analyse des paysages sonores des écosystèmes.'};
  assert.equal(rankSearchResults(request, [offer]).offers.length, 0, 'legacy matching does not understand the requested occupation');
  const result = rankSearchResults(request, [offer], [], {semanticRelevance: new Map([[offer.url, {tier: 'strong', reason: 'Same research discipline'}]])});
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].url, offer.url);
  assert.equal(result.offers[0].relevanceTier, 'strong');
});

test('AI unrelated decision cannot be restored by the old role vocabulary or closest fallback', () => {
  const request = {query: 'Quantitative analyst', fallbackPolicy: 'closest'};
  const offer = {url: 'https://example.invalid/quant', title: 'Quantitative analyst', company: 'Employer', description: 'Systematic research and risk models.', location: 'Paris, France'};
  assert.equal(rankSearchResults(request, [offer]).offers.length, 1);
  const result = rankSearchResults(request, [offer], [], {semanticRelevance: new Map([[offer.url, {tier: 'none', reason: 'Details do not support the requested duties'}]])});
  assert.equal(result.offers.length, 0);
  assert.equal(result.metrics.relevanceRemoved, 1);
});

test('AI direct decisions still obey explicit city and contract boundaries', () => {
  const request = {query: '生态声学研究员', city: 'Paris', country: 'France', searchArea: {scope: 'city', city: 'Paris'}, contractTypes: ['CDI'], strictContract: true};
  const offers = [
    {url: 'https://example.invalid/valid', title: 'Bioacoustics researcher', company: 'Lab A', location: 'Paris, France', contractType: 'CDI'},
    {url: 'https://example.invalid/lyon', title: 'Bioacoustics researcher', company: 'Lab B', location: 'Lyon, France', contractType: 'CDI'},
    {url: 'https://example.invalid/stage', title: 'Bioacoustics researcher', company: 'Lab C', location: 'Paris, France', contractType: 'Stage'},
  ];
  const semanticRelevance = new Map(offers.map(offer => [offer.url, {tier: 'strong', reason: 'Same occupation'}]));
  const result = rankSearchResults(request, offers, [], {semanticRelevance});
  assert.deepEqual(result.offers.map(offer => offer.url), [offers[0].url]);
  assert.equal(result.metrics.locationRemoved, 1);
  assert.equal(result.metrics.contractRemoved, 1);
});
