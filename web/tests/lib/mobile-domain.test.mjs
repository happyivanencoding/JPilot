import test from 'node:test';
import assert from 'node:assert/strict';
import { stageOf, dashboardFor, parseDiscoveredOffers, parseCvProposal, normalizeOffer, applyJobUpdate, DISCOVERY_OFFER_LIMIT, topDiscoveryOffers } from '../../src/lib/mobile-domain.mjs';

test('French and canonical lifecycle states share dashboard stages', () => {
  assert.equal(stageOf('Candidature envoyée'), 'applied');
  assert.equal(stageOf('Interview'), 'interview');
  assert.equal(stageOf('Offre reçue'), 'offer');
  assert.equal(stageOf('CV prêt'), 'preparing');
});
test('response rate has a real denominator and zero-data remains unknown', () => {
  assert.equal(dashboardFor([]).responseRate, null);
  const d = dashboardFor([{status:'Applied'}, {status:'Réponse reçue'}, {status:'CV prêt'}]);
  assert.equal(d.total, 3); assert.equal(d.sent, 2); assert.equal(d.replied, 1); assert.equal(d.responseRate, 50);
});
test('daily discovery keeps only the top five offers in ranked order', () => {
  const offers = Array.from({length: DISCOVERY_OFFER_LIMIT + 2}, (_, index) => ({ url: `https://example.org/job/${index}`, rankScore: 100 - index }));
  const visible = topDiscoveryOffers(offers);
  assert.equal(visible.length, DISCOVERY_OFFER_LIMIT);
  assert.deepEqual(visible.map(offer => offer.url), offers.slice(0, DISCOVERY_OFFER_LIMIT).map(offer => offer.url));
  assert.notStrictEqual(visible, offers);
});
test('archiving does not erase recorded sent/reply history', () => {
  const d = dashboardFor([{status:'Archivée',statusHistory:[{status:'Applied'}],replies:[{at:'2026-01-01',text:'Reply'}]}]);
  assert.equal(d.sent,1); assert.equal(d.replied,1);
});
test('discovery strips invented scores, duplicates and unsafe URLs', () => {
  const offer = {url:'https://example.org/job/1',title:'Analyst',company:'Example',score:4.9};
  const text = `<<offer:${JSON.stringify(offer)}>>\n<<offer:${JSON.stringify(offer)}>>\n<<offer:{"url":"javascript:alert(1)","title":"x","company":"x"}>>`;
  const found = parseDiscoveredOffers(text);
  assert.equal(found.length,1); assert.equal(found[0].score, undefined); assert.equal(found[0].verification,'unconfirmed');
});
test('CV parse is preview-only and errors cannot look like success', () => {
  assert.equal(parseCvProposal('<<cv:start>>\n# Original CV\n<<cv:end>>'),'# Original CV');
  assert.throws(() => parseCvProposal('<<cv:error>>{"reason":"unreadable"}'));
});
test('saving an offer cannot add an arbitrary score', () => {
  const o = normalizeOffer({url:'https://example.org/job',company:'Example',title:'Analyst',score:5});
  assert.equal(o.score,undefined); assert.throws(() => normalizeOffer({url:'file:///private',company:'E',title:'A'}));
});
test('status updates and replies are timestamped, preserve all other evidence, and do not mutate input', () => {
  const original = {id:'a',status:'CV prêt',strengths:['Python'],followup:{note:'Old'},prepTasks:[{id:'one',done:false}]};
  const changed = applyJobUpdate(original,{status:'Candidature envoyée',reply:'Acknowledged',taskId:'one',taskDone:true},'2026-09-08T12:00:00Z');
  assert.equal(original.status,'CV prêt'); assert.deepEqual(changed.strengths,['Python']);
  assert.equal(changed.statusHistory[0].from,'CV prêt'); assert.equal(changed.replies[0].text,'Acknowledged');
  assert.equal(changed.prepTasks[0].done,true); assert.equal(changed.followup.note,'Old');
  assert.throws(() => applyJobUpdate(original,{status:'invented'}));
  assert.throws(() => applyJobUpdate(original,{dueDate:'tomorrow'}));
});
