import '../scripts/register-source-loader.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {registerHooks} from 'node:module';
import {createPreviewSession,readPreviewSession,revokePreviewSession,setProfileDisplayName} from '../src/lib/v1-session.mjs';
import {currentVersionTasks} from '../src/lib/v1-journey.mjs';
import {discoveryProjection,writeJson} from '../src/lib/mobile-state.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jpilot-v1-journey-'));
const oldRoot=process.env.CAREER_OPS_ROOT,oldPreview=process.env.JOBPILOT_V1_PREVIEW;
process.env.CAREER_OPS_ROOT=root;process.env.JOBPILOT_V1_PREVIEW='1';
let modelCalls=0,translationCalls=0,failTranslation=false;
const prompts=[];
globalThis.__journeyModel=async options=>{
  modelCalls++;prompts.push(options.prompt);
  const name=options.prompt.includes('Yuki Tanaka')?'Yuki Tanaka':'Mehdi Martin';
  options.onRun?.({runId:'unit-'+modelCalls,sessionId:''});
  options.onFinalText(JSON.stringify({candidateName:name,markdown:'Your export experience opens several business opportunities.',strengths:[{title:'Export sales support',evidence:'Supported the export team and prepared market research.'}],growthAreas:[{title:'Develop commercial reporting',nextAction:'Add a clear example of your sales reporting.'}],careerDirections:[{title:'Business development',why:'Your export support experience is relevant.',evidence:['Supported export sales'],searchQuery:'business developer junior'}],searchKeywords:['business developer junior'],suggestedContracts:['CDI']}));
  return {status:'completed',textEmitted:true};
};
globalThis.__journeyTranslation=async options=>{
  translationCalls++;await new Promise(r=>setTimeout(r,35));
  if(failTranslation)throw new Error('fixture translation interrupted');
  const rows=JSON.parse(options.prompt.slice(options.prompt.lastIndexOf('\n')+1));
  options.onFinalText(JSON.stringify({translations:rows.map(row=>({id:row.id,text:'中文优势说明 '+(row.text.match(/⟦P\d+⟧/g)||[]).join(' ')}))}));
  return {status:'completed',textEmitted:true};
};
const stub='data:text/javascript,'+encodeURIComponent('export const runModelTransport=o=>globalThis.__journeyModel(o);export const runTranslationTransport=o=>globalThis.__journeyTranslation(o);');
const hooks=registerHooks({resolve(specifier,context,next){return specifier==='@/lib/model-transport'?{url:stub,shortCircuit:true}:next(specifier,context)}});
const {startMobileTask,readMobileTask,listMobileTasks,mobileDirectory}=await import('../src/lib/mobile-engine.ts');
const {currentCandidateVersion,currentAnalysis}=await import('../src/lib/mobile-history.ts');
const {getProfile,profileFile}=await import('../src/lib/profile-context.ts');
const {prepareV1Display}=await import('../src/lib/v1-display.ts');
const {proxy}=await import('../src/proxy.ts');
const {NextRequest}=await import('next/server.js');
const waitFor=async work=>{let value;for(let i=0;i<400;i++){value=await work();if(value)return value;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for fixture');};
after(()=>{hooks.deregister();delete globalThis.__journeyModel;delete globalThis.__journeyTranslation;if(oldRoot===undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=oldRoot;if(oldPreview===undefined)delete process.env.JOBPILOT_V1_PREVIEW;else process.env.JOBPILOT_V1_PREVIEW=oldPreview;fs.rmSync(root,{recursive:true,force:true});});
let a,b,version,analysis;
test('new simulated sign-ins own empty profiles, not a shared default',async()=>{
  [a,b]=await Promise.all([createPreviewSession(root,"yuki@example.com"),createPreviewSession(root,"mehdi@example.com")]);
  assert.notEqual(a.profileId,b.profileId);assert.notEqual(a.token,b.token);
  for(const session of [a,b]){
    assert.equal(readPreviewSession(root,session.token).profileId,session.profileId);
    assert.equal(fs.readFileSync(profileFile(session.profileId,'cv'),'utf8'),'');
    assert.equal(fs.readFileSync(profileFile(session.profileId,'notes'),'utf8'),'');
    assert.doesNotMatch(fs.readFileSync(profileFile(session.profileId,'config'),'utf8'),/Louis|Global Markets/);
    assert.equal(listMobileTasks(session.profileId).length,0);
  }
  assert.throws(()=>getProfile('louis'),/inconnu/);
});
test('preview auth rejects anonymous, cross-profile and forged admin headers',()=>{
  const req=(profile,headers={})=>new NextRequest('http://localhost/api/mobile'+(profile?'?profileId='+profile:''),{headers:{host:'localhost',...headers}});
  assert.equal(proxy(req('')).status,401);
  assert.equal(proxy(new NextRequest('http://localhost/api/internal/analytics',{headers:{host:'localhost'}})).status,200,'internal analytics reaches its own bearer guard');
  assert.equal(proxy(req(b.profileId,{authorization:'Bearer '+a.token})).status,403);
  const response=proxy(req(a.profileId,{authorization:'Bearer '+a.token,'x-jobpilot-role':'admin','x-jobpilot-profiles':a.profileId+','+b.profileId}));
  assert.equal(response.headers.get('x-middleware-request-x-jobpilot-profiles'),a.profileId);
  assert.equal(response.headers.get('x-middleware-request-x-jobpilot-role'),'user');
});
test('upload commits facts automatically then analyses only that profile, without a raw-text confirmation result',async()=>{
  const file=path.join(mobileDirectory(a.profileId),'uploads','synthetic','source.txt');fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'Yuki Tanaka\nMSc International Business. Export sales support and market research.\nLooking for a first full-time business development role.');
  const task=await startMobileTask(a.profileId,{kind:'ingest',filename:'synthetic.txt',autoImport:true,sourceLanguage:'fr',analysisLanguage:'zh',contractTypes:['Stage','Alternance'],silent:true},file);
  await waitFor(()=>{const t=readMobileTask(a.profileId,task.id);if(t.status==='failed')throw new Error(t.error);return t.status==='completed'&&t;});
  const done=readMobileTask(a.profileId,task.id);
  assert.equal(done.result.imported,true);assert.equal(done.result.proposal,undefined);
  await waitFor(()=>listMobileTasks(a.profileId).find(t=>t.kind==='analysis'&&t.status==='completed'));
  assert.equal(modelCalls,1);assert.doesNotMatch(prompts[0],/Louis|Global Markets/);
  assert.equal(getProfile(a.profileId).name,'Yuki Tanaka');assert.equal(getProfile(b.profileId).name,'');
  assert.equal(fs.readFileSync(profileFile(b.profileId,'cv'),'utf8'),'');
  assert.equal(listMobileTasks(b.profileId).length,0);
  assert.equal(listMobileTasks(a.profileId).filter(t=>t.kind==='search').length,0,'wait for the user to pick a direction');
  assert.throws(()=>readMobileTask(b.profileId,task.id));
  version=currentCandidateVersion(a.profileId);analysis=currentAnalysis(a.profileId,version,listMobileTasks(a.profileId));
  assert.equal(analysis.stale,false);assert.equal(analysis.outputLocale,'en');
  assert.match(version.sources.config.text,/analysis_language: zh/);
  assert.match(version.sources.config.text,/source_language: en/);
  assert.match(version.sources.config.text,/language: fr/);
  assert.match(version.sources.config.text,/contract_types:[\s\S]*Stage[\s\S]*Alternance/);
  assert.match(version.sources.config.text,/contract_policy: confirmed_only/);
  assert.equal(version.sources.notes.text,'');
});
const base=()=>({profile:{id:a.profileId,name:'Yuki Tanaka'},analysis,cvState:{versionId:version.id},v1:{analysisState:'completed',backgroundActive:false},discovery:{offers:[],history:[]}});
test('directions and advantages are withheld until DeepSeek translation is complete',async()=>{
  const initial=await prepareV1Display(a.profileId,'zh',base(),[],{});
  assert.equal(initial.analysis,null);assert.deepEqual(initial.v1.careerDirections,[]);assert.equal(initial.v1.analysisReady,false);
  const done=await waitFor(async()=>{const x=await prepareV1Display(a.profileId,'zh',base(),[],{});return x.v1.analysisReady&&x;});
  assert.match(done.analysis.strengths[0].title,/中文/);assert.match(done.v1.careerDirections[0].title,/中文/);
  assert.equal(done.v1.careerDirections[0].searchQuery,'business developer junior');assert.equal(modelCalls,1);assert.ok(translationCalls>0);
});
test('old CV scores do not enrich a current CV and whole batches wait for all deep matches plus translations',async()=>{
  const offer={url:'https://example.invalid/jobs/export',title:'Export Sales',fastMatch:{score:71},deepMatch:{currentScore:71,cvPotentialScore:78,outputLocale:'en',roleSummary:'Help develop export sales in Europe.',strengths:[{title:'Client communication',evidence:'Supported customers and prepared client reports.'}],capabilityGaps:[]}};
  const old={kind:'deep_match',inputVersionId:'old-cv',status:'completed',input:{url:offer.url},result:{deepMatch:offer.deepMatch}};
  const projected=discoveryProjection({offers:[{...offer,deepMatch:undefined}]},[],currentVersionTasks([old],version.id));
  assert.equal(projected.offers[0].deepMatch,null);
  let snapshot={...base(),discovery:{taskId:'search1',offers:[{...offer,deepMatchState:'ready'},{...offer,url:offer.url+'2',deepMatchState:'loading'}],history:[]}};
  let view=await prepareV1Display(a.profileId,'zh',snapshot,[],{});
  assert.deepEqual(view.discovery.offers,[]);assert.equal(view.v1.offersReady,false);
  snapshot.discovery.offers[1].deepMatchState='ready';
  view=await waitFor(async()=>{const x=await prepareV1Display(a.profileId,'zh',snapshot,[],{});return x.v1.offersReady&&x;});
  assert.equal(view.discovery.offers.length,2);assert.equal(view.discovery.offers[0].deepMatch.currentScore,71);assert.equal(view.discovery.offers[0].deepMatch.cvPotentialScore,78);assert.match(view.discovery.offers[0].deepMatch.strengths[0].title,/中文/);
});
test('language failure hides the whole section and offers an explicit translation retry, not reanalysis',async()=>{
  const changed={...base(),analysis:{...analysis,markdown:'A changed profile summary with a new distinct export angle.'}};
  failTranslation=true;
  const failed=await waitFor(async()=>{const x=await prepareV1Display(a.profileId,'zh',changed,[],{});return x.v1.presentationFailed&&x;});
  assert.equal(failed.analysis,null);assert.deepEqual(failed.v1.careerDirections,[]);
  failTranslation=false;
  await prepareV1Display(a.profileId,'zh',changed,[],{},true);
  const done=await waitFor(async()=>{const x=await prepareV1Display(a.profileId,'zh',changed,[],{});return x.v1.analysisReady&&x;});
  assert.match(done.analysis.markdown,/中文/);assert.equal(modelCalls,1);
});
test('logout revokes the old account without affecting another account; next login starts fresh',async()=>{
  revokePreviewSession(root,a.token);assert.equal(readPreviewSession(root,a.token),null);
  assert.equal(readPreviewSession(root,b.token).profileId,b.profileId);
  const c=await createPreviewSession(root,"third@example.com");assert.notEqual(c.profileId,a.profileId);assert.equal(fs.readFileSync(profileFile(c.profileId,'cv'),'utf8'),'');
  await setProfileDisplayName(root,c.profileId,'Louis Martin','Mehdi Martin');assert.equal(getProfile(c.profileId).name,'');
  assert.equal(getProfile(a.profileId).name,'Yuki Tanaka','logout does not delete or rewrite the previous profile');
});


test('a blank V1 profile searches France and Europe, not the provider default US market',async()=>{
  const {searchRequestFromConfig}=await import('../src/lib/job-search/mobile-context.mjs');
  const {operationKey}=await import('../src/lib/mobile-state.mjs');
  const request=searchRequestFromConfig('business development',{},[],'France');
  assert.equal(request.country,'France');assert.equal(request.city,'');assert.equal(request.flexibleEurope,true);
  assert.equal(searchRequestFromConfig('business development',{location:{country:'Germany',city:'Berlin'}},[],'France').country,'Germany');
  assert.equal(searchRequestFromConfig('business development',{},[]).country,'','legacy search has no forced V1 default');
  assert.notEqual(operationKey('search',{query:'business development',experience:'v1'},{id:'cv'},[]),operationKey('search',{query:'business development'},{id:'cv'},[]));
});


test('a tailored CV uses the same bounded exploration scale as accepting it',async()=>{
 const {v1CvAssessment}=await import('../src/lib/v1-match.mjs');
 const raw={baselineScore:58,draftScore:70,delta:12};const job={v1Match:{currentScore:42,cvPotentialScore:50}};
 assert.deepEqual(v1CvAssessment(job,raw),{baselineScore:42,draftScore:50,delta:8});
 assert.deepEqual(raw,{baselineScore:58,draftScore:70,delta:12});
 assert.equal(v1CvAssessment(job,{...raw,delta:-4}).draftScore,42);
 assert.equal(v1CvAssessment({},raw),raw);
});


test('snapshot exports the real search pipeline progress, translated query label and reuse notice',async()=>{
 const task={id:'s-progress',kind:'search',status:'completed',createdAt:'2026-09-11T10:00:00Z',updatedAt:'2026-09-11T10:00:01Z',inputVersionId:version.id,input:{query:'business developer junior'}};
 const journey={searchTaskId:task.id,query:task.input.query,searchRequestedAt:'2026-09-11T10:20:00Z',searchFeedback:'merged'};
 const offer={url:'https://example.invalid/jobs/progress',title:'Junior Business Developer',fastMatch:{score:35},deepMatchState:'loading'};
 const snapshot={...base(),discovery:{taskId:task.id,query:task.input.query,availableCount:1,offers:[offer],history:[]}};
 let value=await prepareV1Display(a.profileId,'zh',snapshot,[task],journey);
 assert.equal(value.v1.searchProgress.status,'running');assert.equal(value.v1.searchProgress.createdAt,journey.searchRequestedAt);
 assert.deepEqual(value.discovery.offers,[]);
 offer.deepMatchState='ready';offer.deepMatch={currentScore:70,cvPotentialScore:80,roleSummary:'Develop business opportunities.',outputLocale:'en',strengths:[],capabilityGaps:[]};
 value=await waitFor(async()=>{const x=await prepareV1Display(a.profileId,'zh',snapshot,[task],journey);return x.v1.offersReady&&x;});
 assert.equal(value.v1.searchProgress.status,'completed');assert.match(value.v1.journey.label,/业务/);assert.match(value.v1.searchNotice,/已并入/);
 assert.equal(value.discovery.offers[0].matchScore.current,70);
 const next={...task,id:'new-search',status:'running'};
 value=await prepareV1Display(a.profileId,'zh',snapshot,[next,task],{...journey,searchTaskId:next.id});
 assert.equal(value.v1.searchProgress.status,'running','an earlier ready batch cannot complete the new request');
 assert.equal(value.v1.offersReady,false);
});
