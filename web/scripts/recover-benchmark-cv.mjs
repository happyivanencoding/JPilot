import './register-source-loader.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { benchmarkRoot, projectRoot } from './jobpilot-benchmark-fixture.mjs';
import { readJson,writeJson,operationKey } from '../src/lib/mobile-state.mjs';
const {currentCandidateVersion,historyDirectory}=await import('../src/lib/mobile-history.ts');
const {generateTailoredCv}=await import('../src/lib/tailored-cv.ts');
for(const id of ['cv--gpt-5.6-luna--medium','cv--gpt-5.6-terra--medium','cv--gpt-6-astra--low']) {
 const directory=path.join(benchmarkRoot,'cases',id);process.env.CAREER_OPS_ROOT=directory;
 const resultFile=path.join(directory,'result.json');const original=readJson(resultFile);
 if(original?.renderRecovery?.status==='completed')continue;
 const payloadDir=path.join(directory,'.career-ops-web/candidature-cv');
 const payloadFile=fs.readdirSync(payloadDir).find(f=>f.endsWith('.json'));
 if(!payloadFile)throw new Error('No saved generated CV for '+id);
 const payload=readJson(path.join(payloadDir,payloadFile));
 const version=currentCandidateVersion('benchmark');const job=readJson(path.join(directory,'data/candidatures.json')).jobs[0];
 const key=operationKey('cv',{jobId:job.id},version,[job]);
 const cache=path.join(historyDirectory('benchmark'),'cv-generations',version.id,encodeURIComponent(job.id)+'.json');
 writeJson(cache,{operationKey:key,profileId:'benchmark',jobId:job.id,inputVersionId:version.id,output:JSON.stringify(payload),metrics:original.metrics,createdAt:original.startedAt,recoveredFrom:'persisted-render-input'});
 fs.copyFileSync(path.join(projectRoot,'tracker-aliases.json'),path.join(directory,'tracker-aliases.json'));
 const start=Date.now();const recovery={status:'running',aiCalls:0};
 try {
  const response=await generateTailoredCv(new Request('http://localhost/cv',{method:'POST',body:JSON.stringify({id:job.id,profileId:'benchmark',inputVersionId:version.id})}));
  const text=await response.text();const events=text.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
  if(events.some(e=>e.t==='execution'))throw new Error('Unexpected AI execution during render-only recovery');
  const error=events.find(e=>e.t==='error');if(error)throw new Error(error.message);
  const done=events.find(e=>e.t==='done');if(!done)throw new Error('Render did not complete');
  recovery.status='completed';recovery.pages=done.job.cv.pages;recovery.atsScore=done.atsScore;recovery.pdf=done.job.cv.file;
  recovery.metrics=events.find(e=>e.t==='metrics')?.metrics;
 }catch(e){recovery.status='failed';recovery.error=String(e);}
 recovery.wallMs=Date.now()-start;original.renderRecovery=recovery;writeJson(resultFile,original);console.log(JSON.stringify({id,...recovery}));
}
