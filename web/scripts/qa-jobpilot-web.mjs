// Real browser interaction with a fail-closed synthetic API. Never sends business writes to live profiles.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chromium, webkit } from 'playwright-core';
import { fixtureApi } from '../tests/fixtures/jobpilot-web-fixture.mjs';
import { legacyDestination } from '../src/components/jobpilot/model.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const web = path.join(root, 'web');
const engine = process.env.JOBPILOT_QA_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const out = path.join(root, '.career-ops-web/mobile-qa/web-parity-20260908', engine === 'webkit' ? 'browser-webkit' : 'browser');
fs.mkdirSync(out, { recursive: true });
const serverLog = fs.openSync(path.join(out, 'staged-server.log'), 'a');
let server, browser, page, api;
const checks = [], pageErrors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function eventually(predicate, timeout = 15000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await predicate()) return; await sleep(80); } throw new Error('Condition did not become true'); }
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
const check = async (name, fn) => { await fn(); checks.push({ name, pass: true }); console.log('PASS ' + name); };
try {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(web, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: web, env: { ...process.env, CAREER_OPS_ROOT: root, BUILD_DIST: process.env.BUILD_DIST || '.next-web-parity-qa' }, stdio: ['ignore', serverLog, serverLog], windowsHide: true });
  await eventually(async () => { try { return (await fetch(base + '/api/profiles')).ok; } catch { return false; } }, 45000);
  const registry = await (await fetch(base + '/api/profiles')).json();
  const ids = registry.profiles.map(p => p.id).slice(0, 2);
  assert.equal(ids.length, 2, 'Two registered profile IDs are needed for isolated browser QA');
  api = fixtureApi(ids);
  browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ executablePath: process.env.JOBPILOT_QA_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, locale: 'zh-CN' });
  await context.addCookies([{ name: 'career-ops-profile', value: ids[0], url: base, httpOnly: true, sameSite: 'Lax' }]);
  await context.addInitScript(() => { localStorage.setItem('jobpilot:language', 'zh'); localStorage.setItem('jobpilot:theme', 'light'); });
  await context.route('**/api/**', route => api.handler(route).catch(async e => { pageErrors.push('Fixture handler: ' + e.message); await route.fulfill({status:599,contentType:'application/json',body:JSON.stringify({error:'Fixture failure; real API remains blocked'})}); }));
  page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', e => pageErrors.push(e.message));
  const byId = id => page.getByTestId(id);
  const shown = id => byId(id).waitFor({ state: 'visible' });
  const goto = async (url = '/') => { await page.goto(base + url); await shown('nav-home'); await page.locator('.jp-page:visible').waitFor(); };
  const nav = async tab => { await byId('nav-' + tab).click(); await shown(tab + '-page'); };
  const close = async () => { await byId('close-sheet').click(); await page.locator('.jp-overlay').waitFor({ state: 'hidden' }); };
  const shot = async name => { await byId('jobpilot-phone').screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' }); };
  const buttons = (name, exact = true) => page.getByRole('button', { name, exact });
  await goto();
  await check('first-use onboarding appears and skip suppresses remaining tab guides', async () => {
    await shown('onboarding-welcome');
    await page.getByRole('button', { name: '跳过引导', exact: true }).click();
    await byId('onboarding-welcome').waitFor({ state: 'hidden' });
    await byId('nav-offers').click(); await shown('offers-page');
    assert.equal(await byId('onboarding-offers').count(), 0);
    await byId('nav-home').click(); await shown('home-page');
  });
  await check('phone frame is exactly 384x832 on desktop; five navigation entries; own branding', async () => {
    const b = await byId('jobpilot-phone').boundingBox(); assert.equal(b.width, 384); assert.equal(b.height, 832);
    assert.equal(await page.locator('.jp-nav button').count(), 5); assert.equal(await page.title(), 'JobPilot');
    assert.doesNotMatch(await page.locator('body').innerText(), /Career.?Ops|Cockpit des candidatures/);
    await shot('desktop-home-zh');
  });
  await check('home high-match metric opens exact application set', async () => {
    await byId('metric-high').click(); await shown('applications-page');
    assert.equal(await byId('applications-page').getAttribute('data-count'), '1');
    assert.equal(await byId('applications-page').getAttribute('data-filter'), 'high');
    await byId('filter-all').click(); assert.equal(await byId('applications-page').getAttribute('data-count'), '3');
    const applications=byId('applications-page');assert.deepEqual(await applications.locator('.jp-chips').first().getByRole('button').allTextContents(),['全部','准备投递','已投递','收到回复','面试','Offer / 入职','已结束']);
    assert.equal(await applications.locator('.jp-list-item').first().getAttribute('data-testid'),'job-qa-role-1');
    await byId('application-refine').click();await buttons('评分低→高').click();assert.equal(await applications.locator('.jp-list-item').first().getAttribute('data-testid'),'job-qa-role-2');
    await buttons('仅已评估').click();assert.equal(await byId('applications-page').getAttribute('data-count'),'2');await buttons('全部').last().click();await buttons('评分高→低').click();
    assert.match(await byId('job-qa-role-3').innerText(), /待评估/); await shot('applications-zh');
  });
  await check('saved formal evaluation opens without a second business call; report is a GET', async () => {
    const count = api.posts.length; await byId('job-qa-role-1').click(); await shown('job-detail-qa-role-1');
    assert.equal(await byId('evaluate-job').count(), 0); await shot('job-fit-zh');
    await byId('view-report').click(); await shown('result-sheet'); await page.getByText('这是测试报告，不会重新评估。').waitFor();
    assert.equal(api.posts.length, count); await byId('close-sheet').click(); await shown('job-detail-qa-role-1');
  });
  await check('tailored CV draft shows score lift, supports manual edits, reassessment, PDF preview and explicit rejection', async () => {
    await shown('job-detail-qa-role-1');await byId('job-tab-1').click();await byId('tailored-cv-draft').waitFor();
    const acceptedFile=api.fixtures[ids[0]].jobs[0].cv.file;assert.match(await byId('tailored-cv-draft').innerText(),/58[\s\S]*76[\s\S]*\+18/);
    await buttons('手动修改这个版本').click();const summary=page.getByLabel('职业摘要',{exact:true});await summary.fill('Edited synthetic tailored summary');await byId('save-tailored-draft-edit').click();
    await eventually(()=>api.fixtures[ids[0]].jobs[0].cvDraft.revision===2);assert.equal(api.fixtures[ids[0]].jobs[0].cvDraft.assessment,null);assert.equal(api.fixtures[ids[0]].jobs[0].cv.file,acceptedFile);
    await byId('review-tailored-draft').click();await eventually(()=>api.fixtures[ids[0]].jobs[0].cvDraft.assessment?.revision===2);await shown('job-detail-qa-role-1');assert.equal(await byId('job-tab-1').getAttribute('aria-selected'),'true');await eventually(async()=>/58[\s\S]*80[\s\S]*\+22/.test(await byId('tailored-cv-draft').innerText()));
    await byId('preview-tailored-draft').click();await shown('pdf-preview');await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor({timeout:30000});assert.match(await byId('pdf-preview').innerText(),/58[\s\S]*80[\s\S]*\+22/);await buttons('不要这个版本').click();
    await shown('job-detail-qa-role-1');assert.equal(await byId('job-tab-1').getAttribute('aria-selected'),'true');assert.equal(api.fixtures[ids[0]].jobs[0].cv.file,acceptedFile);assert.equal(api.fixtures[ids[0]].jobs[0].cvDraft.status,'rejected');
  });
  await check('tracking preserves untouched automatic next action and saves selected-profile notes/status/date', async () => {
    await byId('job-tab-3').click(); await page.getByLabel('当前阶段').selectOption('Candidature envoyée');
    await page.getByLabel('跟进日期', { exact: true }).fill('2026-09-15'); await page.getByLabel('我的备注', { exact: true }).fill('Browser QA note');
    await byId('save-tracking').click(); await eventually(() => api.posts.some(p => p.body?.change?.note === 'Browser QA note'));
    const post = api.posts.findLast(p => p.body?.change?.note === 'Browser QA note');
    assert.equal(post.profile, ids[0]); assert.equal(post.body.change.dueDate, '2026-09-15'); assert.ok(!Object.hasOwn(post.body.change, 'nextAction'));
    await page.getByLabel('粘贴或概括收到的回复', { exact: true }).fill('Fictional interview invitation'); await buttons('保存回复').click();
    await eventually(() => api.fixtures[ids[0]].jobs[0].replies.length === 1); assert.equal(api.fixtures[ids[1]].jobs.length, 0);
    await shot('job-tracking-zh'); await goto('/?tab=applications');
  });
  await check('multi-role comparison uses saved roles and explicit analyze action', async () => {
    await buttons('对比').click(); await byId('job-qa-role-1').click(); await byId('job-qa-role-2').click();
    await buttons('比较选中的岗位').click(); await shown('compare-sheet'); assert.equal(await page.locator('.jp-compare .jp-card').count(), 2);
    await shot('comparison-zh'); await buttons('分析取舍与优先顺序').click(); await shown('result-sheet');
    assert.equal(api.posts.findLast(p => p.body?.input?.kind === 'compare').body.input.jobIds.length, 2); await close();
  });
  await check('profile UI/material language independence and dark/light themes', async () => {
    await nav('profile'); await shown('material-language-fr'); const cv = api.fixtures[ids[0]].cv;
    await byId('ui-language-en').click(); await page.getByRole('heading', { name: 'Your profile. Your evidence.' }).waitFor();
    assert.equal(api.fixtures[ids[0]].cv, cv); assert.equal(api.fixtures[ids[0]].languageSettings.applicationLanguage, 'fr');
    const before = api.posts.length; await byId('ui-language-fr').click(); await page.getByRole('heading', { name: 'Votre profil, vos preuves.' }).waitFor();
    assert.equal(api.posts.length, before); await byId('theme-dark').click(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('[data-testid="screen-profile"]').evaluate(el => el.scrollTop = 0); await shot('profile-dark-fr');
    await byId('theme-light').click(); await byId('ui-language-zh').click(); await page.getByRole('heading', { name: '我的档案', exact: true }).waitFor();
    await byId('material-language-en').click(); await eventually(() => api.fixtures[ids[0]].languageSettings.applicationLanguage === 'en'); assert.equal(api.fixtures[ids[0]].cv, cv);
    await byId('material-language-fr').click(); await eventually(() => api.fixtures[ids[0]].languageSettings.applicationLanguage === 'fr');
  });
  await check('saved analysis displays without regenerating and all three analysis tabs work', async () => {
    const count = api.posts.length; await byId('view-analysis').click(); await shown('analysis-sheet');
    await byId('analysis-tab-1').click(); await page.getByText('Clarify research evidence', { exact: true }).waitFor();
    await byId('analysis-tab-2').click(); await page.getByText('Practice an interview', { exact: true }).waitFor();
    await byId('analysis-tab-0').click(); assert.equal(api.posts.length, count);
    const analysisContent=byId('analysis-content');
    await analysisContent.evaluate(el=>{el.scrollTop=el.scrollHeight;});const bottom=await analysisContent.evaluate(el=>el.scrollTop);const sheetBefore=await byId('analysis-sheet').boundingBox();
    await analysisContent.hover();await page.mouse.wheel(0,1400);await sleep(120);assert.equal(await analysisContent.evaluate(el=>el.scrollTop),bottom);assert.deepEqual(await byId('analysis-sheet').boundingBox(),sheetBefore);
    await shot('analysis-zh');
  });
  await check('coordinated draft renders actual before/after PDFs; download is original PDF bytes', async () => {
    await byId('apply-cv-plan').click(); await shown('pdf-preview'); await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor({ timeout: 30000 });
    const after = await page.locator('.jp-pdf-page canvas').first().evaluate(c => c.toDataURL());
    await byId('cv-preview-tab-0').click(); await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor({ timeout: 30000 });
    const before = await page.locator('.jp-pdf-page canvas').first().evaluate(c => c.toDataURL()); assert.notEqual(before, after);
    await byId('cv-preview-tab-1').click(); await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor();
    await page.getByRole('button', { name: '放大', exact: true }).click(); assert.match(await page.locator('.jp-pdf-controls').innerText(), /125%/);
    const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: '下载 PDF', exact: true }).click(); const file = await downloaded; await file.saveAs(path.join(out, 'synthetic-preview.pdf'));
    assert.equal(fs.readFileSync(path.join(out, 'synthetic-preview.pdf')).subarray(0, 5).toString(), '%PDF-'); await shot('draft-pdf-zh');
  });
  await check('reject keeps canonical CV; accepted draft changes it once; history is read-only', async () => {
    const f = api.fixtures[ids[0]], before = f.cv; await byId('reject-draft').click(); await shown('analysis-sheet'); assert.equal(f.cv, before);
    await byId('apply-cv-plan').click(); await shown('pdf-preview'); await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor();
    const draft = new URL(page.url()).searchParams.get('draft'); await byId('accept-draft').click(); await shown('analysis-sheet'); assert.notEqual(f.cv, before);
    await goto('/?tab=profile&view=pdf&draft=' + draft); await shown('pdf-preview'); await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor();
    assert.equal(await byId('accept-draft').count(), 0); await close();
  });
  await check('CV editor refuses a newer-version conflict and preserves unsaved text', async () => {
    await buttons('编辑内容').click(); await shown('cv-editor'); const field = page.getByLabel('简历内容', { exact: true }); await field.fill('Unsaved synthetic CV edit');
    api.fixtures[ids[0]].cvState.versionId = 'qa-concurrent-version'; await buttons('保存修改').click(); await byId('confirm-cv-save').click();
    await byId('jobpilot-phone').getByRole('alert').filter({ hasText: '另一个窗口已更新简历' }).waitFor(); assert.equal(await field.inputValue(), 'Unsaved synthetic CV edit');
    assert.notEqual(api.fixtures[ids[0]].cv, 'Unsaved synthetic CV edit'); await close();
  });
  await check('master PDF uses real PDF canvas and closes without any edit', async () => {
    const cv = api.fixtures[ids[0]].cv; const count = api.posts.length; await byId('view-master-pdf').click(); await shown('pdf-preview');
    await page.locator('.jp-pdf-page[data-rendered="true"]').first().waitFor(); assert.equal(api.posts.length, count); assert.equal(api.fixtures[ids[0]].cv, cv); await close();
  });
  await check('invalid upload is rejected locally; valid import requires explicit confirmation', async () => {
    const count = api.posts.length, old = api.fixtures[ids[0]].cv;
    await byId('cv-upload-input').setInputFiles({ name: 'invalid.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('test') });
    await byId('jobpilot-phone').getByRole('alert').waitFor(); assert.equal(api.posts.length, count);
    await byId('cv-upload-input').setInputFiles({ name: 'fixture.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic CV upload') });
    await shown('result-sheet'); await page.getByLabel('导入预览', { exact: true }).waitFor(); assert.equal(api.fixtures[ids[0]].cv, old);
    await buttons('确认保存').click(); await byId('confirm-import').click(); await page.locator('.jp-overlay').waitFor({ state: 'hidden' });
    assert.match(api.fixtures[ids[0]].cv, /Imported synthetic CV/);
  });
  await check('preparation checklist, plan, practice and coach use the shared task contract', async () => {
    await nav('prepare'); await page.getByLabel('Prepare an example', { exact: true }).click(); await eventually(() => api.fixtures[ids[0]].jobs[0].prepTasks[0].done); await eventually(() => page.getByLabel('Prepare an example', { exact: true }).isChecked());
    await page.getByLabel('我的回答', { exact: true }).fill('A documented example of research with a clear method.'); await buttons('获取逐项反馈').click(); await shown('result-sheet');
    assert.equal(api.posts.findLast(p => p.body?.input?.kind === 'practice').body.input.jobId, 'qa-role-1'); await close();
    await page.getByLabel('关于我的职业路径……', { exact: true }).fill('How should I prioritize my research experience?'); await buttons('一起思考').click(); await shown('result-sheet'); assert.ok(api.posts.some(p => p.body?.input?.kind === 'coach')); await close();
    await eventually(async()=>await buttons('更新训练计划').count()===1,6000);await buttons('更新训练计划').click(); await shown('job-detail-qa-role-1'); assert.equal(await byId('job-tab-2').getAttribute('aria-selected'), 'true');
    await shown('interview-plan-body');assert.equal(await byId('toggle-interview-plan').getAttribute('aria-expanded'),'true');await byId('toggle-interview-plan').click();await eventually(async()=>await byId('interview-plan-body').count()===0);assert.equal(await byId('toggle-interview-plan').getAttribute('aria-expanded'),'false');await byId('toggle-interview-plan').click();await shown('interview-plan-body');
    const jobContent=byId('job-content');await jobContent.evaluate(el=>{el.scrollTop=0;});const beforeScroll=await jobContent.evaluate(el=>el.scrollTop);
    await byId('practice-this-question').click();await eventually(async()=>await jobContent.evaluate(el=>el.scrollTop)>beforeScroll);
    const targeted=byId('targeted-practice');await targeted.waitFor({state:'visible'});await eventually(async()=>await targeted.getByLabel('面试问题',{exact:true}).inputValue()==='Describe your research process.');
    await shot('interview-plan-zh'); await close();
  });
  await check('AI buttons expose asymptotic inline progress, snap to complete, and surface failures', async () => {
    await nav('prepare');await eventually(async()=>await buttons('一起思考').count()===1,6000);
    const coachInput=page.getByLabel('关于我的职业路径……',{exact:true});const coachCard=coachInput.locator('xpath=ancestor::section[contains(@class,"jp-card")][1]');await coachInput.fill('__QA_ASYNC__ success');await buttons('一起思考').click();await shown('background-task-launch');await byId('confirm-background-task').click();await byId('background-task-launch').waitFor({state:'hidden'});
    const coachButton=coachCard.locator('.jp-ai-button');await eventually(async()=>await coachButton.getAttribute('aria-busy')==='true');assert.match(await coachButton.getAttribute('style'),/--jp-ai-progress:/);assert.match(await coachButton.innerText(),/≈\d+%/);
    const successTask=api.fixtures[ids[0]].tasks.find(t=>t.kind==='coach'&&t.input?.question==='__QA_ASYNC__ success');successTask.status='completed';successTask.updatedAt=new Date().toISOString();
    await eventually(async()=>/已完成/.test(await coachButton.innerText()),8000);assert.match(await coachButton.getAttribute('style'),/--jp-ai-progress:\s*100%/);
    await eventually(async()=>await buttons('获取逐项反馈').count()===1,6000);const q=page.getByLabel('面试问题',{exact:true}),a=page.getByLabel('我的回答',{exact:true});await q.fill('__QA_ASYNC__ failure');await a.fill('Synthetic answer');await buttons('获取逐项反馈').click();await shown('background-task-launch');await byId('confirm-background-task').click();await byId('background-task-launch').waitFor({state:'hidden'});
    const failureTask=api.fixtures[ids[0]].tasks.find(t=>t.kind==='practice'&&t.input?.question==='__QA_ASYNC__ failure');await eventually(()=>failureTask?.status==='queued');failureTask.status='failed';failureTask.error='Synthetic AI failure';failureTask.updatedAt=new Date().toISOString();
    await eventually(async()=>/Synthetic AI failure/.test(await byId('jobpilot-phone').innerText()),8000);assert.match(await byId('jobpilot-phone').innerText(),/Synthetic AI failure/);const dismiss=page.locator('.jp-error .jp-icon-button');if(await dismiss.count())await dismiss.click();
  });
  await check('search stays in background, repeated click submits once, completion routes to offers', async () => {
    await nav('offers'); const before = api.posts.filter(p => p.body?.input?.kind === 'search').length;
    await byId('search-offers').click(); await eventually(() => api.posts.filter(p => p.body?.input?.kind === 'search').length === before + 1);
    assert.equal(await byId('search-offers').isDisabled(), true); await nav('home'); await byId('open-tasks').click(); await shown('tasks-sheet');
    const t = api.fixtures[ids[0]].tasks.find(t => t.kind === 'search'); await byId('task-' + t.id).click(); await shown('result-sheet');
    t.status = 'completed'; await shown('offers-page'); await page.locator('.jp-overlay').waitFor({ state: 'hidden', timeout: 15000 });
    assert.equal(api.posts.filter(p => p.body?.input?.kind === 'search').length, before + 1); await shot('offers-zh');
  });
  await check('pending offers select-all supports batch evaluation/save and AI launch flies into task center', async () => {
    await nav('offers');await byId('select-all-pending').click();await byId('bulk-evaluate-offers').waitFor();
    await byId('bulk-evaluate-offers').click();await shown('background-task-launch');
    const launchText=await byId('background-task-launch').innerText();assert.match(launchText,/正在后台处理/);assert.match(launchText,/预计剩余|预计耗时/);assert.equal(await byId('background-task-launch').locator('.jp-estimated-ring').count(),1);const batch=api.posts.findLast(p=>p.body?.action==='batchTasks');assert.ok(batch.body.inputs.every(input=>input.kind==='evaluate'&&input.offer?.url===input.url));assert.ok(api.fixtures[ids[0]].jobs.some(job=>job.url==='https://example.test/jobs/new'));
    await byId('confirm-background-task').click();await byId('background-task-launch').waitFor({state:'hidden'});batch.body.inputs.forEach((_,index)=>{const task=api.fixtures[ids[0]].tasks[index];if(task)task.status='completed';});
    await byId('select-all-pending').click();await byId('bulk-save-offers').click();await eventually(()=>api.posts.some(p=>p.body?.action==='saveOffers'));
    const saved=api.fixtures[ids[0]].jobs.find(j=>j.url==='https://example.test/jobs/new');assert.ok(saved);assert.equal(saved.score,null);
  });
  await check('applications can evaluate every unrated role with one background batch', async () => {
    await nav('applications');const before=api.posts.filter(p=>p.body?.action==='batchTasks').length;await byId('evaluate-all-unrated').click();await shown('background-task-launch');
    const post=api.posts.findLast(p=>p.body?.action==='batchTasks');assert.ok(post.body.inputs.length>=1);assert.ok(post.body.inputs.every(input=>input.kind==='evaluate'&&input.retry===true));assert.equal(api.posts.filter(p=>p.body?.action==='batchTasks').length,before+1);
    await byId('confirm-background-task').click();await byId('background-task-launch').waitFor({state:'hidden'});for(const task of api.fixtures[ids[0]].tasks.filter(t=>t.status==='queued'&&t.kind==='evaluate'))task.status='completed';
  });
  await check('profile switch isolates all state and requests despite a shared browser cookie', async () => {
    await byId('profile-switch').selectOption(ids[1]); await page.getByText('Beta QA — SYNTHETIC', { exact: true }).first().waitFor(); await nav('applications');
    assert.equal(await byId('applications-page').getAttribute('data-count'), '0'); assert.equal(await byId('job-qa-role-1').count(), 0);
    await nav('profile'); await context.addCookies([{ name: 'career-ops-profile', value: ids[0], url: base, httpOnly: true, sameSite: 'Lax' }]);
    await byId('material-language-en').click(); await eventually(() => api.fixtures[ids[1]].languageSettings.applicationLanguage === 'en');
    assert.equal(api.fixtures[ids[0]].languageSettings.applicationLanguage, 'fr'); assert.equal(api.posts.at(-1).profile, ids[1]);
    await byId('profile-switch').selectOption(ids[0]); await page.getByText('Alpha QA — SYNTHETIC', { exact: true }).first().waitFor();
  });
  await check('slow old-locale requests cannot repaint the new language or submit AI work', async () => {
    await nav('profile'); const before = api.posts.length; api.setSlowLocale('fr'); await byId('ui-language-fr').click(); await byId('ui-language-en').click();
    await page.getByRole('heading', { name: 'Your profile. Your evidence.' }).waitFor(); await sleep(800);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en'); assert.equal(api.posts.length, before); api.setSlowLocale('');
    await byId('ui-language-zh').click();
  });
  await check('phone and short-desktop sizes preserve frame, scroll, navigation and modal bounds', async () => {
    for (const [name, width, height] of [['iphone-size',390,844],['small-phone',320,640],['short-desktop',1024,768]]) {
      await page.setViewportSize({ width, height }); await nav('home'); await sleep(80);
      const phone = await byId('jobpilot-phone').boundingBox(); assert.ok(phone.width <= width && phone.height <= height + 1);
      if(width > 600)assert.ok(Math.abs(phone.width / phone.height - 384 / 832) < .001);
      else assert.equal(phone.width, width);
      const sizes = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,width:innerWidth})); assert.ok(sizes.scroll <= sizes.width + 1);
      for (const b of await page.locator('.jp-nav button').all()) { const r = await b.boundingBox(); assert.ok(r.x >= phone.x - 1 && r.x + r.width <= phone.x + phone.width + 1); }
      await shot(name+'-home'); await byId('open-tasks').click(); const modal = await page.locator('.jp-sheet').boundingBox(); assert.ok(modal.x >= phone.x - 1 && modal.x + modal.width <= phone.x + phone.width + 1); await close();
    }
    await page.setViewportSize({ width:1440,height:1000 });
  });
  await check('all legacy routes resolve only to the new product', async () => {
    for(const name of ['analytics','apply','candidatures','config','cv','explore','followups','jobs','pipeline','portals']) {
      const response = await fetch(base + '/' + name, { redirect:'manual' }); assert.ok([307,308].includes(response.status)); assert.equal(response.headers.get('location'), legacyDestination('/'+name));
    }
  });
  await check('refreshable connection error is visible rather than an indefinite spinner', async () => {
    api.setFailNext(); await nav('profile'); await buttons('连接并刷新').click(); await byId('jobpilot-phone').getByRole('alert').filter({hasText:'QA connection error'}).waitFor();
    await page.getByRole('button',{name:'关闭提示',exact:true}).click(); await buttons('连接并刷新').click(); assert.equal(await byId('jobpilot-phone').getByRole('alert').count(),0);
  });
  await check('no browser exceptions or unmocked API writes escaped the fixture', async () => { assert.deepEqual(pageErrors, []); assert.deepEqual(api.unexpected, []); });
  fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ passed:true, checks, browser:await browser.version(), syntheticOnly:true, productionBusinessWrites:0, requests:api.requests.length, posts:api.posts.length, pageErrors }, null, 2));
  console.log(`BROWSER QA PASS: ${checks.length} checks; synthetic API only; no production business writes.`);
} catch(e) {
  console.error(e.stack);
  if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure-page.txt'),await page.locator('body').innerText().catch(()=>''));}
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({passed:false,checks,error:e.message,pageErrors,unexpected:api?.unexpected},null,2));
  process.exitCode=1;
} finally {
  await browser?.close();
  if(server?.pid){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill();}
  fs.closeSync(serverLog);
}
