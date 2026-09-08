// Observe only an existing profile-scoped analysis. This script never starts a model.
import './register-source-loader.mjs';
import fs from 'node:fs';
import path from 'node:path';
process.env.CAREER_OPS_ROOT ||= path.resolve(import.meta.dirname,'../..');
const {readMobileTask,mobileDirectory}=await import('../src/lib/mobile-engine.ts');
import {observeAgentDockRun} from '../src/lib/agentdock-acp.ts';
import {extractJsonObject} from '../src/lib/extract-json-object.mjs';
import {readCodexFinalAnswer} from '../src/lib/ai-metrics.mjs';
import {parseAnalysisResult} from '../src/lib/analysis-result.mjs';
import {compileGlobalPlan,preservePresentationLanguage} from '../src/lib/cv-global-plan.mjs';
import {loadCandidateVersion,withProfileLock,writeJson,readJson} from '../src/lib/mobile-state.mjs';
const [profile,id]=process.argv.slice(2);
const task=readMobileTask(profile,id);
if(task.kind!=='analysis'||!task.runId)throw new Error('An existing analysis with a recorded run is required.');
const complete=readCodexFinalAnswer(task.remoteSessionId,task.createdAt);
const observed=complete?{status:'completed',completeHistory:true,text:complete,source:'exact-codex-task-session'}:await observeAgentDockRun(task.runId);
const output=path.join(mobileDirectory(profile),'tasks',id+'.observed.json');
fs.writeFileSync(output,JSON.stringify(observed,null,2));
const parsed=extractJsonObject(observed.text);
let error='',near='';
try{JSON.parse(observed.text.replace(/^```json\s*|\s*```$/g,''));}catch(e){error=e.message;const match=error.match(/position (\d+)/);if(match){const n=Number(match[1]);near=observed.text.slice(Math.max(0,n-200),n+200);}}
console.log(JSON.stringify({profile,task:id,status:observed.status,completeHistory:observed.completeHistory,characters:observed.text.length,truncated:parsed.truncated,keys:Object.keys(parsed.obj||{}),error,near,tail:observed.text.slice(-800),saved:output}));
if(process.argv.includes('--repair-existing')) {
  if(!observed.completeHistory||observed.status!=='completed')throw new Error('A complete final answer is required; no new model will be started.');
  const version=loadCandidateVersion(mobileDirectory(profile),task.inputVersionId);
  const result=preservePresentationLanguage(parseAnalysisResult(observed.text),version,String(task.input.language || 'fr'));
  const plan=compileGlobalPlan(result.globalPlan,version.sources.cv.text);
  await withProfileLock(mobileDirectory(profile),()=>{
    const file=path.join(mobileDirectory(profile),'tasks',id+'.json');
    if(!fs.existsSync(file+'.before-result-recovery'))fs.copyFileSync(file,file+'.before-result-recovery');
    const current=readJson(file);writeJson(file,{...current,result,text:result.markdown,status:'completed',outputRecoveredAt:new Date().toISOString(),outputSource:observed.source,additionalAgentCalls:0});
  });
  console.log(JSON.stringify({restored:true,extraAgentCalls:0,signals:result.globalPlan.signals,actions:result.actionIssues,budget:plan.budget,applicable:plan.applicable,issues:plan.issues}));
}
