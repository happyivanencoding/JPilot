// Browser + real Next backend acceptance. No API mocks, no production Candidate data or live applications.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium, webkit } from 'playwright-core';
import { prepareCase, benchmarkRoot } from './jobpilot-benchmark-fixture.mjs';

const engineName = process.env.JOBPILOT_QA_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const id = `browser-backend-${engineName}-${Date.now()}`;
const root = prepareCase(id, 'ai');
const output = path.join(benchmarkRoot, id);
fs.mkdirSync(output, { recursive: true });
const registryPath = path.join(root, 'data/profiles.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
registry.profiles.push({ ...registry.profiles[0], id: 'qa-other', name: 'Second synthetic candidate', shortName: 'OTHER', legacyUntagged: false, candidatures: 'data/other-candidatures.json' });
fs.writeFileSync(registryPath, JSON.stringify(registry));
fs.writeFileSync(path.join(root, 'data/other-candidatures.json'), JSON.stringify({ candidate: 'Second synthetic candidate', updatedAt: new Date().toISOString(), jobs: [] }));
const port = await new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const base = `http://127.0.0.1:${port}`;
const web = path.resolve(import.meta.dirname, '..');
const log = fs.openSync(path.join(output, 'server.log'), 'a');
const server = spawn(process.execPath, [path.join(web, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: web, env: { ...process.env, BUILD_DIST: process.env.BUILD_DIST || '.next', CAREER_OPS_ROOT: root,
    CAREER_OPS_PIPELINE: path.join(root, 'data/pipeline.md'), CAREER_OPS_SCAN_HISTORY: path.join(root, 'data/scan-history.tsv'),
    // Deliberately unavailable: a regression to self-HTTP must fail this test, not hit production :3000.
    JOBPILOT_INTERNAL_URL: 'http://127.0.0.1:1' }, windowsHide: true, stdio: ['ignore', log, log],
});
let browser;
const checks = [], errors = [];
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Staged Next process exited before becoming ready.');
    try { if ((await fetch(base + '/api/profiles')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(ready, 'Staged server did not become ready');
  browser = engineName === 'webkit' ? await webkit.launch({ headless: true })
    : await chromium.launch({ executablePath: process.env.JOBPILOT_QA_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  await context.addInitScript(() => { localStorage.setItem('jobpilot:language', 'fr'); localStorage.setItem('jobpilot:theme', 'light'); });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="onboarding-welcome"] .jp-onboarding-skip').click();
  await page.locator('[data-testid="nav-applications"]').waitFor();
  const request = (url, body) => page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, value: await response.json() };
  }, { url, body });
  const snapshot = await request('/api/mobile?profileId=benchmark&uiLocale=fr');
  assert.equal(snapshot.status, 200); assert.equal(snapshot.value.profile.id, 'benchmark');
  checks.push('real mobile snapshot works while the legacy internal HTTP address is unavailable');
  const offer = { url: 'https://example.test/refactor-smoke', company: 'Refactor smoke employer', title: 'Junior analyst', location: 'Paris', source: 'synthetic-browser-qa' };
  const first = await request('/api/mobile', { action: 'saveOffer', profileId: 'benchmark', offer });
  assert.equal(first.status, 200); assert.equal(first.value.job.score, null);
  const pipeline = fs.readFileSync(path.join(root, 'data/pipeline.md'), 'utf8');
  const again = await request('/api/mobile', { action: 'saveOffer', profileId: 'benchmark', offer });
  assert.equal(again.value.job.id, first.value.job.id);
  assert.equal(fs.readFileSync(path.join(root, 'data/pipeline.md'), 'utf8'), pipeline);
  checks.push('browser save persists a real unrated candidature once, including the canonical inbox');
  const jobId = first.value.job.id;
  const mobile = await request('/api/mobile', { action: 'updateJob', profileId: 'benchmark', id: jobId, change: { status: 'Candidature envoyée', note: 'Real staged backend note', nextAction: 'Prepare evidence', dueDate: '2026-09-15' } });
  assert.equal(mobile.status, 200);
  const updated = await request('/api/candidatures', { profileId: 'benchmark', id: jobId, status: 'Entretien', nextAction: 'Prepare interview' });
  assert.equal(updated.status, 200); assert.equal(updated.value.job.followup.note, 'Real staged backend note');
  assert.equal(updated.value.job.statusHistory.at(-1).status, 'Entretien');
  checks.push('mobile and candidature endpoints preserve the same tracking data and status history');
  const other = await request('/api/mobile?profileId=qa-other&uiLocale=fr');
  assert.equal(other.status, 200); assert.equal(other.value.jobs.length, 0);
  checks.push('second synthetic profile cannot acquire the first profile candidature');
  await page.reload({ waitUntil: 'networkidle' });
  for (const tab of ['home', 'offers', 'applications', 'prepare', 'profile']) await page.locator(`[data-testid="nav-${tab}"]`).click();
  await page.locator('[data-testid="nav-applications"]').click();
  await page.getByText('Refactor smoke employer', { exact: true }).first().waitFor();
  await page.screenshot({ path: path.join(output, 'applications-real-backend.png'), fullPage: true, animations: 'disabled' });
  checks.push('all five real browser screens work and reloaded applications display the persisted card');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ passed: true, engine: engineName, syntheticOnly: true, apiMocks: false, internalHttpUnavailable: true, checks, errors }, null, 2));
  for (const check of checks) console.log('PASS ' + check);
  console.log('REAL BACKEND BROWSER PASS: ' + output);
} finally {
  if (browser) await browser.close();
  server.kill();
  fs.closeSync(log);
}
