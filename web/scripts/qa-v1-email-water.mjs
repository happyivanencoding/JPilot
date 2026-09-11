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
  const output={candidateName:'Amina Diallo',markdown:'Your studies open several early-career directions.',strengths:[{title:'Research and analysis',evidence:'Your university projects show research experience.'}],growthAreas:[{title:'Build a portfolio',nextAction:'Choose one university project to describe in detail.'}],careerDirections:[{title:'Research assistant',why:'Explore research roles.',evidence:['University studies'],searchQuery:'research assistant'}],searchKeywords:['research assistant'],suggestedContracts:[]};
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}],usage:{prompt_tokens:500,completion_tokens:150,total_tokens:650}}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const modelPort=server.address().port,port=19315,base=`http://127.0.0.1:${port}`;
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
  await page.getByTestId('onboarding-cv-input').setInputFiles(cv);
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
  await context.request.post(base+'/api/v1/session',{data:{action:'logout'}});await page.goto(base);
  await input.fill('another-student@example.com');await page.getByTestId('preview-login').click();
  await page.getByTestId('onboarding-cv-input').waitFor({state:'attached'});
  const next=await (await context.request.get(base+'/api/v1/session')).json();
  assert.notEqual(next.profileId,session.profileId);
  const empty=await (await context.request.get(base+'/api/mobile?profileId='+next.profileId)).json();assert.equal(empty.cv,'');
  assert.equal((await context.request.get(base+'/api/mobile?profileId='+session.profileId)).status(),403);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify({ok:true,model:'controlled local fixture, not live AI',realPdf: path.basename(cv),modelCalls,contractsPersisted:['Stage'],progressSamples:[first,second,100],emailPersistence:true,returningHome:true,newEmailEmpty:true,errors},null,2));
  console.log('PASS: real PDF import + fixture analysis; animated full-screen water -> 100 -> directions; logout -> email; same email -> same CV/workspace; another email isolated.');
  console.log('Artifacts:',artifacts);
} finally {
  fs.writeFileSync(path.join(artifacts,'server.log'),log);
  await browser?.close();app.kill();server.closeAllConnections();server.close();
}
