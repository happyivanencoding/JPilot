// Isolated synthetic acceptance: real app/API/PDFs; controlled model and provider.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {translationLooksLikeTarget} from '../src/lib/localization-core.mjs';
const cv=path.resolve(process.argv[2]||'../.career-ops-web/v146-delivery/Synthetic_Amina_QA.pdf');
assert.ok(fs.existsSync(cv),'Pass a synthetic PDF path');
const root=process.env.QA_RESUME_ROOT || fs.mkdtempSync(path.join(os.tmpdir(),'onward-qa-'));
const artifacts=path.resolve(process.env.QA_ARTIFACT_DIR||'../.career-ops-web/qa-onward');
fs.mkdirSync(artifacts,{recursive:true});
let modelCalls=0,providerCalls=0;const modelKinds=[],errors=[],analyticsRequests=[];
const payload={summary:'Computer Science master student with Java REST API and PostgreSQL project experience, seeking a software development internship.',experience:[],projects:[{name:'Community reservation platform',description:'Built a Java REST API with authentication, unit tests and PostgreSQL. Worked in a five-person team using Git reviews and project documentation.',tech:'Java, PostgreSQL'},{name:'Student hackathon',description:'Contributed a Python backend prototype in 36 hours; team technical jury prize.',tech:'Python'}],education:[{title:'Master Computer Science',org:'Sorbonne Universite, Paris',year:'2025 - 2027',description:'Algorithms, systems, databases and software engineering.'},{title:'Bachelor Computer Science',org:'Universite Paris Cite',year:'2022 - 2025',description:''}],skills:[{category:'Technical skills',items:['Java','Python','TypeScript','SQL','REST APIs','PostgreSQL','Git','Linux','unit tests']},{category:'Languages',items:['French C1','English B2']}],change_notes:['Relevant API project is now immediately visible in the summary.']};
const model=http.createServer(async(req,res)=>{
 try {
  let raw='';for await(const b of req)raw+=b;
  const prompt=JSON.parse(raw).messages?.at(-1)?.content||'';let output,kind;
  if(prompt.includes('Translate SAVED')) {kind='translation';const target=prompt.includes('into French.')?'fr':prompt.includes('into Simplified Chinese.')?'zh':'en';const entries=JSON.parse(prompt.slice(prompt.lastIndexOf('\n')+1));output={translations:entries.map(e=>({id:e.id,text:!translationLooksLikeTarget(e.text,target)?(target==='fr'?'Informations pour le profil et les resultats ':target==='zh'?'已保存的测试信息 ':'Information from the saved result ')+(e.text.match(/⟦P\d+⟧/g)||[]).join(' '):e.text}))};}
  else if(prompt.includes('Review the actual tailored CV against the SAME')) {kind='review';output={raw_draft_score:82,summary:'The API project is easier to find.',improvements:['Summary brings the existing Java and PostgreSQL project forward.'],remaining_gaps:['Limited commercial experience']};}
  else if(prompt.includes('producing the CONTENT for a CV')) {kind='cv';output=payload;}
  else if(prompt.includes('SCORING METHOD anchored-4x4-v1')) {kind='match';output={scoring_version:'role-fit-2',scoring_method:'anchored-4x4-v1',ratings:{role:3,duties:3,tools_languages:2,level:4},score_rationale:Object.fromEntries(['role','duties','tools_languages','level'].map(key=>[key,{reason:'Existing student projects match supervised junior work.',job_evidence:'Java REST API with PostgreSQL',cv_evidence:'Built a Java REST API',unknown:false}])),role_summary:'Build Java APIs with a supervised software team.',responsibilities:['Implement and test Java endpoints.'],requirements:[{title:'Java projects',kind:'must',why:'Daily development work'}],tools:['Java','PostgreSQL'],strengths:[{title:'Java API project',evidence:'Your reservation platform uses the same stack.',impact:4}],presentation_gaps:[{title:'Bring API project forward',why:'Use the summary to surface the relevant project.',potential:6}],capability_gaps:[{title:'Commercial experience',why:'You have student projects rather than commercial delivery.',next_action:'Discuss the teamwork from your reservation platform.',potential:3}],cv_potential_score:84};}
  else if(prompt.includes('Amina')) {kind='analysis';output={candidateName:'Amina Diallo',markdown:'Your Java and Python projects open software development opportunities.',strengths:[{title:'Java and PostgreSQL',evidence:'Your reservation platform uses API development and tests.'}],growthAreas:[],careerDirections:[{title:'Backend developer',why:'Relevant university projects.',evidence:['Java API'],searchQuery:'backend developer'}],searchKeywords:['backend developer Java'],suggestedContracts:['Stage']};}
  else throw new Error('Unexpected controlled model prompt: '+prompt.slice(0,90));
  modelCalls++;modelKinds.push(kind);await new Promise(r=>setTimeout(r,1200));
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}],usage:{prompt_tokens:500,completion_tokens:150,total_tokens:650}}));
 } catch(error) {errors.push(String(error));console.error('QA fixture:',String(error));res.writeHead(500);res.end('Controlled fixture failed');}
});
await new Promise(r=>model.listen(0,'127.0.0.1',r));
const preload=path.join(root,'provider-fixture.mjs');
fs.writeFileSync(preload,`const original=globalThis.fetch;globalThis.fetch=async function(input,options){const u=new URL(typeof input==='string'?input:input.url||String(input));if(u.hostname==='api.openwebninja.com')return Response.json({data:{jobs:[{job_id:'synthetic-java',job_title:'Backend developer Java internship',employer_name:'Synthetic Software QA',job_location:'Paris, France',job_country:'France',job_employment_types:['INTERN'],job_description:'Stage for a Computer Science student. Build Java REST API with PostgreSQL, unit tests and Git in a supervised software team. French or English working language.',job_apply_link:'https://example.test/onward-java',job_posted_at_datetime_utc:new Date().toISOString()}]}});if(!['127.0.0.1','localhost'].includes(u.hostname))throw new Error('QA prevents external requests: '+u.hostname);return original(input,options)};`);
const port=Number(process.env.QA_PORT||19319),base=`http://127.0.0.1:${port}`;
const app=spawn(process.execPath,['--import',pathToFileURL(preload).href,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,CAREER_OPS_ROOT:root,JOBPILOT_V1_PREVIEW:'1',JOBPILOT_MODEL_TRANSPORT:'direct-openai',JOBPILOT_JSEARCH_API_KEY:'synthetic-only',OPENAI_API_KEY:'synthetic-only',DEEPSEEK_API_KEY:'synthetic-only',JOBPILOT_FRANCE_TRAVAIL_CLIENT_ID:'',JOBPILOT_FRANCE_TRAVAIL_CLIENT_SECRET:'',JOBPILOT_OPENAI_CHAT_URL:`http://127.0.0.1:${model.address().port}/model`,JOBPILOT_DEEPSEEK_CHAT_URL:`http://127.0.0.1:${model.address().port}/translation`},stdio:['ignore','pipe','pipe']});
let log='',browser,page;app.stdout.on('data',b=>log+=b);app.stderr.on('data',b=>log+=b);
const result={ok:false,scope:'synthetic-only; real browser/API/import/PDF; model and search provider controlled',root,artifacts};
try {
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,locale:'en-US',extraHTTPHeaders:{'X-JobPilot-Locale':'en'}});
 page=await context.newPage();page.setDefaultTimeout(35000);page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{if(req.url().endsWith('/api/analytics')&&req.method()==='POST')try{analyticsRequests.push(req.postDataJSON());}catch{}});
 if(process.env.QA_RESUME_ROOT) {await resumeAcceptance(context,page);} else {
 await page.goto(base);await page.getByTestId('preview-email').fill('onward-synthetic@example.com');
 assert.ok(await page.locator('.onward-brand[aria-label="Onward"] img.onward-lockup').count());
 await page.waitForTimeout(350);await page.screenshot({path:path.join(artifacts,'01-email.png')});
 await page.getByTestId('preview-login').click();await page.getByTestId('onboarding-cv-input').waitFor({state:'attached'});
 const session=await(await context.request.get(base+'/api/v1/session')).json();
 assert.equal(await page.locator('details[data-analytics="language_options"]').getAttribute('open'),null);
 await page.getByTestId('onboarding-contract-Stage').click();await page.screenshot({path:path.join(artifacts,'02-upload-auto.png')});
 const denied=await context.request.post(base+'/api/mobile/upload',{multipart:{file:{name:'synthetic.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(cv)},contractTypes:'["Stage"]'}});assert.equal(denied.status(),428);
 await page.getByTestId('onboarding-upload').click();await page.getByTestId('privacy-ack').check();
 const chooser=page.waitForEvent('filechooser');await page.getByTestId('privacy-accept').click();await(await chooser).setFiles(cv);
 await page.getByTestId('cv-analysis-progress').waitFor();await page.screenshot({path:path.join(artifacts,'03-cv-wait.png')});
 await Promise.race([page.getByText('Which direction interests you?',{exact:true}).waitFor(),page.getByTestId('first-search-progress').waitFor()]);console.log('QA analysis complete');
 let snapshot=await(await context.request.get(base+'/api/mobile')).json();assert.match(snapshot.cv,/Amina/);assert.equal(snapshot.config.cv.language,'en');assert.equal(snapshot.config.cv.source_language,'en');assert.equal(snapshot.config.display.analysis_language,'en');
 const taskRoot=path.join(root,'.career-ops-web','profiles',session.profileId,'mobile','tasks');
 const tasks=()=>fs.readdirSync(taskRoot).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(taskRoot,n),'utf8')));
 assert.equal(tasks().find(t=>t.kind==='ingest').input.sourceLanguage,'auto');
 if(await page.getByTestId('onboarding-search').isVisible()){await page.locator('.jp-v1-direction-choice button').first().click();await page.getByTestId('onboarding-search').click();}
 await page.getByTestId('first-search-progress').waitFor();await page.screenshot({path:path.join(artifacts,'04-search-wait.png')});
 await page.locator('.jp-v1-swipe-card').first().waitFor({timeout:90000});
 const preparedTask=tasks().find(t=>t.kind==='deep_match'&&t.status==='completed');assert.ok(preparedTask.result.preparedCv);assert.equal(preparedTask.result.deepMatch.preparedCvScore,82);
 console.log('QA prepared CV verified');const callsBeforeGenerate=modelKinds.filter(k=>k!=='translation').length;await page.screenshot({path:path.join(artifacts,'05-results.png')});
 await page.locator('.jp-v1-swipe-card').first().click();await page.getByTestId('job-tab-0').waitFor();
 assert.equal(await page.locator('[data-testid^="job-tab-"]').count(),3);assert.equal(await page.locator('[data-testid^="onboarding-"]').count(),0);
 await page.locator('.jp-sheet-content').evaluate(el=>{el.scrollTop=el.scrollHeight;});await page.waitForTimeout(300);await page.screenshot({path:path.join(artifacts,'06-match.png')});
 await page.getByTestId('job-tab-1').click();await page.getByTestId('generate-role-cv').click();
 await page.getByTestId('preview-tailored-draft').waitFor({timeout:90000});
 console.log('QA generated PDF ready');snapshot=await(await context.request.get(base+'/api/mobile')).json();const job=snapshot.jobs[0];
 assert.equal(modelKinds.filter(k=>k!=='translation').length,callsBeforeGenerate);assert.deepEqual(job.cvDraft.payload,preparedTask.result.preparedCv.payload);assert.equal(job.cvOutcome.score,82);
 await page.screenshot({path:path.join(artifacts,'07-cv-ready.png')});
 const pdfResponse=await context.request.get(base+'/api/candidatures/cv?id='+job.id+'&draftId='+job.cvDraft.id);assert.equal(pdfResponse.status(),200);const pdfBytes=await pdfResponse.body();assert.equal(pdfBytes.subarray(0,5).toString(),'%PDF-');result.generatedPdfBytes=pdfBytes.length;
 if(!process.env.QA_SKIP_PDF){
 await page.getByTestId('preview-tailored-draft').click();await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor();
 assert.equal(await page.getByTestId('role-cv-compare').getByRole('button').count(),2);assert.doesNotMatch(await page.getByTestId('role-cv-compare').innerText(),/highlight|diff/i);
 await page.screenshot({path:path.join(artifacts,'08-clean-role-pdf.png')});
 const originalResponse=page.waitForResponse(r=>r.url().includes('compare=baseline')&&r.status()===200);await page.getByRole('button',{name:'Original CV',exact:true}).click();await originalResponse;await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor();await page.screenshot({path:path.join(artifacts,'09-original-pdf.png')});
 }
 await page.goto(base+'/?tab=profile&view=job&job='+job.id+'&jobTab=2');await page.getByLabel('Current stage',{exact:true}).selectOption('Entretien');
 await page.getByLabel('My notes',{exact:true}).fill('SYNTHETIC PRIVATE NOTE NOT ANALYTICS');
 await page.getByLabel('Paste or summarize the reply',{exact:true}).fill('SYNTHETIC PRIVATE REPLY NOT ANALYTICS');
 await page.getByTestId('job-tab-0').click();await page.getByTestId('job-tab-2').click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="tracking-save-state"]')?.textContent.includes('Saved automatically'));
 snapshot=await(await context.request.get(base+'/api/mobile')).json();const tracked=snapshot.jobs.find(j=>j.id===job.id);
 assert.equal(tracked.status,'Entretien');assert.equal(tracked.followup.note,'SYNTHETIC PRIVATE NOTE NOT ANALYTICS');assert.equal(tracked.followup.replyNote,'SYNTHETIC PRIVATE REPLY NOT ANALYTICS');assert.equal(tracked.replies?.length||0,0);
 await page.screenshot({path:path.join(artifacts,'10-tracking-saved.png')});
 await page.goto(base+'/?tab=home');await page.getByTestId('home-page').waitFor();await page.waitForTimeout(2500);await page.screenshot({path:path.join(artifacts,'11-home.png')});
 const analytics=await(await context.request.get(base+'/api/analytics')).json();
 assert.ok(analytics.events>0,'Analytics API must contain persisted events');assert.ok(analytics.funnel.every(s=>s.users===1),'Ordered persisted funnel must reach Tracking');
 const observed=new Set(analytics.funnel.filter(s=>s.users>0).map(s=>s.step));
 const expected=['login','upload_cv','choose_direction','view_jobs','open_job','view_cv','generate_cv','tracking'];
 assert.deepEqual(expected.filter(step=>!observed.has(step)),[],'All funnel milestones should be emitted by the real UI');
 const eventKinds=new Set(analyticsRequests.flatMap(b=>(b.events||[]).map(e=>e.event)));assert.ok(eventKinds.has('page_enter')&&eventKinds.has('page_exit')&&eventKinds.has('click')&&eventKinds.has('ai_wait'));
 const body=JSON.stringify({analyticsRequests,analytics});assert.doesNotMatch(body,/SYNTHETIC PRIVATE|Amina|onward-synthetic@|REST API/);
 const context2=await browser.newContext({viewport:{width:430,height:932},locale:'en-US'});
 await context2.request.post(base+'/api/v1/session',{data:{action:'login',email:'onward-other@example.com'}});
 assert.equal((await context2.request.get(base+'/api/mobile?profileId='+session.profileId)).status(),403);
 assert.equal((await context2.request.get(base+'/api/analytics?profileId='+session.profileId)).status(),403);const other=await(await context2.request.get(base+'/api/analytics')).json();assert.equal(other.events,0);
 assert.deepEqual(errors,[]);
 Object.assign(result,{ok:true,modelCalls,modelKinds,autoLanguage:true,realGeneratedPdf:true,browserPdfRendered:!process.env.QA_SKIP_PDF,preparedContentReused:true,score:82,trackingSaved:true,funnel:[...observed],analytics,analyticsHasNoContent:true,profileIsolation:true,errors});
 console.log('ONWARD_QA_OK',JSON.stringify({artifacts,modelCalls,funnel:[...observed]}));
 }
} catch(error) {result.error=String(error);if(page){await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(artifacts,'failure-dom.txt'),await page.locator('body').innerText().catch(()=>''));}throw error;}
finally {fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(artifacts,'server.log'),log);await browser?.close();app.kill();model.closeAllConnections();model.close();}

async function resumeAcceptance(context,page) {
 await context.request.post(base+'/api/v1/session',{data:{action:'login',email:'onward-synthetic@example.com'}});
 const session=await(await context.request.get(base+'/api/v1/session')).json();
 let snapshot=await(await context.request.get(base+'/api/mobile')).json();const job=snapshot.jobs[0];assert.ok(job?.cvDraft?.file);
 const taskRoot=path.join(root,'.career-ops-web','profiles',session.profileId,'mobile','tasks');
 const tasks=fs.readdirSync(taskRoot).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(taskRoot,n),'utf8')));
 const prepared=tasks.find(t=>t.kind==='deep_match'&&t.status==='completed')?.result.preparedCv;
 assert.deepEqual(job.cvDraft.payload,prepared.payload);assert.equal(job.cvOutcome.score,82);assert.equal(tasks.find(t=>t.kind==='ingest').input.sourceLanguage,'auto');
 assert.equal(snapshot.config.cv.source_language,'en');assert.equal(snapshot.config.display.analysis_language,'en');
 const pdfPath='/api/candidatures/cv?id='+job.id+'&draftId='+job.cvDraft.id;
 const originalPdf=await context.request.get(base+pdfPath);assert.equal(originalPdf.status(),200);assert.equal(originalPdf.headers()['content-disposition'],undefined);
 const pdfBytes=await originalPdf.body();assert.equal(pdfBytes.subarray(0,5).toString(),'%PDF-');
 await page.goto(base+'/?tab=profile&view=pdf&job='+job.id+'&draft='+job.cvDraft.id);
 await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor();await page.waitForTimeout(350);
 assert.equal(await page.getByTestId('role-cv-compare').getByRole('button').count(),2);
 await page.screenshot({path:path.join(artifacts,'08-clean-role-pdf.png')});
 const baselineResponse=page.waitForResponse(r=>r.url().includes('compare=baseline')&&r.status()===200);
 await page.getByRole('button',{name:'Original CV',exact:true}).click();await baselineResponse;
 await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor();await page.waitForTimeout(350);
 await page.screenshot({path:path.join(artifacts,'09-original-pdf.png')});
 await page.goto(base+'/?tab=profile&view=job&job='+job.id+'&jobTab=2');await page.getByLabel('Current stage',{exact:true}).selectOption('Entretien');
 await page.getByLabel('My notes',{exact:true}).fill('SYNTHETIC PRIVATE NOTE RESUMED');
 await page.getByLabel('Paste or summarize the reply',{exact:true}).fill('SYNTHETIC PRIVATE REPLY RESUMED');
 await page.getByTestId('job-tab-0').click();await page.getByTestId('job-tab-2').click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="tracking-save-state"]')?.textContent.includes('Saved automatically'));
 snapshot=await(await context.request.get(base+'/api/mobile')).json();const tracked=snapshot.jobs.find(j=>j.id===job.id);
 assert.equal(tracked.status,'Entretien');assert.equal(tracked.followup.note,'SYNTHETIC PRIVATE NOTE RESUMED');assert.equal(tracked.followup.replyNote,'SYNTHETIC PRIVATE REPLY RESUMED');assert.equal(tracked.replies?.length||0,0);
 await page.screenshot({path:path.join(artifacts,'10-tracking-saved.png')});await page.goto(base+'/?tab=home');await page.getByTestId('home-page').waitFor();await page.waitForTimeout(2000);
 const analytics=await(await context.request.get(base+'/api/analytics')).json();assert.ok(analytics.events>0);assert.equal(analytics.funnel.length,8);assert.ok(analytics.funnel.every(s=>s.users===1));
 assert.doesNotMatch(JSON.stringify(analytics),/SYNTHETIC PRIVATE|Amina|onward-synthetic@|REST API/);
 const other=await browser.newContext({locale:'en-US'});await other.request.post(base+'/api/v1/session',{data:{action:'login',email:'onward-other@example.com'}});
 assert.equal((await other.request.get(base+'/api/mobile?profileId='+session.profileId)).status(),403);assert.equal((await other.request.get(base+'/api/analytics?profileId='+session.profileId)).status(),403);
 assert.equal((await(await other.request.get(base+'/api/analytics')).json()).events,0);
 assert.ok(modelKinds.every(k=>k==='translation'),'Resume must not trigger business model work');assert.deepEqual(errors,[]);
 Object.assign(result,{ok:true,resumed:true,modelCalls,modelKinds,autoLanguage:true,realGeneratedPdf:true,generatedPdfBytes:pdfBytes.length,browserPdfRendered:true,preparedContentReused:true,score:82,trackingSaved:true,funnel:analytics.funnel,analytics,analyticsHasNoContent:true,profileIsolation:true,errors});
 console.log('ONWARD_QA_OK',JSON.stringify({artifacts,resumed:true,modelCalls,events:analytics.events,funnel:analytics.funnel}));
}
