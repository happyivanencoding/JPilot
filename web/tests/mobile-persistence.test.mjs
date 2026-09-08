import '../scripts/register-source-loader.mjs';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { candidateVersion, withProfileLock, writeJson, readJson, operationKey, discoveryProjection, normalizeAnalysis, resolvedIssues, applyEvidenceEdits, contractMatches } from '../src/lib/mobile-state.mjs';
import { usageFromRollout, apiEquivalent, historicalEstimate, FLOW_DEFAULTS } from '../src/lib/ai-metrics.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-persistence-'));
const priorRoot=process.env.CAREER_OPS_ROOT;
process.env.CAREER_OPS_ROOT=root;
after(()=>{if(priorRoot === undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=priorRoot;fs.rmSync(root,{recursive:true,force:true});});
const profiles=['fixture-a','fixture-b'].map(id=>({id,name:id,shortName:id,cvMarkdown:`data/${id}/cv.md`,config:`data/${id}/profile.yml`,notes:`data/${id}/notes.md`,candidatures:`data/${id}/candidatures.json`}));
writeJson(path.join(root,'data/profiles.json'),{version:1,defaultProfileId:'fixture-a',profiles});
const original='# Candidat fictif\n\n## Expérience\n- Nettoyage de données financières avec Python.\n';
const afterEdit='- Nettoyage en Python de données financières.';
for(const p of profiles){
 fs.mkdirSync(path.join(root,'data',p.id),{recursive:true});
 fs.writeFileSync(path.join(root,p.cvMarkdown),original);
 fs.writeFileSync(path.join(root,p.config),'candidate:\n  name: Candidat fictif\ntarget_roles:\n  contract_types: [CDI]\n');
 fs.writeFileSync(path.join(root,p.notes),'Python : niveau junior. Aucun management. Aucun résultat chiffré.');
 writeJson(path.join(root,p.candidatures),{candidate:p.name,jobs:[],updatedAt:new Date().toISOString()});
}
fs.mkdirSync(path.join(root,'reports'));
const history=await import('../src/lib/mobile-history.ts');
const engine=await import('../src/lib/mobile-engine.ts');
const {taskView}=await import('../src/lib/mobile-view.ts');
const p='fixture-a',q='fixture-b';
function task(profile,kind,input,version,extra={}){
 const id=randomUUID(),createdAt=new Date(Date.now()+1000).toISOString();
 const t={id,profileId:profile,kind,input,inputVersionId:version.id,cvVersion:version.cvVersion,operationKey:operationKey(kind,input,version,engine.readCandidatureStore(profile).jobs),status:'completed',createdAt,updatedAt:createdAt,ownerPid:process.pid,text:'INTERNAL_AGENT_TRANSCRIPT',...extra};
 writeJson(path.join(engine.mobileDirectory(profile),'tasks',id+'.json'),t);return t;
}
function issue(id='expr-1'){return {id,title:'Clarifier Python',before:'- Nettoyage de données financières avec Python.',after:afterEdit,evidence:'CV, Expérience'};}

test('input history ignores metadata-only touches and increments CV version only for CV text',()=>{
 const dir=path.join(root,'version-fixture');
 const sources={cv:{text:'CV A',modifiedMs:1},config:{text:'config',modifiedMs:1},notes:{text:'proof',modifiedMs:1}};
 const a=candidateVersion(dir,sources),same=candidateVersion(dir,{...sources,cv:{...sources.cv,modifiedMs:999}});
 assert.equal(a.id,same.id);
 const b=candidateVersion(dir,{...sources,cv:{text:'CV B',modifiedMs:2}});
 assert.notEqual(a.id,b.id);assert.equal(b.cvVersion,2);assert.equal(b.previousId,a.id);
 const c=candidateVersion(dir,{...b.sources,notes:{text:'new verified skill',modifiedMs:3}});
 assert.equal(c.cvVersion,2);assert.equal(c.revision,3);
});

test('cross-process lock serializes competing action claims',async()=>{
 const directory=path.join(root,'concurrent-claims');fs.mkdirSync(directory);
 const stateModule=pathToFileURL(path.resolve(import.meta.dirname,'../src/lib/mobile-state.mjs')).href;
 const code=`import {withProfileLock,readJson,writeJson} from ${JSON.stringify(stateModule)};import path from 'node:path';const d=process.env.JOBPILOT_TEST_LOCK_DIR;if(!d)throw new Error('missing lock fixture dir');await withProfileLock(d,async()=>{const p=path.join(d,'claim.json');const s=readJson(p,{created:0});if(!s.task){await new Promise(r=>setTimeout(r,50));s.created++;s.task='ONE_AGENT';writeJson(p,s);}});`;
 await Promise.all(Array.from({length:6},()=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--input-type=module','-e',code],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,JOBPILOT_TEST_LOCK_DIR:directory}});let err='';child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',n=>n?reject(new Error(err)):resolve());
 })));
 assert.deepEqual(readJson(path.join(directory,'claim.json')),{created:1,task:'ONE_AGENT'});
});

test('completed formal evaluation is reused across URL tracking variants without creating tasks',async()=>{
 const file=path.join(root,profiles[0].candidatures);
 writeJson(file,{candidate:p,jobs:[{id:'job-a',url:'https://example.org/job/123',company:'Test',role:'Quant',score:4.2,summary:'Real persisted fixture evaluation',reportNum:null}],updatedAt:new Date().toISOString()});
 const count=engine.listMobileTasks(p).length;
 const results=await Promise.all(Array.from({length:8},()=>engine.startMobileTask(p,{kind:'evaluate',url:'https://example.org/job/123/?utm_source=phone#details'})));
 assert(results.every(t=>t.status==='completed' && t.reused && t.result.jobId==='job-a'));
 assert.equal(engine.listMobileTasks(p).length,count);
});

test('queued action is shared on double click; another profile cannot reuse that task',async()=>{
 const version=history.currentCandidateVersion(p),otherVersion=history.currentCandidateVersion(q);
 const input={url:'https://example.org/job/456'};
 const queued=task(p,'evaluate',input,version,{status:'queued'});
 const other=task(q,'evaluate',input,otherVersion,{status:'queued'});
 const [a,b,c]=await Promise.all([engine.startMobileTask(p,{kind:'evaluate',...input}),engine.startMobileTask(p,{kind:'evaluate',...input}),engine.startMobileTask(q,{kind:'evaluate',...input})]);
 assert.equal(a.id,queued.id);assert.equal(b.id,a.id);assert.equal(c.id,other.id);assert.notEqual(c.id,a.id);
 assert.throws(()=>engine.readMobileTask(q,queued.id));
 await assert.rejects(engine.startMobileTask(q,{kind:'cv',jobId:'job-a'}),/profil|poste/i);
});

test('unchanged analysis is authoritative across language/entry points and more than 60 records',async()=>{
 const v=history.currentCandidateVersion(p);
 const existing=task(p,'analysis',{},v,{result:{markdown:'Existing analysis',expressionIssues:[issue()],actionIssues:[]}});
 for(let i=0;i<65;i++)task(p,'coach',{question:`Historical ${i}`},v,{result:{markdown:'Saved'}});
 const count=engine.listMobileTasks(p).length;
 const [a,b]=await Promise.all([engine.startMobileTask(p,{kind:'analysis',language:'fr'}),engine.startMobileTask(p,{kind:'analysis',language:'zh'})]);
 assert.equal(a.id,existing.id);assert.equal(b.id,existing.id);assert.equal(engine.listMobileTasks(p).length,count);
 assert.equal(history.currentAnalysis(p,v,engine.listMobileTasks(p)).stale,false);
 const view=taskView(existing,[],true);assert.equal('text' in view,false);assert.equal('sessionId' in view,false);
});

test('Discovery hides persisted evaluations and marks in-flight canonical URLs',()=>{
 const offers=[{url:'https://example.org/job/123?utm_campaign=x'},{url:'https://example.org/job/456'},{url:'https://example.org/job/789'}];
 const result=discoveryProjection({offers},engine.readCandidatureStore(p).jobs,engine.listMobileTasks(p));
 assert.equal(result.offers.length,2);assert.equal(result.offers[0].lifecycle,'evaluating');assert.equal(result.offers[1].lifecycle,'discovered');
 assert.notEqual(operationKey('evaluate',{url:'https://example.org/jobs?gh_jid=1'},{} ,[]),operationKey('evaluate',{url:'https://example.org/jobs?gh_jid=2'},{} ,[]));
});

test('reject changes no canonical bytes or version; accepting preserves history and resolves only selected issues',async()=>{
 const v=history.currentCandidateVersion(p);
 const analysis={taskId:'source-analysis',expressionIssues:[issue()]};
 const rejected=history.createCvDraft(p,v,analysis,['expr-1']);
 await history.decideCvDraft(p,rejected.id,'reject');
 assert.equal(fs.readFileSync(path.join(root,profiles[0].cvMarkdown),'utf8'),original);
 assert.equal(history.currentCandidateVersion(p).id,v.id);
 const accepted=history.createCvDraft(p,v,analysis,['expr-1']);
 const result=await history.decideCvDraft(p,accepted.id,'accept');
 assert.equal(result.cvVersion,v.cvVersion+1);
 assert(fs.readFileSync(path.join(root,profiles[0].cvMarkdown),'utf8').includes(afterEdit));
 assert.equal(resolvedIssues(history.historyDirectory(p)).length,1);
 await history.decideCvDraft(p,accepted.id,'accept');
 assert.equal(resolvedIssues(history.historyDirectory(p)).length,1);
 assert.equal(history.currentAnalysis(p,history.currentCandidateVersion(p),engine.listMobileTasks(p)).expressionIssues.length,0);
 const continuity=history.analysisContinuity(p,engine.listMobileTasks(p));
 assert.equal(continuity.previousCv,original);
 assert.equal(history.currentAnalysis(p,history.currentCandidateVersion(p),engine.listMobileTasks(p)).stale,true);
 assert.notEqual(operationKey('analysis',{},v,[]),operationKey('analysis',{},history.currentCandidateVersion(p),[]));
 assert.equal(fs.readFileSync(path.join(root,profiles[1].cvMarkdown),'utf8'),original);
});

test('stale draft cannot overwrite a newer CV or newly verified evidence',async()=>{
 const v=history.currentCandidateVersion(q),draft=history.createCvDraft(q,v,{taskId:'analysis-b',expressionIssues:[issue()]},['expr-1']);
 fs.appendFileSync(path.join(root,profiles[1].notes),'\nNew, verified project.');
 await assert.rejects(history.decideCvDraft(q,draft.id,'accept'),/changé/);
 assert.equal(fs.readFileSync(path.join(root,profiles[1].cvMarkdown),'utf8'),original);
 assert.throws(()=>history.readCvDraft(p,draft.id));
});

test('evidence edits reject invented quantities and non-unique or stale source spans',()=>{
 assert.throws(()=>applyEvidenceEdits(original,[{...issue(),after:'Performance accrue de 35%'}],original),/chiffre/);
 assert.throws(()=>applyEvidenceEdits(original,[{...issue(),before:'Not present'}],original),/correspond/);
 assert.throws(()=>applyEvidenceEdits(original+original,[issue()],original),/correspond/);
 const parsed=normalizeAnalysis({markdown:'**当前：**\n> - Nettoyage de données financières avec Python.\n\n**建议：**\n> '+afterEdit},'legacy',original);
 assert.equal(parsed.expressionIssues.length,1);assert.equal(parsed.expressionIssues[0].applicable,true);
});

test('structured contracts filter known mismatches without pretending unknown means permanent',()=>{
 assert.equal(contractMatches({contractType:'Internship'},['CDI']).matches,false);
 assert.equal(contractMatches({contractType:'permanent'},['CDI']).matches,true);
 assert.equal(contractMatches({contractType:'full-time'},['CDI']).confirmed,false);
 assert.equal(contractMatches({title:'Alternance analyste'},['Stage','CDI']).matches,false);
});

test('mobile AI defaults use Luna low for predictable interactive latency',()=>{
 for (const kind of ['search','analysis','evaluate','cv','plan','practice','compare','coach']) {
  assert.deepEqual(FLOW_DEFAULTS[kind],{model:'gpt-5.6-luna',reasoning:'low'});
 }
});

test('token usage uses exact new-session cumulative counters, not context occupancy or sum of snapshots',()=>{
 const id=randomUUID();
 const event={type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{input_tokens:100,output_tokens:20,total_tokens:120,cached_input_tokens:30,reasoning_output_tokens:5}}}};
 const text=[{type:'session_meta',payload:{id}},{type:'usage_update',used:999999},event,event].map(v=>JSON.stringify(v)).join('\n');
 const usage=usageFromRollout(text,id);assert.equal(usage.totalTokens,120);assert.equal(usage.reasoningTokens,5);
 assert.equal(usageFromRollout(text,randomUUID()),null);
 assert.equal(apiEquivalent('gpt-5.6-luna',null).actualCostUsd,null);
 assert.equal(apiEquivalent('gpt-5.6-luna',usage).costKind,'api-equivalent-estimate');
});

test('ETA stays non-numeric without comparable history; reused/other model runs are excluded',()=>{
 const base={kind:'analysis',status:'completed',metrics:{model:'gpt-5.6-luna',reasoning:'low',wallMs:30000}};
 assert.equal(historicalEstimate([base,base],'analysis','gpt-5.6-luna','low').minSeconds,null);
 const estimate=historicalEstimate([base,base,base,{...base,reusedResult:true,metrics:{...base.metrics,wallMs:999999}}],'analysis','gpt-5.6-luna','low');
 assert.equal(estimate.samples,3);assert(estimate.maxSeconds<60);
 assert.equal(historicalEstimate([base,base,base],'analysis','gpt-6-astra','low').samples,0);
});
