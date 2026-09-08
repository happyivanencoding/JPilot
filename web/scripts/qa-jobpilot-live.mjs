// Read-only production smoke. No business POST, upload, evaluation or CV decision is permitted.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
import { legacyDestination } from '../src/components/jobpilot/model.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const engine=process.env.JOBPILOT_QA_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const out=path.join(root,'.career-ops-web/mobile-qa/web-parity-20260908',process.env.JOBPILOT_QA_LABEL || 'live');fs.mkdirSync(out,{recursive:true});
const base=process.env.JOBPILOT_QA_BASE || 'http://127.0.0.1:3000';
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/profiles.json'),'utf8')).profiles;
const profile=registry.find(p=>p.id===process.env.JOBPILOT_QA_PROFILE)||registry.find(p=>/PROFIL TEST|SYNTHETIC|PROFIL FICTIF/i.test(p.name));
if(!profile)throw new Error('Select a synthetic reference profile for live visual acceptance.');
const beforeFile=path.join(root,'.career-ops-web/mobile-qa/web-parity-20260908/source-bytes-before.json');
const baseline=JSON.parse(fs.readFileSync(beforeFile,'utf8').replace(/^\ufeff/,''));
const baselineCheck=()=>Object.entries(baseline).map(([file,bytes])=>({file,unchanged:fs.existsSync(path.join(root,file))&&fs.readFileSync(path.join(root,file)).equals(Buffer.from(bytes,'base64'))}));
const inventory=()=>{const data=[];for(const p of registry){const d=path.join(root,'.career-ops-web/profiles',p.id,'mobile/tasks');if(!fs.existsSync(d))continue;for(const f of fs.readdirSync(d).filter(x=>x.endsWith('.json'))){const t=JSON.parse(fs.readFileSync(path.join(d,f),'utf8'));if(t.id&&t.kind)data.push({profileId:p.id,id:t.id,kind:t.kind,status:t.status});}}return data;};
const tasksBefore=inventory();const results={readOnly:true,checks:[],businessWrites:0,jsErrors:[],responseErrors:[]};
let browser,page;
const check=async(name,fn)=>{await fn();results.checks.push({name,pass:true});console.log('PASS '+name);};
try{
  browser=engine === 'webkit' ? await webkit.launch({headless:true}) : await chromium.launch({executablePath:process.env.JOBPILOT_QA_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:process.env.JOBPILOT_QA_HEADED !== '1'});
  results.browser=await browser.version(); results.engine=engine; results.headed=process.env.JOBPILOT_QA_HEADED === '1';
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
  await context.addCookies([{name:'career-ops-profile',value:profile.id,url:base,httpOnly:true,sameSite:'Lax'}]);
  await context.addInitScript(()=>{localStorage.setItem('jobpilot:language','zh');localStorage.setItem('jobpilot:theme','light');});
  await context.route('**/api/**',async route=>{if(route.request().method()!=='GET'){results.businessWrites++;return route.abort('blockedbyclient');}return route.continue();});
  page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>results.jsErrors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)results.responseErrors.push({path:new URL(r.url()).pathname,status:r.status()});});
  const id=n=>page.getByTestId(n);const shot=async name=>id('jobpilot-phone').screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
  const snapshotPromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/mobile'&&!new URL(r.url()).searchParams.has('taskId'));
  await page.goto(base);const snapshot=await (await snapshotPromise).json();
  await check('production root loads the saved synthetic reference and exact portrait frame',async()=>{
    assert.equal(snapshot.profile.id,profile.id);await id('home-page').waitFor({state:'visible'});assert.equal(await page.title(),'JobPilot');
    const b=await id('jobpilot-phone').boundingBox();assert.equal(b.width,384);assert.equal(b.height,832);assert.ok(Array.isArray(snapshot.jobs));
    results.savedRoleCount=snapshot.jobs.length;results.backendVersion=snapshot.version;results.localizationPending=Boolean(snapshot.localization?.pending);await shot('real-home-zh');
  });
  await check('saved jobs and backend action-set counts are displayed without re-evaluation',async()=>{
    await id('metric-high').click();await id('applications-page').waitFor({state:'visible'});assert.equal(Number(await id('applications-page').getAttribute('data-count')),snapshot.dashboard.actionSets.high.length);
    await id('filter-all').click();assert.equal(Number(await id('applications-page').getAttribute('data-count')),snapshot.jobs.length);await shot('real-applications-zh');
  });
  await check('saved analysis opens through the production API without a business task',async()=>{
    await id('nav-profile').click();await id('profile-page').waitFor({state:'visible'});await id('view-analysis').click();await id('analysis-sheet').waitFor({state:'visible'});await shot('real-analysis-zh');await id('close-sheet').click();await page.locator('.jp-overlay').waitFor({state:'hidden'});
  });
  await check('canonical master CV is a rendered real production PDF',async()=>{
    await id('view-master-pdf').click();await id('pdf-preview').waitFor({state:'visible'});await Promise.race([page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor({timeout:95000}),page.locator('.jp-error').waitFor({state:'visible',timeout:95000}).then(async()=>{throw new Error('PDF preview: '+await page.locator('.jp-error').innerText());})]);
    assert.ok(await page.locator('.jp-pdf-page canvas').first().evaluate(c=>c.width>0&&c.height>0));results.pdfPageCount=await page.locator('.jp-pdf-page').count();await shot('real-master-pdf');await id('close-sheet').click();
  });
  await check('production mobile-size viewport remains readable and does not overflow',async()=>{
    await page.setViewportSize({width:390,height:844});await id('nav-home').click();await shot('real-phone-size');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  });
  await check('direct CV GET remains explicitly scoped despite another profile cookie',async()=>{
    const other=registry.find(p=>p.id!==profile.id);const response=await fetch(base+'/api/cv?profileId='+encodeURIComponent(profile.id),{headers:{Cookie:'career-ops-profile='+other.id,'X-JobPilot-Locale':'zh'}});assert.equal(response.status,200);const value=await response.json();
    assert.equal(value.content,fs.readFileSync(path.join(root,profile.cvMarkdown),'utf8'));
  });
  await check('old production routes redirect and the same LAN proxy serves JobPilot',async()=>{
    for(const name of ['analytics','apply','candidatures','config','cv','explore','followups','jobs','pipeline','portals']){const r=await fetch(base+'/'+name,{redirect:'manual'});assert.ok([307,308].includes(r.status));assert.equal(r.headers.get('location'),legacyDestination('/'+name));}
    const config=JSON.parse(fs.readFileSync(path.join(root,'.career-ops-web/lan-demo.json'),'utf8').replace(/^\ufeff/,'')); const lan=await fetch(`http://${config.address}:${config.port}/`,{redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(lan.status,200);assert.match(await lan.text(),/<title>JobPilot<\/title>/);
  });
  await check('authentication remains required on the gateway and public origin',async()=>{
    for(const origin of ['http://127.0.0.1:3002','https://jobs.thegreatnovel.com']){const r=await fetch(origin+'/api/mobile',{redirect:'manual',signal:AbortSignal.timeout(15000)});assert.ok([301,302,303,307,308,401,403].includes(r.status),'Unexpected unauthenticated status '+r.status);}
  });
  await check('source data and the selected profile task inventory remain unchanged',async()=>{
    const states=baselineCheck();results.canonicalFiles=states.length;results.unchangedCanonicalFiles=states.filter(x=>x.unchanged).length;
    fs.writeFileSync(path.join(out,'canonical-integrity-private.json'),JSON.stringify(states,null,2));
    // The running product may be used in other profiles while this read-only smoke is active.
    // Assert the selected reference profile, and report rather than overwrite concurrent changes elsewhere.
    const ownedPaths=new Set([profile.cvMarkdown,profile.config,profile.notes,profile.candidatures]);const ownStates=states.filter(x=>ownedPaths.has(x.file));results.selectedCanonicalFiles=ownStates.length;results.unchangedSelectedCanonicalFiles=ownStates.filter(x=>x.unchanged).length;results.concurrentOtherCanonicalChanges=states.filter(x=>!ownedPaths.has(x.file)&&!x.unchanged).length;assert.equal(ownStates.length,4);assert.ok(ownStates.every(x=>x.unchanged));
    const tasksAfter=inventory();results.businessTaskCountBefore=tasksBefore.length;results.businessTaskCountAfter=tasksAfter.length;const ownBefore=tasksBefore.filter(t=>t.profileId===profile.id),ownAfter=tasksAfter.filter(t=>t.profileId===profile.id);results.selectedProfileTasksBefore=ownBefore.length;results.selectedProfileTasksAfter=ownAfter.length;results.concurrentOtherProfileActivity=JSON.stringify(tasksAfter.filter(t=>t.profileId!==profile.id))!==JSON.stringify(tasksBefore.filter(t=>t.profileId!==profile.id));assert.deepEqual(ownAfter,ownBefore);assert.equal(results.businessWrites,0);
  });
  await check('production has no browser exceptions or failed asset/API responses',async()=>{assert.deepEqual(results.jsErrors,[]);assert.deepEqual(results.responseErrors,[]);});
  results.passed=true;
}catch(e){results.passed=false;results.error=e.message;console.error(e.stack);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await browser?.close();fs.writeFileSync(path.join(out,'live-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.passed,checks:results.checks.length,canonicalFiles:results.canonicalFiles,unchanged:results.unchangedCanonicalFiles,businessWrites:results.businessWrites}));}
