import '../scripts/register-source-loader.mjs';
import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Execute the real store/writers in a disposable root, never the developer's Candidate files.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jobpilot-service-'));
const project = path.resolve(import.meta.dirname, '../..');
const oldRoot = process.env.CAREER_OPS_ROOT;
const oldPipeline = process.env.CAREER_OPS_PIPELINE;
const oldHistory = process.env.CAREER_OPS_SCAN_HISTORY;
process.env.CAREER_OPS_ROOT = root;
process.env.CAREER_OPS_PIPELINE = path.join(root, 'data/pipeline.md');
process.env.CAREER_OPS_SCAN_HISTORY = path.join(root, 'data/scan-history.tsv');
after(() => {
  mock.restoreAll();
  if (oldRoot === undefined) delete process.env.CAREER_OPS_ROOT;
  else process.env.CAREER_OPS_ROOT = oldRoot;
  for (const [name, previous] of [['CAREER_OPS_PIPELINE', oldPipeline], ['CAREER_OPS_SCAN_HISTORY', oldHistory]]) {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
  fs.rmSync(root, { recursive: true, force: true });
});
const put = (name, value) => {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
};
const profiles = ['qa-one', 'qa-two'].map(id => ({ id, name: id, shortName: id,
  cvMarkdown: `data/${id}/cv.md`, config: `data/${id}/profile.yml`, notes: `data/${id}/notes.md`, candidatures: `data/${id}/candidatures.json` }));
put('data/profiles.json', { version: 1, defaultProfileId: 'qa-one', profiles });
for (const p of profiles) {
  put(p.candidatures, { candidate: p.name, updatedAt: '2026-09-09', jobs: [] });
  put(p.cvMarkdown, '# Fictional QA candidate\nPython and financial data controls.\n');
  put(p.config, 'language:\n  output: en\n');
  put(p.notes, 'Synthetic candidate only.');
}
const { saveMobileOffer, readCandidatureStore, reconcileCandidatures, updateMobileJob } = await import('../src/lib/candidatures.ts');
const offer = { url: 'https://example.test/jobs/quant', company: 'Demo Company', title: 'Quant Analyst', location: 'Paris', source: 'fixture', why: 'Synthetic discovery' };
let saved;

test('saving an offer persists this root and profile without an internal HTTP request', async () => {
  const network = mock.method(globalThis, 'fetch', () => { throw new Error('Self-HTTP is forbidden in this service'); });
  try {
    saved = await saveMobileOffer('qa-one', offer);
    assert.equal(saved.score, null);
    assert.equal(readCandidatureStore('qa-one').jobs.length, 1);
    assert.equal(readCandidatureStore('qa-two').jobs.length, 0);
    const inbox = fs.readFileSync(path.join(root, 'data/pipeline.md'), 'utf8');
    assert.match(inbox, /https:\/\/example.test\/jobs\/quant/);
    assert.match(inbox, /profile: qa-one/);
    assert.equal(network.mock.callCount(), 0);
    const history = fs.readFileSync(path.join(root, 'data/scan-history.tsv'), 'utf8');
    assert.match(history, /\tDemo Company\tadded\tParis\t/);
  } finally { network.mock.restore(); }
});

test('saving an already collected URL does not duplicate inbox, history, or candidature', async () => {
  const inbox = fs.readFileSync(path.join(root, 'data/pipeline.md'), 'utf8');
  const history = fs.readFileSync(path.join(root, 'data/scan-history.tsv'), 'utf8');
  assert.equal((await saveMobileOffer('qa-one', offer)).id, saved.id);
  assert.equal(readCandidatureStore('qa-one').jobs.length, 1);
  assert.equal(fs.readFileSync(path.join(root, 'data/pipeline.md'), 'utf8'), inbox);
  assert.equal(fs.readFileSync(path.join(root, 'data/scan-history.tsv'), 'utf8'), history);
});

test('two independent offer saves retain both cards after asynchronous canonical writes', async () => {
  const urls = ['https://example.test/jobs/risk', 'https://example.test/jobs/research'];
  await Promise.all(urls.map(url => saveMobileOffer('qa-one', { ...offer, url })));
  const jobs = readCandidatureStore('qa-one').jobs;
  assert.equal(jobs.length, 3);
  for (const url of urls) assert.ok(jobs.some(job => job.url === url));
});

test('another profile can collect the same URL without sharing the first profile card', async () => {
  const second = await saveMobileOffer('qa-two', offer);
  assert.notEqual(second.id, saved.id);
  assert.equal(readCandidatureStore('qa-two').jobs.length, 1);
  assert.match(fs.readFileSync(path.join(root, 'data/pipeline.md'), 'utf8'), /profile: qa-two/);
});

test('writer failure rejects the save and the HTTP endpoint reports failure, not success', async () => {
  const previousHistory = process.env.CAREER_OPS_SCAN_HISTORY;
  process.env.CAREER_OPS_SCAN_HISTORY = path.join(root, 'data'); // Directory, not a writable history file.
  try {
    const count = readCandidatureStore('qa-one').jobs.length;
    await assert.rejects(saveMobileOffer('qa-one', { ...offer, url: 'https://example.test/jobs/failed' }), /EISDIR|directory|illegal operation/i);
    assert.equal(readCandidatureStore('qa-one').jobs.length, count);
    const { POST } = await import('../src/app/api/explore/add/route.ts');
    const response = await POST(new Request('http://localhost/api/explore/add?profileId=qa-one', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offers: [offer] }),
    }));
    assert.equal(response.status, 500);
    assert.ok((await response.json()).error);
  } finally { process.env.CAREER_OPS_SCAN_HISTORY = previousHistory; }
});

test('official reports reconcile directly into the matching profile and retain user tracking fields', () => {
  updateMobileJob('qa-one', saved.id, { status: 'Candidature envoyée', note: 'Keep my note', nextAction: 'Call recruiter', dueDate: '2026-09-15' });
  put('data/applications.md', '# Applications\n\n| # | Date | Company | Role | Score | Status | Report | Notes |\n|---|---|---|---|---|---|---|---|\n| 001 | 2026-09-09 | Demo Company | Quant Analyst | 4.2/5 | Evaluated | [001](../reports/001-demo-2026-09-09.md) | Synthetic report; profile: qa-one |\n');
  put('reports/001-demo-2026-09-09.md', '# Evaluation\n\n**URL:** https://example.test/jobs/quant\n**Score:** 4.2/5\n\n## Machine Summary\n\n```yaml\nscore: 4.2\ntop_strengths: [Python]\nsoft_gaps: [Ownership]\nfinal_decision: Apply\n```\n\n## B) Match with CV\n\n| Requirement | Status | Evidence |\n|---|---|---|\n| Python | met | Financial data controls |\n');
  const job = reconcileCandidatures('qa-one').jobs.find(j => j.id === saved.id);
  assert.equal(job.score, 4.2);
  assert.equal(job.reportNum, '001');
  assert.equal(job.status, 'Candidature envoyée');
  assert.equal(job.followup.note, 'Keep my note');
  assert.equal(job.followup.nextAction, 'Call recruiter');
  assert.equal(job.followup.nextActionSource, 'user');
  assert.equal(reconcileCandidatures('qa-two').jobs[0].score, null);
});

test('the candidature endpoint shares mobile status history and explicit-user-action semantics', async () => {
  const { POST } = await import('../src/app/api/candidatures/route.ts');
  const response = await POST(new Request('http://localhost/api/candidatures', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: saved.id, profileId: 'qa-one', status: 'Entretien', nextAction: 'Prepare interview', note: 'Edited through candidature endpoint' }),
  }));
  assert.equal(response.status, 200);
  const { job } = await response.json();
  assert.equal(job.statusHistory.at(-1).status, 'Entretien');
  assert.equal(job.followup.nextActionSource, 'user');
  assert.equal(job.followup.dueDate, '2026-09-15');
});

test('an invalid candidature store is reported rather than replaced with an empty file', () => {
  const file = path.join(root, profiles[1].candidatures);
  const before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, '{"jobs":"broken"}');
  try {
    assert.throws(() => reconcileCandidatures('qa-two'), /invalide/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{"jobs":"broken"}');
  } finally { fs.writeFileSync(file, before); }
});
