import test from 'node:test';
import assert from 'node:assert/strict';
import {searchSmartRecruiters, normalizeSmartRecruitersPosting, smartRecruitersCompanies} from '../../src/lib/job-search/providers/smartrecruiters.mjs';

const posting = (extra = {}) => ({id: '123', name: 'Research analyst', company: {name: 'Employer'}, visibility: 'PUBLIC', active: true, location: {city: 'Paris', country: 'fr', fullLocation: 'Paris, France'}, postingUrl: 'https://jobs.smartrecruiters.com/Employer/123-role', applyUrl: 'https://jobs.smartrecruiters.com/Employer/123-role?oga=true', typeOfEmployment: {id: 'full_time', label: 'Full-time'}, jobAd: {sections: {jobDescription: {text: '<p>Analyse <b>data</b>.</p>'}}}, ...extra});

test('preserves canonical posting/apply URL and contract provenance without FULLTIME to CDI', () => {
  const value = normalizeSmartRecruitersPosting(posting(), 'Employer');
  assert.equal(value.contractType, 'unknown'); assert.equal(value.country, 'fr');
  assert.equal(value.url, posting().postingUrl); assert.equal(value.applyUrl, posting().applyUrl);
  assert.equal(value.provenance.typeOfEmployment.id, 'full_time');
  assert.equal(value.description, 'Analyse data.');
  assert.equal(normalizeSmartRecruitersPosting(posting({typeOfEmployment: {id: 'intern', label: 'Intern'}}), 'Employer').contractType, 'Stage');
  assert.equal(normalizeSmartRecruitersPosting(posting({name: 'Analyst CDI'}), 'Employer').contractType, 'CDI');
});

test('excludes non-public/inactive postings and unsafe URLs', () => {
  for (const extra of [{visibility: 'INTERNAL'}, {active: false}, {postingUrl: 'javascript:alert(1)'}]) assert.equal(normalizeSmartRecruitersPosting(posting(extra), 'Employer'), null);
  assert.deepEqual(smartRecruitersCompanies(['Employer', '../private', 'Employer']), ['Employer']);
});

test('uses documented public query parameters, deduplicates probes, fetches details at trusted endpoint', async () => {
  const calls = [];
  const result = await searchSmartRecruiters({queries: ['unfamiliar occupation'], franceTravailQueries: ['métier inconnu'], countryCode: 'fr'}, {companies: ['Employer'], fetchImpl: async (url, init) => {
    calls.push({url: new URL(url), init});
    return {ok: true, json: async () => url.includes('?') ? {totalFound: 1, content: [{id: '123', visibility: 'PUBLIC', ref: 'https://untrusted.invalid'}]} : posting()};
  }});
  assert.equal(result.offers.length, 1); assert.equal(result.apiCalls, 3); assert.equal(result.status, 'ok');
  for (const call of calls.slice(0, 2)) {
    assert.equal(call.url.searchParams.get('destination'), 'PUBLIC'); assert.equal(call.url.searchParams.get('country'), 'fr');
    assert.equal(call.init.method, 'GET'); assert.equal(call.init.headers.authorization, undefined);
  }
  assert.deepEqual(calls.slice(0, 2).map(call => call.url.searchParams.get('q')), ['métier inconnu', 'unfamiliar occupation']);
  assert.equal(calls[2].url.hostname, 'api.smartrecruiters.com');
});

test('provider errors remain visible and a disabled provider performs no requests', async () => {
  const options = {companies: ['Employer'], fetchImpl: async () => ({ok: false, status: 429})};
  const result = await searchSmartRecruiters({queries: ['research']}, options);
  assert.equal(result.status, 'error'); assert.equal(result.errors.length, 1);
  const disabled = await searchSmartRecruiters({}, {...options, enabled: false});
  assert.equal(disabled.status, 'disabled'); assert.equal(disabled.apiCalls, 0);
});
