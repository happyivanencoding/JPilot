// Local acceptance uses synthetic data for writes; real profiles are read/reused only.
import './register-source-loader.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {projectRoot,prepareCase} from './jobpilot-benchmark-fixture.mjs';
import {writeJson,readJson,operationKey} from '../src/lib/mobile-state.mjs';
const out=path.join(projectRoot,'.career-ops-web/mobile-qa/20260908-acceptance.json');
const evidence={startedAt:new Date().toISOString(),checks:[],device:'Disconnected before remaining acceptance; this file records backend/API checks, not USB tests.'};
const check=(name,details={})=>{evidence.checks.push({name,status:'passed',...details});writeJson(out,evidence);console.log('PASS '+name);};
const base='http://127.0.0.1:3000';
async function json(url,body){const response=await fetch(base+url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const value=await response.json();return {status:response.status,value};}
try {
 const snapshots={};const raw={};
 const registry=readJson(path.join(projectRoot,'data/profiles.json'));
 for(const p of registry.profiles){
  const result=await json('/api/mobile?profileId='+p.id);assert.equal(result.status,200);assert.equal(result.value.profile.id,p.id);snapshots[p.id]=result.value;
  raw[p.id]=fs.readFileSync(path.resolve(projectRoot,p.cvMarkdown));
  assert(result.value.tasks.every(t=>t.profileId===p.id && !('text' in t) && !('sessionId' in t)));
 }
 check('Real three-profile snapshots expose only their own task records and no raw ACP transcript');
 const profile=process.argv.find(a=>a.startsWith('--profile='))?.split('=')[1];
 if(!profile || !snapshots[profile]?.analysis?.taskId)throw new Error('Pass --profile=<existing-profile-with-analysis>; this check never invents a profile.');
 const snapshot=snapshots[profile],existing=snapshot.analysis.taskId;
 const other=registry.profiles.find(p=>p.id!==profile)?.id;assert(other);
 const analyze={action:'task',profileId:profile,input:{kind:'analysis',language:'fr'}};
 const repeated=await Promise.all(Array.from({length:8},()=>json('/api/mobile',analyze)));
 assert(repeated.every(r=>r.status===200 && r.value.id===existing && r.value.reused));
 check('8 concurrent real unchanged-CV analysis requests reuse the authoritative result',{profile,taskId:existing});
 const job=snapshot.jobs.find(j=>j.reportNum);assert(job);
 const url=new URL(job.url);url.searchParams.set('utm_source','jobpilot-idempotency-verification');
 const evaluate={action:'task',profileId:profile,input:{kind:'evaluate',url:url.href}};
 const evaluations=await Promise.all(Array.from({length:8},()=>json('/api/mobile',evaluate)));
 assert(evaluations.every(r=>r.status===200 && r.value.status==='completed' && r.value.reused));
 const refreshed=(await json('/api/mobile?profileId='+profile)).value;
 assert.equal(refreshed.tasks.length,snapshot.tasks.length);
 assert(!refreshed.discovery.offers.some(o=>o.url===job.url));
 check('8 concurrent formal-evaluation requests reuse the actual saved report, add no tasks, and keep it out of Discovery',{profile,reportNum:job.reportNum});
 const foreign=await json('/api/mobile',{action:'task',profileId:other,input:{kind:'cv',jobId:job.id}});assert.equal(foreign.status,400);
 const foreignTask=await json('/api/mobile?profileId='+other+'&taskId='+existing);assert(foreignTask.status>=400);
 const foreignReport=await json('/api/mobile?profileId='+other+'&reportJobId='+job.id);assert.equal(foreignReport.status,404);
 check('Cross-profile job generation, task lookup and report lookup are rejected before an AI call');
 for(const p of registry.profiles)assert(fs.readFileSync(path.resolve(projectRoot,p.cvMarkdown)).equals(raw[p.id]));
 check('All real canonical CV files remain byte-for-byte unchanged');

 const root=prepareCase('backend-acceptance-'+randomUUID(),'analysis');process.env.CAREER_OPS_ROOT=root;
 const {currentCandidateVersion,historyDirectory}=await import('../src/lib/mobile-history.ts');
 const {POST,GET}=await import('../src/app/api/mobile/route.ts');
 const {GET:cvGET}=await import('../src/app/api/mobile/cv/route.ts');
 const {listMobileTasks,coachingPrompt}=await import('../src/lib/mobile-engine.ts');
 const v=currentCandidateVersion('benchmark'),id=randomUUID(),before='- Documentation des contrôles de qualité des données.',after='- Documentation des contrôles qualité appliqués aux données.';
 const result={markdown:'Analyse de contrôle, candidat synthétique.',changeSummary:'Première analyse de contrôle.',expressionIssues:[{id:'wording-1',title:'Clarifier la documentation',before,after,evidence:'Extrait exact du CV'}],actionIssues:[{id:'experience-1',title:'Projet d’investissement à démontrer',detail:'Pas de gestion discrétionnaire démontrée.',nextAction:'Constituer un projet documenté.'}]};
 const task={id,profileId:'benchmark',kind:'analysis',status:'completed',input:{},inputVersionId:v.id,cvVersion:v.cvVersion,operationKey:operationKey('analysis',{},v,[]),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),ownerPid:process.pid,text:'',result};
 writeJson(path.join(historyDirectory('benchmark'),'tasks',id+'.json'),task);
 const post=async body=>{const response=await POST(new Request('http://local/api/mobile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:'benchmark',...body})}));const value=await response.json();assert(response.ok,JSON.stringify(value));return value;};
 const newDraft=async()=>{
  const t=await post({action:'task',input:{kind:'rewrite',analysisId:id,suggestionIds:['wording-1']}});
  const deadline=Date.now()+65000;let current;
  do {await new Promise(r=>setTimeout(r,200));current=listMobileTasks('benchmark').find(x=>x.id===t.id);if(current.status==='failed')throw new Error(current.error);}while(current.status!=='completed'&&Date.now()<deadline);
  assert.equal(current.status,'completed');assert.equal(current.metrics.totalTokens,0);assert(!current.sessionId);return current;
 };
 const rejected=await newDraft();const draftId=rejected.result.draftId;
 const preview=await cvGET(new Request('http://local/api/mobile/cv?profileId=benchmark&draftId='+draftId));assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'application/pdf');assert(Buffer.from(await preview.arrayBuffer()).subarray(0,4).equals(Buffer.from('%PDF')));
 const meta=await (await cvGET(new Request('http://local/api/mobile/cv?profileId=benchmark&draftId='+draftId+'&format=meta'))).json();assert.equal(meta.pages,1);
 await post({action:'decideCvDraft',draftId,decision:'reject'});assert.equal(currentCandidateVersion('benchmark').id,v.id);assert.equal(fs.readFileSync(path.join(root,'cv.md'),'utf8'),v.sources.cv.text);
 check('Actual rewrite task creates a rendered one-page PDF without AI; rejecting leaves canonical CV/version unchanged',{fixtureRoot:root});
 const accepted=await newDraft();assert.notEqual(accepted.result.draftId,draftId);
 await post({action:'decideCvDraft',draftId:accepted.result.draftId,decision:'accept'});
 await post({action:'decideCvDraft',draftId:accepted.result.draftId,decision:'accept'});
 const updated=currentCandidateVersion('benchmark');assert.equal(updated.cvVersion,v.cvVersion+1);assert(updated.sources.cv.text.includes(after));
 const {currentAnalysis}=await import('../src/lib/mobile-history.ts');const analysis=currentAnalysis('benchmark',updated,listMobileTasks('benchmark'));assert.equal(analysis.expressionIssues.length,0);assert.equal(analysis.resolvedCount,1);assert.equal(analysis.stale,true);
 const prompt=coachingPrompt({...task,id:randomUUID(),inputVersionId:updated.id});assert(prompt.includes(before)&&prompt.includes(after)&&prompt.includes('wording-1'));
 check('Accept is idempotent, advances CV version once, resolves the issue, and passes old/new CV plus accepted edits to the next analysis prompt');
 evidence.status='passed';evidence.finishedAt=new Date().toISOString();writeJson(out,evidence);console.log('Evidence: '+out);
}catch(error){evidence.status='failed';evidence.error=String(error);writeJson(out,evidence);console.error(error);process.exitCode=1;}
