// Isolated browser acceptance. The app, PDF extraction and account persistence
// are real; only model responses are controlled fixtures. Never uses API keys.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const cv=process.argv[2];
if(!cv||!fs.existsSync(cv))throw new Error('Pass an existing synthetic PDF path.');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jpilot-v1-water-'));
const artifacts=path.resolve(process.env.QA_ARTIFACT_DIR || '../.career-ops-web/qa-v1-email-water');
fs.mkdirSync(artifacts,{recursive:true});
let modelCalls=0;
const server=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  const request=JSON.parse(raw),prompt=request.messages?.at(-1)?.content || '';
  assert.match(prompt,/Amina/i);modelCalls++;
  await new Promise(r=>setTimeout(r,8500));
  const output=prompt.includes('SCORING METHOD anchored-4x4-v1')?{scoring_version:'role-fit-2',scoring_method:'anchored-4x4-v1',ratings:{role:3,duties:3,tools_languages:2,level:4},score_rationale:Object.fromEntries(['role','duties','tools_languages','level'].map(key=>[key,{reason:key==='level'?'The stated student level fits.':'Relevant university work provides a foundation; some practical tasks remain to be developed.',job_evidence:'Student research and data tasks',cv_evidence:'University projects',unknown:false}])),role_summary:'Research and data support in a supervised student role.',responsibilities:['Process data and document results.'],requirements:[],tools:['SQL'],strengths:[],presentation_gaps:[],capability_gaps:[],cv_potential_score:84}:{candidateName:'Amina Diallo',markdown:'Your studies open several early-career directions.',strengths:[{title:'Research and analysis',evidence:'Your university projects show research experience.'}],growthAreas:[{title:'Build a portfolio',nextAction:'Choose one university project to describe in detail.'}],careerDirections:['Sustainability Data Analyst','Environmental Economist','ESG Consulting Analyst','Public Policy Evaluation Analyst'].map(title=>({title,why:'Relevant university work.',evidence:['University studies'],searchQuery:title})),searchKeywords:['research assistant'],suggestedContracts:[]};
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}],usage:{prompt_tokens:500,completion_tokens:150,total_tokens:650}}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const modelPort=server.address().port,port=19317,base=`http://127.0.0.1:${port}`;
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  cwd:process.cwd(),env:{...process.env,CAREER_OPS_ROOT:root,JOBPILOT_V1_PREVIEW:'1',JOBPILOT_MODEL_TRANSPORT:'direct-openai',OPENAI_API_KEY:'synthetic-local-fixture-only',DEEPSEEK_API_KEY:'synthetic-local-fixture-only',JOBPILOT_OPENAI_CHAT_URL:`http://127.0.0.1:${modelPort}/model`,JOBPILOT_DEEPSEEK_CHAT_URL:`http://127.0.0.1:${modelPort}/translation`},stdio:['ignore','pipe','pipe']});
let log='';app.stdout.on('data',b=>log+=b);app.stderr.on('data',b=>log+=b);
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,locale:'en-US',extraHTTPHeaders:{'X-JobPilot-Locale':'en'}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const input=page.getByTestId('preview-email');await input.waitFor({state:'visible'});
  await input.fill('not-an-email');assert.ok(await page.getByTestId('preview-login').isDisabled());
  await input.fill('water-student@example.com');await input.press('Enter');
  await page.getByTestId('onboarding-cv-input').waitFor({state:'attached'});
  const session=await (await context.request.get(base+'/api/v1/session')).json();
  assert.equal(await page.getByTestId('onboarding-logout').count(),0);
  assert.ok(await page.getByTestId('onboarding-upload').isDisabled());
  await page.getByTestId('onboarding-contract-Stage').click();
  assert.equal(await page.getByTestId('onboarding-upload').isDisabled(),false);
  await page.screenshot({path:path.join(artifacts,'contract-before-cv.png')});
  const denied=await context.request.post(base+'/api/mobile/upload?profileId='+session.profileId,{multipart:{file:{name:'synthetic.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(cv)},contractTypes:'["Stage"]'}});
  assert.equal(denied.status(),428);
  assert.equal((await (await context.request.get(base+'/api/mobile?profileId='+session.profileId)).json()).cv,'');
  await page.getByTestId('onboarding-upload').click();await page.getByTestId('cv-privacy-dialog').waitFor();
  assert.equal(await page.getByTestId('privacy-ack').isChecked(),false);assert.ok(await page.getByTestId('privacy-accept').isDisabled());
  const notice=await (await context.request.get(base+'/api/v1/privacy')).json();
  assert.equal((await context.request.post(base+'/api/v1/privacy',{data:{action:'accept',version:notice.notice.version,acknowledged:false}})).status(),400);
  await page.screenshot({path:path.join(artifacts,'privacy-unchecked.png')});
  await page.getByTestId('cv-privacy-dialog').getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(modelCalls,0);
  await page.getByTestId('onboarding-upload').click();await page.getByTestId('privacy-ack').check();
  const picker=page.waitForEvent('filechooser');await page.getByTestId('privacy-accept').click();await (await picker).setFiles(cv);
  const consent=await (await context.request.get(base+'/api/v1/privacy')).json();assert.equal(consent.record.version,notice.notice.version);assert.ok(consent.record.acceptedAt);

  await page.getByTestId('cv-analysis-progress').waitFor({state:'visible'});
  await page.waitForTimeout(2200);
  const first=Number(await page.getByTestId('cv-water').getAttribute('data-level'));
  const wave=await page.locator('.jp-cv-wave.front').evaluate(el=>getComputedStyle(el).transform);
  await page.waitForTimeout(1000);
  const second=Number(await page.getByTestId('cv-water').getAttribute('data-level'));
  assert.ok(first>0&&second>=first&&second<100);
  assert.notEqual(await page.locator('.jp-cv-wave.front').evaluate(el=>getComputedStyle(el).transform),wave);
  await page.screenshot({path:path.join(artifacts,'water-running.png')});
  await page.waitForFunction(()=>document.querySelector('[data-testid="cv-water"]')?.getAttribute('data-level')==='100',{},{timeout:40000,polling:40});
  await page.getByText('Which direction interests you?',{exact:true}).waitFor({state:'visible'});
  const own=await (await context.request.get(base+'/api/mobile?profileId='+session.profileId)).json();
  assert.match(own.cv,/Amina/i);assert.equal(own.v1.analysisReady,true);
  assert.equal(modelCalls,1);
  assert.deepEqual(own.v1.careerDirections.map(d=>d.title),['Data analyst','Economist','ESG analyst','Policy analyst']);
  assert.deepEqual(own.v1.careerDirections.map(d=>d.searchQuery),['data analyst','economiste','analyste ESG','analyste politiques publiques']);
  await page.screenshot({path:path.join(artifacts,'broad-directions.png')});
  assert.deepEqual(own.config.target_roles.contract_types,['Stage']);
  assert.equal(await page.getByTestId('onboarding-logout').count(),0);
  await context.request.post(base+'/api/v1/session',{data:{action:'logout'}});await page.goto(base);
  await input.waitFor({state:'visible'});assert.equal(await input.inputValue(),'');
  await page.screenshot({path:path.join(artifacts,'email-entry.png')});
  await input.fill(' WATER-STUDENT@EXAMPLE.COM ');await page.getByTestId('preview-login').click();
  await page.getByTestId('home-page').waitFor({state:'visible'});
  assert.equal(await page.getByTestId('v1-first-run').count(),0);
  const returned=await (await context.request.get(base+'/api/v1/session')).json();
  assert.equal(returned.profileId,session.profileId);
  const restored=await (await context.request.get(base+'/api/mobile?profileId='+returned.profileId)).json();
  assert.equal(restored.cv,own.cv);assert.equal(restored.v1.journey.completed,true);assert.equal(modelCalls,1);
  await page.screenshot({path:path.join(artifacts,'returning-home.png')});
  await page.goto(base+'/?tab=profile');
  await page.getByTestId('material-language-fr').waitFor({state:'visible'});
  assert.equal(await page.getByTestId('separate-insights').count(),1);
  await page.screenshot({path:path.join(artifacts,'unified-languages.png')});
  const offer={url:'https://example.com/qa-student-role',title:'Research and Data Assistant',company:'Synthetic QA',contractType:'Stage',location:'Paris',description:'Student research and data tasks',fastMatch:{score:25}};
  const scoreInput={kind:'deep_match',url:offer.url,offer,fastMatch:offer.fastMatch,silent:true};
  let scored=await (await context.request.post(base+'/api/mobile',{data:{action:'task',profileId:session.profileId,input:scoreInput}})).json();
  const taskId=scored.id;
  for(let i=0;i<40&&scored.status!=='completed';i++){assert.notEqual(scored.status,'failed');await page.waitForTimeout(400);scored=await (await context.request.post(base+'/api/mobile',{data:{action:'task',profileId:session.profileId,input:scoreInput}})).json();assert.equal(scored.id,taskId);}
  assert.equal(scored.status,'completed');assert.equal(scored.result.deepMatch.currentScore,76);assert.equal(modelCalls,2);
  // Seed only the local synthetic search ledger; all UI/API writes below are real.
  const now=new Date().toISOString();
  const taskRoot=path.join(root,'.career-ops-web','profiles',session.profileId,'mobile','tasks');
  const search={id:'e1480000-0000-4000-8000-000000000001',kind:'search',status:'completed',profileId:session.profileId,inputVersionId:own.cvState.versionId,
    operationKey:'search-v8-v1-directions-qa',input:{experience:'v1',query:'research assistant',silent:true},createdAt:now,updatedAt:now,
    result:{offers:[offer],query:'research assistant',providerRuns:[],stats:{finalCount:1}}};
  fs.writeFileSync(path.join(taskRoot,search.id+'.json'),JSON.stringify(search));
  await page.goto(base+'/?tab=offers');await page.locator('.jp-v1-role-card:visible').first().waitFor();await page.locator('.jp-v1-role-card:visible').first().click();
  await page.getByTestId('job-tab-0').waitFor();
  assert.equal(await page.locator('[role="tab"]').count(),3);assert.equal(await page.locator('.jp-tabs .jp-tab-locked').count(),1);
  assert.equal((await (await context.request.get(base+'/api/mobile?profileId='+session.profileId)).json()).jobs.length,0);
  await page.getByTestId('job-tab-1').click();assert.ok(await page.getByTestId('generate-role-cv').isVisible());assert.equal(modelCalls,2);
  await page.screenshot({path:path.join(artifacts,'cv-locked.png')});
  await page.getByTestId('job-tab-2').click();await page.getByLabel('My notes',{exact:true}).fill('Synthetic tracking note; no AI requested');
  await page.getByTestId('save-tracking').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="save-tracking"]')&&!document.querySelector('[aria-busy="true"]'));
  let tracked;
  for(let i=0;i<20;i++){tracked=await (await context.request.get(base+'/api/mobile?profileId='+session.profileId)).json();if(tracked.jobs.length)break;await page.waitForTimeout(200);}
  const saved={job:tracked.jobs[0]};assert.equal(saved.job.followup.note,'Synthetic tracking note; no AI requested');
  assert.equal(modelCalls,2);assert.equal(tracked.tasks.filter(t=>t.kind==='cv').length,0);
  assert.equal(await page.getByTestId('offer-detail').count(),1);assert.equal(await page.getByTestId('job-tab-2').getAttribute('aria-selected'),'true');
  await page.screenshot({path:path.join(artifacts,'tracking-no-ai.png')});
  await page.getByTestId('job-tab-0').click();await page.getByTestId('match-breakdown').waitFor();
  assert.match(await page.getByTestId('match-breakdown').innerText(),/76\/100/);
  assert.ok(saved.job?.id);
  await page.goto(base+'/?tab=profile&view=job&job='+encodeURIComponent(saved.job.id)+'&jobTab=0');
  await page.getByTestId('match-breakdown').waitFor();assert.equal(await page.locator('.jp-score-criterion').count(),4);
  assert.match(await page.getByTestId('match-breakdown').innerText(),/100.*24.*76\/100/s);
  await page.waitForTimeout(900);await page.screenshot({path:path.join(artifacts,'score-breakdown.png')});
  await page.goto(base+'/?tab=profile');await page.getByTestId('privacy-link').waitFor();

  await page.getByTestId('privacy-link').click();await page.getByTestId('cv-privacy-dialog').waitFor();
  await page.getByRole('button',{name:'Withdraw consent and request deletion',exact:true}).click();
  await page.getByTestId('privacy-withdraw-confirm').click();await page.getByText('Withdrawal and deletion request recorded, pending administrator action. New uploads and AI tasks are blocked.',{exact:true}).waitFor();
  await page.screenshot({path:path.join(artifacts,'withdrawal-pending.png')});
  const withdrawn=await (await context.request.get(base+'/api/v1/privacy')).json();assert.equal(withdrawn.record.deletionStatus,'pending');
  assert.equal((await context.request.post(base+'/api/mobile/upload?profileId='+session.profileId,{multipart:{file:{name:'synthetic.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(cv)}}})).status(),428);
  assert.equal((await context.request.post(base+'/api/mobile',{data:{action:'task',profileId:session.profileId,input:{kind:'analysis'}}})).status(),400);
  assert.equal((await (await context.request.get(base+'/api/mobile?profileId='+session.profileId)).json()).cv,own.cv);
  await page.getByTestId('cv-privacy-dialog').getByRole('button',{name:'Close',exact:true}).click();

  await context.request.post(base+'/api/v1/session',{data:{action:'logout'}});await page.goto(base);
  await input.fill('another-student@example.com');await page.getByTestId('preview-login').click();
  await page.getByTestId('onboarding-cv-input').waitFor({state:'attached'});
  const next=await (await context.request.get(base+'/api/v1/session')).json();
  assert.notEqual(next.profileId,session.profileId);
  const empty=await (await context.request.get(base+'/api/mobile?profileId='+next.profileId)).json();assert.equal(empty.cv,'');
  assert.equal((await context.request.get(base+'/api/mobile?profileId='+session.profileId)).status(),403);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify({ok:true,model:'controlled local fixture, not live AI',realPdf: path.basename(cv),modelCalls,broadDirections:true,unifiedTabs:true,trackingWithoutAi:true,cvLockedUntilExplicitGeneration:true,scoreBreakdown:[23,23,10,20],repeatedScoringTaskReused:true,consentRecorded:true,uncheckedUploadBlocked:true,withdrawalPending:true,newAiBlockedAfterWithdrawal:true,contractsPersisted:['Stage'],progressSamples:[first,second,100],emailPersistence:true,returningHome:true,newEmailEmpty:true,errors},null,2));
  console.log('PASS: mandatory unchecked notice -> persisted consent -> file chooser; withdrawal blocks new uploads/AI without pretending to erase; real PDF import + fixture analysis; animated full-screen water -> 100 -> directions; logout -> email; same email -> same CV/workspace; another email isolated.');
  console.log('Artifacts:',artifacts);
} finally {
  fs.writeFileSync(path.join(artifacts,'server.log'),log);
  await browser?.close();app.kill();server.closeAllConnections();server.close();
}
