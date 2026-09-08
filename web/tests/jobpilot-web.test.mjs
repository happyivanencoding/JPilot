import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PHONE, TABS, ACTIVE, validScore, filteredJobs, centerTasks, parseRoute, routeUrl, destinationFor, safeExternalUrl, legacyDestination, desktopScale, pendingDisplay } from '../src/components/jobpilot/model.mjs';
import { dashboardFor } from '../src/lib/mobile-domain.mjs';

test('desktop reference matches the USB Android display; a wide screen never widens the app', () => {
  assert.deepEqual(PHONE, { width: 384, height: 832 });
  assert.equal(PHONE.width / PHONE.height, 1440 / 3120);
  assert.equal(desktopScale(1440, 1000), 1);
  assert.equal(desktopScale(1024, 768), 736 / 832);
  assert.deepEqual(TABS, ['home', 'offers', 'applications', 'prepare', 'profile']);
});
test('only recorded numeric compatibility scores are rendered', () => {
  for (const v of [null, undefined, '', '4.5', -1, 6, NaN, Infinity]) assert.equal(validScore(v), null);
  for (const v of [0, 3.8, 5]) assert.equal(validScore(v), v);
});
test('dashboard links and application filters use the exact mobile action sets', () => {
  const jobs = [{id:'a',company:'Example',role:'Analyst',score:4.8,status:'À candidater',reportNum:'1'}, {id:'b',company:'Sample',role:'Designer',score:3,status:'Entretien'}, {id:'c',company:'Example',role:'Intern',status:'À candidater'}, {id:'d',company:'Elsewhere',role:'Manager',score:4.9,status:'Archivée'}];
  const d = dashboardFor(jobs, '2026-09-08');
  for (const [key, ids] of Object.entries(d.actionSets)) assert.deepEqual(new Set(filteredJobs(jobs, d.actionSets, key).map(j=>j.id)), new Set(ids));
  assert.deepEqual(filteredJobs(jobs, d.actionSets, 'high', 'EXAMPLE').map(j=>j.id), ['a']);
  assert.deepEqual(filteredJobs(jobs, d.actionSets, '', 'intern').map(j=>j.id), ['c']);
  assert.deepEqual(filteredJobs(jobs, {high:['c']}, 'high').map(j=>j.id), ['c'], 'the server projection wins over client guesses');
});
test('all active tasks remain visible; history deduplicates by business identity', () => {
  const tasks = [{id:'a',kind:'analysis',status:'running'}, {id:'b',kind:'search',status:'reconciling'}, {id:'c',kind:'plan',status:'completed',jobId:'x',inputVersionId:'v1'}, {id:'d',kind:'plan',status:'completed',jobId:'x',inputVersionId:'v1'}, {id:'e',kind:'cv',status:'completed',jobId:'x'}, {id:'f',kind:'analysis',status:'failed'}, {id:'g',kind:'coach',status:'completed'}];
  assert.deepEqual(centerTasks(tasks).map(t=>t.id), ['a','b','c','e','f']);
  assert.equal(ACTIVE.has('queued'),true);
});
test('saved task results navigate to their product screen without re-running work', () => {
  for (const kind of ['analysis','search','evaluate','cv','rewrite','plan','practice','compare','coach','ingest']) {
    const route = destinationFor({ id:'t', status:'completed', kind, result:{draftId:'d'}, destination:{jobId:'j'} });
    assert.ok(route.tab || route.view);
    assert.equal(Object.hasOwn(route,'action'),false);
  }
  assert.deepEqual(destinationFor({id:'t',kind:'evaluate',status:'failed'}),{view:'task',task:'t'});
  assert.deepEqual(destinationFor({id:'t',kind:'plan',status:'completed',destination:{jobId:'j'}}),{tab:'prepare',view:'job',job:'j',jobTab:'2'});
});
test('deep links round trip; arbitrary overlay names are not enabled', () => {
  const r={tab:'applications',filter:'Réponse reçue',view:'job',job:'test-123',jobTab:'3'};
  assert.deepEqual(parseRoute(routeUrl(r).slice(1)),r);
  assert.equal(parseRoute('?view=legacy&tab=admin').view,undefined);
  assert.equal(parseRoute('?task=task-1').view,'task');
});
test('only HTTP(S) job sources are opened', () => {
  assert.equal(safeExternalUrl('https://example.test/job?id=1'),'https://example.test/job?id=1');
  for(const v of ['javascript:alert(1)','data:text/html,a','file:///private','not a URL','/relative'])assert.equal(safeExternalUrl(v),null);
});
test('old entry points only redirect into the single new product', () => {
  for(const name of ['analytics','apply','candidatures','config','cv','explore','followups','jobs','pipeline','portals']){
    const source=fs.readFileSync(new URL(`../src/app/${name}/page.tsx`,import.meta.url),'utf8');
    assert.match(source,/redirect\(legacyDestination/);
    assert.ok(legacyDestination('/'+name).startsWith('/'));
    assert.doesNotMatch(source,/return\s*</);
  }
  assert.equal(legacyDestination('/pipeline/123'),'/?tab=applications&view=job&job=123');
  const layout=fs.readFileSync(new URL('../src/app/layout.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(layout,/AppShell|instrumentSerif/);
  assert.match(layout,/title: "JobPilot"/);
});
test('direct browser CV and preference writes are explicitly profile-scoped', () => {
  for(const file of ['cv','profile']){
    const source=fs.readFileSync(new URL(`../src/app/api/${file}/route.ts`,import.meta.url),'utf8');
    assert.match(source,/activeProfileId\(new URL\(req.url\).searchParams.get\("profileId"\)\)/);
  }
});
test('translation polling stops on success or a failed display job', () => {
  assert.equal(pendingDisplay({localization:{pending:true}}),true);
  assert.equal(pendingDisplay({localization:{pending:true,failed:true}}),false);
  assert.equal(pendingDisplay({localization:{pending:false}}),false);
});
