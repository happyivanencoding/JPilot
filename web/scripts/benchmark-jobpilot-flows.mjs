// Full production functions, isolated fictional Candidate roots, bounded ACP concurrency.
import './register-source-loader.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { prepareCase, benchmarkRoot, fixtureJob } from './jobpilot-benchmark-fixture.mjs';
import { writeJson, readJson } from '../src/lib/mobile-state.mjs';
const matrix=[
 ['search','gpt-5.6-luna','low'],['search','gpt-6-astra','low'],
 ['cv','gpt-5.6-luna','medium'],['cv','gpt-5.6-terra','medium'],['cv','gpt-6-astra','low'],
 ['evaluate','gpt-5.6-luna','medium'],['evaluate','gpt-5.6-sol','medium'],['evaluate','gpt-6-astra','low'],
 ['career','gpt-5.6-luna','medium'],['career','gpt-6-astra','low'],
 ['continuity','gpt-5.6-luna','medium'],['continuity','gpt-6-astra','low'],
];
const caseIndex=process.argv.indexOf('--case');
const runTag=process.argv.find(a=>a.startsWith('--run-tag='))?.split('=')[1] || '';
if(runTag && !/^[a-z0-9-]+$/.test(runTag))throw new Error('Invalid benchmark run tag.');
if(caseIndex<0){
 const script=path.resolve(import.meta.filename);let cursor=0;
 const requested=process.argv.find(a=>a.startsWith('--only='))?.split('=')[1];
 const cases=matrix.filter(x=>!requested || requested.split(',').includes(x[0]));
 const run=async()=>{while(cursor<cases.length){const item=cases[cursor++],id=item.join('--')+(runTag?'--'+runTag:'');const directory=prepareCase(id,item[0]),file=path.join(directory,'result.json');
  const existing=readJson(file);
  if(existing?.status==='completed')continue;
  if(existing?.status==='running')throw new Error(`Inspect incomplete case ${id} before retry.`);
  await new Promise(resolve=>{const child=spawn(process.execPath,['--no-warnings','--experimental-strip-types',script,...(runTag?['--run-tag='+runTag]:[]),'--case',...item],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,CAREER_OPS_ROOT:directory},windowsHide:true,stdio:['ignore','pipe','pipe']});
   child.stdout.on('data',b=>process.stdout.write(b));child.stderr.on('data',b=>process.stderr.write(b));
   child.on('error',e=>{console.error(String(e));resolve();});child.on('close',()=>resolve());
  });
 }};
 await Promise.all([run(),run()]);console.log('Full-flow benchmark artifacts: '+benchmarkRoot);
}else{
 const [flow,model,reasoning]=process.argv.slice(caseIndex+1);const id=[flow,model,reasoning].join('--')+(runTag?'--'+runTag:'');
 const directory=process.env.CAREER_OPS_ROOT;
 if(!directory?.startsWith(path.join(benchmarkRoot,'cases')) || !fs.existsSync(path.join(directory,'fixture.json')))throw new Error('Isolated fixture root is required.');
 const file=path.join(directory,'result.json');const record={id,flow,model,reasoning,status:'running',startedAt:new Date().toISOString(),metrics:{},output:'',events:[],quality:{manualEvidenceReview:'pending'}};
 const started=Date.now(),save=()=>writeJson(file,record);save();
 const metrics=v=>{record.metrics={...record.metrics,...v};save();};
 const onRun=r=>{record.sessionId=r.sessionId;record.runId=r.runId;record.remoteSessionId=r.remoteSessionId;save();console.log(JSON.stringify({id,sessionId:r.sessionId,runId:r.runId}));};
 try{
  const {currentCandidateVersion,currentAnalysis,createCvDraft,decideCvDraft,saveCanonicalCv}=await import('../src/lib/mobile-history.ts');
  const version=currentCandidateVersion('benchmark');
  if(flow==='cv' || flow==='evaluate'){
   const body=flow==='cv'?{id:fixtureJob.id,profileId:'benchmark',inputVersionId:version.id}:{kind:'evaluate',input:fixtureJob.url,profileId:'benchmark',inputVersionId:version.id};
   const response=flow==='evaluate'
     ? await (await import('../src/lib/evaluation-transport.ts')).executeTransportEvaluation({profileId:'benchmark',url:fixtureJob.url,inputVersionId:version.id,locale:'fr',model,reasoning})
     : await (await import('../src/lib/tailored-cv.ts')).generateTailoredCv(new Request('http://localhost/isolated-benchmark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{model,reasoning});
   if(!response.ok)throw new Error(await response.text());
   const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',done=false;
   const event=e=>{const type=e.type || e.t;if(type==='metrics')metrics(e.metrics);else if(type==='execution')onRun(e);else if(type==='text')record.output+=String(e.text || '');else if(type==='error')record.error=String(e.message||e.msg||'Pipeline error');else if(type==='done'){record.result=e;done=true;}if(['progress','status'].includes(type))record.events.push({at:new Date().toISOString(),label:e.label});save();};
   for(;;){const part=await reader.read();if(part.done)break;pending+=decoder.decode(part.value,{stream:true});let n;while((n=pending.indexOf('\n'))>=0){const line=pending.slice(0,n);pending=pending.slice(n+1);if(line.trim())event(JSON.parse(line));}}
   pending+=decoder.decode();if(pending.trim())event(JSON.parse(pending));
   if(record.error || !done)throw new Error(record.error || 'Missing completion event');
   if(flow==='evaluate'){
    const evaluation=(await import('../src/lib/evaluation-state.ts')).findPersistedEvaluation('benchmark',fixtureJob.url);
    if(!evaluation || evaluation.source!=='official-report')throw new Error('Formal evaluation did not persist a profile-scoped official report.');
    record.quality.persistedReport=true;record.evaluation=evaluation;
   }else{const job=readJson(path.join(directory,'data/candidatures.json')).jobs[0];record.quality={...record.quality,pdfExists:fs.existsSync(path.join(directory,job.cv?.file||'missing')),pages:job.cv?.pages,atsScore:job.cv?.atsScore};}
  }else{
   const {openAgentDockCodex,runAgentDockCodex}=await import('../src/lib/agentdock-acp.ts');
   const {extractJsonObject}=await import('../src/lib/extract-json-object.mjs');
   const {coachingPrompt,listMobileTasks}=await import('../src/lib/mobile-engine.ts');
   let prompt;
   if(flow==='search')prompt=(await import('../src/lib/explore-search.ts')).buildSearchPrompt('benchmark','Trouver 2 à 4 postes CDI junior en recherche quantitative fixed income ou analyse de risque de marché à Paris. Écarter les stages. Vérifier les pages employeurs actuelles.',version);
   else if(flow==='career')prompt=coachingPrompt({id:randomUUID(),profileId:'benchmark',kind:'coach',inputVersionId:version.id,input:{language:'fr',question:'Quel positionnement professionnel est réaliste pour ma première transition vers la recherche quantitative obligataire à Paris ? Distinguer les preuves actuelles, les besoins réels et les prochaines actions prioritaires. Ne pas transformer mes contributions en ownership.'},selectedJobs:[]});
   else{
    const baseline=readJson(path.join(benchmarkRoot,'screening.json')).find(r=>r.id==='analysis--gpt-5.6-luna--low' && r.status==='completed');
    if(!baseline)throw new Error('Completed baseline analysis missing.');
    const result=extractJsonObject(baseline.output).obj;
    const analysisId=randomUUID();const task={id:analysisId,profileId:'benchmark',kind:'analysis',status:'completed',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),inputVersionId:version.id,cvVersion:version.cvVersion,ownerPid:process.pid,input:{},text:'',result};
    writeJson(path.join(directory,'.career-ops-web/profiles/benchmark/mobile/tasks',analysisId+'.json'),task);
    const analysis=currentAnalysis('benchmark',version,[task]);const selected=analysis.expressionIssues.filter(i=>i.applicable).slice(0,1).map(i=>i.id);
    const draft=createCvDraft('benchmark',version,analysis,selected);await decideCvDraft('benchmark',draft.id,'accept');
    const accepted=currentCandidateVersion('benchmark');
    await saveCanonicalCv('benchmark',accepted.sources.cv.text+'\n## Projet personnel vérifié — benchmark\n- Notebook Python reproductible calculant le prix, la duration et le DV01 d’une obligation synthétique ; code relu et résultats vérifiés sur des cas simples.\n',accepted.id);
    const updated=currentCandidateVersion('benchmark');
    prompt=coachingPrompt({id:randomUUID(),profileId:'benchmark',kind:'analysis',inputVersionId:updated.id,input:{language:'fr'}});
    record.resolvedIds=selected;record.quality.previousCvIncluded=prompt.includes('précédente version du CV');
   }
   const {client}=await openAgentDockCodex();
   await runAgentDockCodex({client,prompt,cwd:directory,model,reasoning,mode:'read-only',timeoutMs:300000,onRun,onMetrics:metrics,onText:t=>{record.output+=t;}});
   if(flow==='search'){
    const {parseDiscoveredOffers}=await import('../src/lib/mobile-domain.mjs');const offers=parseDiscoveredOffers(record.output);
    record.quality={...record.quality,offers:offers.length,allUnrated:offers.every(o=>o.score===undefined),contractTypes:offers.map(o=>o.contractType||'unknown')};record.offers=offers;
    if(!offers.length)record.quality.noCurrentMatchingOffers=true;
   }else{
    const result=extractJsonObject(record.output).obj;if(!result?.markdown)throw new Error('Invalid structured analysis');record.result=result;record.quality.validJson=true;
    if(flow==='continuity')record.quality.resolvedNotReopened=!result.expressionIssues?.some(i=>record.resolvedIds.includes(i.id));
   }
  }
  record.status='completed';
 }catch(e){record.status='failed';record.error=String(e);}
 record.finishedAt=new Date().toISOString();record.metrics.wallMs=Date.now()-started;save();console.log(JSON.stringify({...record,output:undefined,result:undefined,events:undefined}));
}
