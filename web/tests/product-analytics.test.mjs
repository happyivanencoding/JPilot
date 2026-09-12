import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authenticatedAnalyticsProfile,validateAnalyticsEvents,recordAnalytics,readProfileAnalytics,readAllAnalytics,analyticsReport,FUNNEL_STEPS,analyticsRetentionCutoff,pruneAnalytics,recordServerAiTask,recordCvDecision} from '../src/lib/product-analytics.mjs';
const now=Date.now();
const sessionId=randomUUID();
const event=(extra={})=>({id:randomUUID(),sessionId,event:'page_enter',page:'home',...extra});
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'jpilot-analytics-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
test('authentication derives only a valid session profile and rejects forged headers',t=>{
  const root=fixture(t), token='a'.repeat(43);
  fs.mkdirSync(path.join(root,'.career-ops-web','v1-sessions'),{recursive:true});
  fs.mkdirSync(path.join(root,'data'));
  fs.writeFileSync(path.join(root,'data','profiles.json'),JSON.stringify({profiles:[{id:'alice'}]}));
  fs.writeFileSync(path.join(root,'.career-ops-web','v1-sessions',token+'.json'),JSON.stringify({authVersion:2,profileId:'alice',expiresAt:now+100000}));
  assert.equal(authenticatedAnalyticsProfile(root,new Headers({authorization:'Bearer '+token,'x-jobpilot-profiles':'bob'})),'alice');
  assert.throws(()=>authenticatedAnalyticsProfile(root,new Headers({'x-jobpilot-profiles':'alice','x-jobpilot-role':'admin'})),e=>e.status===401);
  fs.unlinkSync(path.join(root,'.career-ops-web','v1-sessions',token+'.json'));
  assert.throws(()=>authenticatedAnalyticsProfile(root,new Headers({authorization:'Bearer '+token})),e=>e.status===401);
});
test('strict bounded schema rejects identifiers, text, URLs and invalid measures',()=>{
  for(const value of [event({email:'a@b.com'}),event({page:'../alice'}),event({page:'https://example.com'}),event({durationMs:-1}),event({scrollDepth:101}),event({timestamp:analyticsRetentionCutoff(now)-1}),event({event:'ai_wait'}),event({id:'bad'})])
    assert.throws(()=>validateAnalyticsEvents({events:[value]},now));
  assert.throws(()=>validateAnalyticsEvents({profileId:'other',events:[event()]},now));
  assert.throws(()=>validateAnalyticsEvents({events:Array.from({length:51},()=>event())},now));
});
test('profile isolation, idempotent batches and concurrent writes',async t=>{
  const root=fixture(t), first=event();
  assert.deepEqual(await recordAnalytics(root,'alice',{events:[first,first]},now),{accepted:1,duplicates:1});
  assert.deepEqual(await recordAnalytics(root,'alice',{events:[first]},now),{accepted:0,duplicates:1});
  await Promise.all([recordAnalytics(root,'alice',{events:[event()]},now),recordAnalytics(root,'alice',{events:[event()]},now)]);
  await recordAnalytics(root,'bob',{events:[first]},now);
  assert.equal(readProfileAnalytics(root,'alice',now).events.length,3);
  assert.equal(readProfileAnalytics(root,'bob',now).events.length,1);
  assert.equal(readProfileAnalytics(root,'absent',now).events.length,0);
  assert.notEqual(readProfileAnalytics(root,'alice',now).userId,readProfileAnalytics(root,'bob',now).userId);
  assert.equal(readAllAnalytics(root,now).length,2);
});
test('ordered funnel never invents skipped stages; measures exits, clicks, scroll and wait segments',()=>{
  const full=FUNNEL_STEPS.map((step,i)=>event({event:'funnel',step,timestamp:now+i}));
  const waits=[1000,3000,9000].map((durationMs,i)=>event({event:'ai_wait',kind:'search',status:i===2?'abandoned':'completed',durationMs,timestamp:now+20+i}));
  const partial=['login','view_jobs','upload_cv'].map((step,i)=>event({event:'funnel',step,timestamp:now+i}));
  const report=analyticsReport([{userId:'a',events:[...full,...waits,event({event:'click',action:'open_cv',timestamp:now+30}),event({event:'scroll',scrollDepth:75,timestamp:now+31}),event({event:'page_exit',step:'tracking',durationMs:45000,timestamp:now+32})]},{userId:'b',events:partial}],now);
  assert.deepEqual(report.funnel.map(row=>row.users),[2,2,1,1,1,1,1,1]);
  assert.equal(report.funnel[2].conversionFromPrevious,.5);
  assert.equal(report.funnel[1].droppedAfter,1);
  assert.equal(report.aiWaits.search.p50Ms,3000);
  assert.equal(report.aiWaits.search.p90Ms,9000);
  assert.equal(report.aiWaits.search.abandonedP50Ms,9000);
  assert.equal(report.aiWaits.cv.p50Ms,null);
  assert.equal(report.journeys[0].sessions[0].exitStep,'tracking');
  assert.equal(report.journeys[0].sessions[0].exitObserved,true);
  assert.equal(report.pages[0].maxScrollDepth,75);
  assert.equal(report.pages[0].visibleDurationMs,45000);
  assert.deepEqual(report.clicks,[{action:'open_cv',count:1}]);
});
test('exit observation follows page lifecycle even when an abandoned wait is sent afterward',()=>{
  const exit=event({event:'page_exit',durationMs:2000,timestamp:now});
  const abandoned=event({event:'ai_wait',kind:'search',status:'abandoned',durationMs:2000,timestamp:now+1});
  const report=events=>analyticsReport([{userId:'test',events}],now).journeys[0].sessions[0];
  assert.equal(report([exit,abandoned]).exitObserved,true);
  assert.equal(report([exit,abandoned,event({event:'page_enter',timestamp:now+2})]).exitObserved,false);
  assert.equal(report([exit,abandoned,event({event:'page_heartbeat',durationMs:1000,timestamp:now+2})]).exitObserved,false);
});
test('heartbeat accumulates incremental residence without exit and HTML report is readable',async t=>{
  const root=fixture(t);
  await recordAnalytics(root,'alice',{events:[event({event:'page_heartbeat',durationMs:15000,scrollDepth:40}),event({event:'funnel',step:'login'})]},now);
  const report=analyticsReport([readProfileAnalytics(root,'alice',now)],now);
  assert.equal(report.pages[0].visibleDurationMs,15000);
  assert.equal(report.pages[0].maxScrollDepth,40);
  assert.equal(report.journeys[0].sessions[0].exitObserved,false);
  const output=path.join(root,'report.html');
  const cli=fileURLToPath(new URL('../scripts/analytics-report.mjs',import.meta.url));
  const processResult=spawnSync(process.execPath,[cli,'--root',root,'--html',output],{encoding:'utf8'});
  assert.equal(processResult.status,0,processResult.stderr);
  const html=fs.readFileSync(output,'utf8');
  assert.match(html,/首次价值漏斗/);
  assert.match(html,/离开等待分布/);
  assert.match(html,/page_heartbeat/);
  assert.doesNotMatch(html,/<script/);
});
test('server task timing includes silent deep match and cannot be forged or collide with client events',async t=>{
  const root=fixture(t),id=randomUUID();
  const task={id,profileId:'alice',kind:'deep_match',status:'completed',createdAt:new Date(now-9000).toISOString(),input:{secret:'not-telemetry'}};
  await recordAnalytics(root,'alice',{events:[event({id})]},now);
  assert.deepEqual(await recordServerAiTask(root,task,now),{recorded:true});
  assert.deepEqual(await recordServerAiTask(root,task,now),{recorded:false});
  await recordServerAiTask(root,{...task,id:randomUUID(),kind:'search',status:'failed'},now);
  await recordServerAiTask(root,{...task,id:randomUUID(),kind:'cv_review'},now);
  await recordServerAiTask(root,{...task,id:randomUUID(),kind:'analysis'},now);
  assert.deepEqual(await recordServerAiTask(root,{...task,id:randomUUID(),kind:'ingest'},now),{recorded:false});
  assert.throws(()=>validateAnalyticsEvents({events:[event({event:'server_ai_task',kind:'evaluate',status:'completed',durationMs:1})]},now));
  assert.throws(()=>validateAnalyticsEvents({events:[event({source:'server'})]},now));
  const store=readProfileAnalytics(root,'alice',now),report=analyticsReport([store],now);
  assert.equal(store.events.length,5);
  assert.equal(report.serverAiTasks.evaluate.tasks,1);
  assert.equal(report.serverAiTasks.evaluate.p50Ms,9000);
  assert.equal(report.serverAiTasks.search.failed,1);
  assert.equal(report.serverAiTasks.cv.tasks,1);
  assert.equal(report.serverAiTasks.analysis.tasks,1);
  assert.equal(report.aiWaits.evaluate.segments,0);
  assert.equal(report.events,1);
  assert.equal(report.sessions,1);
  assert.equal(report.journeys[0].sessions[0].journey.length,1);
  assert.doesNotMatch(JSON.stringify(store),/not-telemetry/);
  const blocked=path.join(root,'file');fs.writeFileSync(blocked,'not a directory');
  assert.deepEqual(await recordServerAiTask(blocked,task,now),{recorded:false});
});
test('real CV generation terminal creates a separate completed or failed product outcome',async t=>{
  const root=fixture(t),completedId=randomUUID(),failedId=randomUUID();
  await recordServerAiTask(root,{id:completedId,profileId:'alice',kind:'cv',status:'completed',createdAt:new Date(now-5000).toISOString()},now);
  await recordServerAiTask(root,{id:failedId,profileId:'alice',kind:'cv',status:'failed',createdAt:new Date(now-4000).toISOString()},now);
  const events=readProfileAnalytics(root,'alice',now).events;
  assert.equal(events.filter(e=>e.event==='server_ai_task'&&e.taskKind==='cv').length,2);
  assert.equal(events.filter(e=>e.event==='cv_completed').length,1);
  assert.equal(events.filter(e=>e.event==='cv_failed').length,1);
  assert.equal(analyticsReport([{userId:'alice',events}],now).serverAiTasks.cv.tasks,2);
});
test('CV keep/reject decisions are semantic server events and rejection-reason coverage is measurable',async t=>{
  const root=fixture(t),accepted=randomUUID(),rejected=randomUUID(),rejectedWithout=randomUUID();
  assert.deepEqual(await recordCvDecision(root,'alice',accepted,'accept',false,now),{recorded:true});
  assert.deepEqual(await recordCvDecision(root,'alice',rejected,'reject',true,now),{recorded:true});
  assert.deepEqual(await recordCvDecision(root,'alice',rejectedWithout,'reject',false,now),{recorded:true});
  assert.deepEqual(await recordCvDecision(root,'alice',rejectedWithout,'reject',false,now),{recorded:false},'decision idempotency uses the draft id');
  const store=readProfileAnalytics(root,'alice',now),report=analyticsReport([store],now);
  assert.deepEqual(report.cvDecisions,{total:3,accepted:1,rejected:2,rejectedWithReason:1,rejectionReasonRate:.5});
  assert.equal(report.overview.cvAccepted,1);assert.equal(report.overview.cvRejected,2);
  assert.doesNotMatch(JSON.stringify(store),/why I rejected|reason text/i,'analytics stores only whether a reason was provided');
});
test('six-month retention preserves more than the old event cap and physically expires events',async t=>{
  const root=fixture(t);
  await recordAnalytics(root,'alice',{events:[event()]},now);
  const file=path.join(root,'.career-ops-web','analytics',createHash('sha256').update('alice').digest('hex'),'events.json');
  const store=JSON.parse(fs.readFileSync(file,'utf8'));
  store.events=[event({timestamp:analyticsRetentionCutoff(now)-1}),...Array.from({length:20001},()=>event({timestamp:now}))];
  fs.writeFileSync(file,JSON.stringify(store));
  await recordAnalytics(root,'alice',{events:[event()]},now);
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(saved.events.length,20002);
  assert.equal(saved.discarded,1);
  assert.ok(saved.events.every(e=>e.timestamp>=analyticsRetentionCutoff(now)));
  await pruneAnalytics(root,now,true);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).events.length,20002);
  await pruneAnalytics(root,now+367*86400000,true);
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).events.length,0);
});


test('calendar retention clamps month ends and includes the exact six-month boundary', () => {
  for (const [at, cutoff] of [
    ['2026-08-31T12:34:56.789Z', '2026-02-28T12:34:56.789Z'],
    ['2024-08-31T12:34:56.789Z', '2024-02-29T12:34:56.789Z'],
    ['2026-01-31T00:00:00.000Z', '2025-07-31T00:00:00.000Z'],
  ]) {
    const current=Date.parse(at), boundary=Date.parse(cutoff);
    assert.equal(analyticsRetentionCutoff(current), boundary);
    assert.equal(validateAnalyticsEvents({events:[event({timestamp:boundary})]}, current).length,1);
    assert.throws(()=>validateAnalyticsEvents({events:[event({timestamp:boundary-1})]}, current));
    const events=[event({timestamp:boundary-1}),event({timestamp:boundary}),
      {id:randomUUID(),event:'server_ai_task',source:'server',kind:'search',status:'completed',durationMs:1,timestamp:boundary}];
    const report=analyticsReport([{userId:'boundary',events}],current);
    assert.equal(report.retentionMonths,6);
    assert.equal(report.retentionCutoffAt,boundary);
    assert.equal(report.retentionTimeZone,'UTC');
    assert.equal(report.retentionDays,(current-boundary)/86400000);
    assert.equal(report.events,1);
    assert.equal(report.serverAiTasks.search.tasks,1);
  }
});


test('prune uses the report cutoff for client and server events at the calendar boundary', async t => {
  const root=fixture(t), current=Date.parse('2026-08-31T12:34:56.789Z');
  await recordAnalytics(root,'boundary',{events:[event()]},current);
  const file=path.join(root,'.career-ops-web','analytics',createHash('sha256').update('boundary').digest('hex'),'events.json');
  const store=JSON.parse(fs.readFileSync(file,'utf8'));
  const cutoff=analyticsReport([],current).retentionCutoffAt;
  store.events=[event({timestamp:cutoff-1}),event({timestamp:cutoff}),
    {id:randomUUID(),event:'cv_ready',source:'server',timestamp:cutoff-1},
    {id:randomUUID(),event:'cv_ready',source:'server',timestamp:cutoff}];
  fs.writeFileSync(file,JSON.stringify(store));
  assert.equal(readProfileAnalytics(root,'boundary',current).events.length,2);
  assert.equal(readAllAnalytics(root,current)[0].events.length,2);
  await pruneAnalytics(root,current,true);
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(saved.events.length,2);
  assert.ok(saved.events.every(e=>e.timestamp===cutoff));
  assert.equal(saved.discarded,2);
});
