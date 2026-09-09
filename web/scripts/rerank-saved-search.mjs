// Reproject a previously completed AI-fallback search without querying providers or invoking AI.
import './register-source-loader.mjs';
const {readCandidatureStore}=await import('../src/lib/candidatures.ts');
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import {parseDiscoveredOffers} from '../src/lib/mobile-domain.mjs';
import {rankSearchResults} from '../src/lib/job-search/index.mjs';
import {searchRequestFromConfig} from '../src/lib/job-search/mobile-context.mjs';
import {withProfileLock,loadCandidateVersion,writeJson} from '../src/lib/mobile-state.mjs';
process.env.CAREER_OPS_ROOT ||= path.resolve(import.meta.dirname,'../..');
const {readMobileTask,mobileDirectory}=await import('../src/lib/mobile-engine.ts');
const [profile,id]=process.argv.slice(2);const task=readMobileTask(profile,id);
if(task.kind!=='search'||task.status!=='completed')throw new Error('Only a completed search can be re-ranked.');
if((task.result.searchMetrics.providers||[]).some(p=>p.rawCount>0))throw new Error('The saved raw provider payload is needed; do not drop source results.');
const version=loadCandidateVersion(mobileDirectory(profile),task.inputVersionId);
const request=searchRequestFromConfig(task.input.query,yaml.load(version.sources.config.text),readCandidatureStore(profile).jobs.map(j=>j.url));
const raw=parseDiscoveredOffers(task.text);const ranked=rankSearchResults(request,raw,[],{now:Date.parse(task.result.searchedAt)});
await withProfileLock(mobileDirectory(profile),()=>{
 const file=path.join(mobileDirectory(profile),'tasks',id+'.json');if(!fs.existsSync(file+'.before-rerank'))fs.copyFileSync(file,file+'.before-rerank');
 const previous=task.result.searchMetrics;
 task.result.offers=ranked.offers;task.result.searchMetrics={...previous,...ranked.metrics,wallMs:previous.wallMs,providers:previous.providers,estimatedApiCostUsd:previous.estimatedApiCostUsd,rerankedAt:new Date().toISOString(),additionalAgentCalls:0};
 writeJson(file,task);
});
console.log(JSON.stringify({extraAgentCalls:0,offers:ranked.offers,metrics:ranked.metrics},null,2));
