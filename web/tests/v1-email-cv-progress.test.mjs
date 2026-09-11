import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPreviewSession,readPreviewSession,revokePreviewSession,normalizePreviewEmail} from '../src/lib/v1-session.mjs';
import {cvProgress,cvFailure} from '../src/lib/v1-cv-progress.mjs';
import {estimatedProgress} from '../src/lib/v1-progress.mjs';

async function withRoot(work) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'jpilot-email-'));
  try {await work(root);} finally {fs.rmSync(root,{recursive:true,force:true});}
}

test('email validation and normalization do not invent accounts',async()=>withRoot(async root=>{
  assert.equal(normalizePreviewEmail('  STUDENT@Example.com  '),'student@example.com');
  await assert.rejects(createPreviewSession(root,'not-an-email'),/valid email/);
  assert.deepEqual(fs.readdirSync(root),[]);
}));

test('same email reuses a persisted profile across logout and another browser',async()=>withRoot(async root=>{
  const first=await createPreviewSession(root,'student@example.com');
  assert.equal(first.isNew,true);assert.equal(first.needsOnboarding,true);
  const mobile=path.join(root,'.career-ops-web','profiles',first.profileId,'mobile');
  const cvFile=path.join(root,'.career-ops-web','profiles',first.profileId,'cv.md');
  fs.writeFileSync(cvFile,'Synthetic Student\nMaster logistics.');
  fs.mkdirSync(mobile,{recursive:true});
  fs.writeFileSync(path.join(mobile,'journey.json'),JSON.stringify({query:'logistics junior',ingestTaskId:'existing-import',completed:false}));
  revokePreviewSession(root,first.token);
  assert.equal(readPreviewSession(root,first.token),null);
  const second=await createPreviewSession(root,' STUDENT@EXAMPLE.COM ');
  assert.equal(second.profileId,first.profileId);assert.notEqual(second.token,first.token);
  assert.equal(second.isNew,false);assert.equal(second.needsOnboarding,false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(mobile,'journey.json'),'utf8')),{query:'logistics junior',ingestTaskId:'existing-import',completed:true});
  assert.equal(fs.readFileSync(cvFile,'utf8'),'Synthetic Student\nMaster logistics.');
  const accounts=JSON.parse(fs.readFileSync(path.join(root,'.career-ops-web','v1-accounts.json'),'utf8'));
  assert.equal(accounts.accounts.length,1);assert.equal(accounts.accounts[0].email,'student@example.com');
}));

test('different email stays empty; unfinished upload resumes rather than repeating account creation',async()=>withRoot(async root=>{
  const a=await createPreviewSession(root,'a@example.com');
  const b=await createPreviewSession(root,'b@example.com');
  assert.notEqual(a.profileId,b.profileId);
  const returned=await createPreviewSession(root,'a@example.com');
  assert.equal(returned.isNew,false);assert.equal(returned.needsOnboarding,true);
  assert.equal(returned.profileId,a.profileId);
  revokePreviewSession(root,a.token);
  assert.ok(readPreviewSession(root,returned.token));assert.ok(readPreviewSession(root,b.token));
}));

test('concurrent same-email sign-ins create one account and separate revocable sessions',async()=>withRoot(async root=>{
  const sessions=await Promise.all(Array.from({length:4},()=>createPreviewSession(root,'parallel@example.com')));
  assert.equal(new Set(sessions.map(s=>s.profileId)).size,1);
  assert.equal(new Set(sessions.map(s=>s.token)).size,4);
  assert.equal(sessions.filter(s=>s.isNew).length,1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data','profiles.json'),'utf8')).profiles.length,1);
}));

const at='2026-09-11T12:35:15.000Z';
const snapshot={cv:'Amina synthetic CV',cvState:{versionId:'cv-1',changedAt:at},v1:{analysisState:'failed'}};
const ingest={id:'upload',kind:'ingest',status:'completed',createdAt:at,updatedAt:at};
const analysis={id:'analysis',kind:'analysis',inputVersionId:'cv-1',input:{source:'v1-upload'},status:'failed',createdAt:at,updatedAt:'2026-09-11T12:35:16.000Z',error:'OpenAI direct HTTP 429: You have no credits remaining.'};

test('successful extraction plus exhausted AI credits is a saved-CV analysis failure, not an unreadable file',()=>{
  const p=cvProgress(snapshot,[analysis,ingest],{ingestTaskId:'upload'},{ready:false},'zh');
  assert.equal(p.status,'failed');assert.equal(p.phase,'analyze');
  assert.equal(p.failure.code,'ai-credit-exhausted');assert.match(p.failure.message,/简历已保存/);assert.match(p.failure.message,/无需重新上传/);
  assert.doesNotMatch(p.failure.message,/HTTP|OpenAI|https:/);
  assert.notEqual(cvFailure('HTTP 429: rate limit','analyze').code,'ai-credit-exhausted');
  assert.equal(cvFailure('PDF text missing','read').code,'cv-read-failed');
});

test('waiting for localized directions stays incomplete; only ready directions reach completion',()=>{
  const doneAnalysis={...analysis,status:'completed',error:undefined};
  const doneSnapshot={...snapshot,v1:{analysisState:'completed'}};
  const tasks=[doneAnalysis,ingest],journey={ingestTaskId:'upload'};
  assert.equal(cvProgress(doneSnapshot,tasks,journey,{ready:false},'en').status,'running');
  assert.equal(cvProgress(doneSnapshot,tasks,journey,{ready:false},'en').phase,'translate');
  assert.equal(cvProgress(doneSnapshot,tasks,journey,{ready:true},'en').status,'completed');
  assert.equal(cvProgress(doneSnapshot,tasks,journey,{ready:false,translationFailed:true},'en').failure.code,'insight-translation-failed');
});

test('retry uses a fresh estimate without repeating extraction or changing candidate facts',()=>{
  const retry={...analysis,id:'retry',status:'running',createdAt:'2026-09-11T13:00:00.000Z',input:{source:'v1-retry'}};
  const p=cvProgress({...snapshot,v1:{analysisState:'running'}},[retry,analysis,ingest],{ingestTaskId:'upload'},{ready:false},'fr');
  assert.equal(p.status,'running');assert.equal(p.failure,null);assert.equal(p.createdAt,retry.createdAt);
});

test('water estimate slows near 80–90%, caps below 100%, and completes only on server readiness',()=>{
  const value=t=>estimatedProgress(t,'running',55);
  assert.ok(value(35)>.8&&value(35)<.9);
  assert.ok(value(55)>.9&&value(55)<.96);
  assert.ok(value(20)-value(10)>value(60)-value(50));
  assert.equal(value(10000),.96);
  assert.equal(estimatedProgress(1,'completed',55),1);
  assert.ok(estimatedProgress(10000,'failed',55)<1);
});
