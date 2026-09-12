import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {analyticsReport,validateAnalyticsEvents} from '../src/lib/product-analytics.mjs';

const session=()=>randomUUID();
const client=(timestamp,sessionId,extra={})=>({id:randomUUID(),sessionId,event:'page_enter',page:'home',timestamp,...extra});
const server=(timestamp,event,extra={})=>({id:randomUUID(),event,source:'server',timestamp,...extra});

function completeUser(base,sessionId,contextId) {
  return [
    client(base,sessionId,{event:'funnel',step:'login'}),
    server(base+60_000,'cv_ready'),
    client(base+120_000,sessionId,{event:'funnel',step:'view_jobs'}),
    client(base+180_000,sessionId,{event:'funnel',step:'open_job'}),
    client(base+181_000,sessionId,{event:'page_enter',page:'job_match',contextId}),
    client(base+190_000,sessionId,{event:'page_heartbeat',page:'job_match',contextId,durationMs:9000,scrollDepth:25}),
    client(base+240_000,sessionId,{event:'funnel',step:'generate_cv_started'}),
    server(base+300_000,'server_ai_task',{kind:'cv',taskKind:'cv',status:'completed',durationMs:60_000}),
    server(base+300_000,'cv_completed'),
  ];
}

test('V1 synthetic commercial-validation fixture covers funnel, analysis read, CV outcome and Paris D1',()=>{
  const now=Date.parse('2026-09-12T10:00:00Z');
  const day0Old=Date.parse('2026-09-09T08:00:00Z');
  const day0Recent=Date.parse('2026-09-11T08:00:00Z');
  const aSession=session(),bSession=session(),cSession=session(),dSession=session();
  const aReopen=session();
  const a=[...completeUser(day0Old,aSession,'a'.repeat(24)),
    client(day0Old+360_000,aReopen,{event:'page_enter',page:'job_match',contextId:'a'.repeat(24)}),
    client(day0Old+370_000,aReopen,{event:'page_exit',page:'job_match',contextId:'a'.repeat(24),durationMs:10_000,scrollDepth:75}),
    client(Date.parse('2026-09-10T09:00:00Z'),session(),{event:'page_enter',page:'home'})];
  const b=[
    client(day0Recent,bSession,{event:'funnel',step:'login'}),server(day0Recent+60_000,'cv_ready'),
    client(day0Recent+120_000,bSession,{event:'funnel',step:'view_jobs'}),client(day0Recent+180_000,bSession,{event:'funnel',step:'open_job'}),
    client(day0Recent+181_000,bSession,{event:'page_enter',page:'job_match',contextId:'b'.repeat(24)}),
    client(day0Recent+183_000,bSession,{event:'page_exit',page:'job_match',contextId:'b'.repeat(24),durationMs:2000,scrollDepth:10}),
  ];
  const c=[
    client(day0Old+10_000,cSession,{event:'funnel',step:'login'}),server(day0Old+70_000,'cv_ready'),
    client(day0Old+130_000,cSession,{event:'funnel',step:'view_jobs'}),client(day0Old+190_000,cSession,{event:'funnel',step:'open_job'}),
    client(day0Old+191_000,cSession,{event:'page_enter',page:'job_match',contextId:'c'.repeat(24)}),
    client(day0Old+203_000,cSession,{event:'page_heartbeat',page:'job_match',contextId:'c'.repeat(24),durationMs:12000,scrollDepth:25}),
    client(day0Old+250_000,cSession,{event:'funnel',step:'generate_cv_started'}),
    server(day0Old+310_000,'server_ai_task',{kind:'cv',taskKind:'cv',status:'failed',durationMs:60_000}),server(day0Old+310_000,'cv_failed'),
  ];
  const d=[
    client(day0Recent+20_000,dSession,{event:'funnel',step:'login'}),server(day0Recent+80_000,'cv_ready'),
    client(day0Recent+140_000,dSession,{event:'funnel',step:'view_jobs'}),client(day0Recent+200_000,dSession,{event:'funnel',step:'open_job'}),
    client(day0Recent+201_000,dSession,{event:'page_enter',page:'job_match',contextId:'d'.repeat(24)}),
    client(day0Recent+202_000,dSession,{event:'scroll',page:'job_match',contextId:'d'.repeat(24),scrollDepth:75}),
    client(day0Recent+203_000,dSession,{event:'scroll',page:'job_match',contextId:'d'.repeat(24),scrollDepth:100}),
  ];
  const report=analyticsReport([
    {userId:'tester-a',discarded:0,events:a},{userId:'tester-b',discarded:0,events:b},
    {userId:'tester-c',discarded:0,events:c},{userId:'tester-d',discarded:0,events:d},
  ],now);
  assert.deepEqual(report.coreFunnel.map(x=>x.users),[4,4,4,3,2,1]);
  assert.equal(report.overview.analysisRead,3);
  assert.equal(report.overview.cvGenerateStarted,2);
  assert.equal(report.overview.cvGenerateCompleted,1);
  assert.equal(report.overview.cvFailed,1);
  assert.deepEqual(report.d1Retention,{eligibleD0Users:2,d1ReturnedUsers:1,rate:.5});
  assert.equal(report.journeys.find(x=>x.userId==='tester-b').analysisReadCount,0);
  assert.equal(report.journeys.find(x=>x.userId==='tester-a').analysisReadCount,1);
  assert.equal(report.journeys.find(x=>x.userId==='tester-d').analysisReadCount,1);
  assert.equal(report.timeToValue.find(x=>x.metric==='first_job_opened_to_analysis_read').samples,3);
  assert.equal(report.aiPerformance.cv_generation.failureRate,.5);
});

test('legacy page aliases normalize while opaque job context is bounded',()=>{
  const now=Date.now(),base={id:randomUUID(),sessionId:randomUUID(),event:'page_enter',timestamp:now};
  const [offer]=validateAnalyticsEvents({events:[{...base,page:'opportunities'}]},now);
  const [pdf]=validateAnalyticsEvents({events:[{...base,id:randomUUID(),page:'cv_preview',contextId:'a'.repeat(24)}]},now);
  assert.equal(offer.page,'offers');
  assert.equal(pdf.page,'pdf');
  assert.equal(pdf.contextId,'a'.repeat(24));
  assert.throws(()=>validateAnalyticsEvents({events:[{...base,id:randomUUID(),page:'job_match',contextId:'https://example.com/job'}]},now));
});
