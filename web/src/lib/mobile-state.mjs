// Operational locks and immutable input history; the original profile files stay authoritative.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeUrl } from './posting-url.mjs';
import { evidenceConfig } from './language-contract.mjs';

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
// Only operational JSON uses this helper. Canonical CV edits use safe-write + backup.
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${randomUUID()}`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}
export function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code !== 'ESRCH'; }
}
export async function withProfileLock(directory, work) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, '.action-lock');
  const owner = { pid: process.pid, id: randomUUID() };
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      const fd = fs.openSync(file, 'wx');
      try { fs.writeFileSync(fd, JSON.stringify(owner)); } finally { fs.closeSync(fd); }
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const existing = readJson(file);
        if (existing?.pid && !processAlive(existing.pid)) { fs.unlinkSync(file); continue; }
      } catch (readError) {
        if (readError.code === 'ENOENT') continue;
        // A writer may not yet have finished its tiny owner record. Never steal a live lock.
      }
      if (Date.now() > deadline) throw new Error('Une sauvegarde est déjà en cours. Réessayez dans un instant.');
      await new Promise(r => setTimeout(r, 20));
    }
  }
  try { return await work(); }
  finally { if (readJson(file)?.id === owner.id) fs.unlinkSync(file); }
}

export function candidateVersion(directory, sources) {
  const folder = path.join(directory, 'cv-history');
  const indexFile = path.join(folder, 'index.json');
  const index = readJson(indexFile, { currentId: null, resolutions: [] });
  const previous = index.currentId ? readJson(path.join(folder, index.currentId + '.json')) : null;
  const same = previous && ['cv', 'config', 'notes'].every(k => k === 'config' ? evidenceConfig(previous.sources[k].text) === evidenceConfig(sources[k].text) : previous.sources[k].text === sources[k].text);
  if (same) return previous;
  const state = {
    id: randomUUID(), previousId: previous?.id || null,
    cvVersion: (previous?.cvVersion || 0) + (!previous || previous.sources.cv.text !== sources.cv.text ? 1 : 0),
    revision: (previous?.revision || 0) + 1,
    createdAt: new Date().toISOString(), sources,
  };
  writeJson(path.join(folder, state.id + '.json'), state);
  writeJson(indexFile, { ...index, currentId: state.id });
  return state;
}
export function loadCandidateVersion(directory, id) {
  if (!/^[a-f0-9-]{36}$/.test(String(id))) throw new Error('Version de CV invalide.');
  const state = readJson(path.join(directory, 'cv-history', id + '.json'));
  if (!state) throw new Error('Version de CV introuvable pour ce profil.');
  return state;
}
export function resolvedIssues(directory) {
  return readJson(path.join(directory, 'cv-history/index.json'), { resolutions: [] }).resolutions || [];
}
export function canAdoptLegacy(task, version) {
  const created = Date.parse(task.createdAt);
  return Number.isFinite(created) && ['cv','config','notes'].every(k => version.sources[k].modifiedMs <= created);
}
const clean = x => String(x ?? '').trim().replace(/\s+/g, ' ');
// Operation keys are product-contract identities, not just input hashes. When a
// flow starts requiring new persisted output fields, bump its version so an old
// completed task cannot masquerade as a valid result for the new UI contract.
const ANALYSIS_OPERATION_VERSION = 'analysis-v2-v1-directions';
const SEARCH_OPERATION_VERSION = 'search-v6-live-providers';
export function operationKey(kind, input, version, jobs, day = new Date().toISOString().slice(0,10)) {
  const job = jobs.find(j => j.id === input.jobId);
  const evidence = j => j ? [j.id, normalizeUrl(j.url), j.reportNum || null, j.score ?? null, j.summary || '', j.match || [], j.gaps || []] : null;
  if (kind === 'evaluate') return JSON.stringify([kind, normalizeUrl(input.url)]);
  if (kind === 'deep_match') return JSON.stringify([kind, input.experience==='v1'?'role-fit-2-anchored-v1':'v1', version.id, normalizeUrl(input.url || input.offer?.url)]);
  if (kind === 'analysis') return JSON.stringify([kind, input.experience==='v1' ? 'analysis-v3-personal-orientation' : ANALYSIS_OPERATION_VERSION, version.id]);
  if (kind === 'search') return JSON.stringify([kind, input.experience==='v1' ? 'search-v8-v1-directions' : SEARCH_OPERATION_VERSION, version.id, clean(input.query), day]);
  if (kind === 'cv') return JSON.stringify([kind, version.id, evidence(job), ...(input.applicationLanguage ? [input.applicationLanguage] : [])]);
  if (kind === 'cv_review') return JSON.stringify([kind, input.jobId, input.draftId, Number(input.revision || 0)]);
  if (kind === 'rewrite') return JSON.stringify([kind, version.id, input.analysisId, [...(input.suggestionIds || [])].sort()]);
  if (kind === 'plan') return JSON.stringify([kind, version.id, evidence(job), Number(input.minutesPerDay || 30), clean(input.interviewDate)]);
  if (kind === 'compare') return JSON.stringify([kind, version.id, jobs.filter(j => (input.jobIds || []).includes(j.id)).sort((a,b) => a.id.localeCompare(b.id)).map(evidence)]);
  return JSON.stringify([kind, version.id, evidence(job), clean(input.question), clean(input.answer)]);
}
export function reusableTask(tasks, key) {
  const same = tasks.filter(t => t.operationKey === key);
  return same.find(t => t.status === 'completed') || same.find(t => ['queued','running','reconciling'].includes(t.status)) || null;
}
export function persistedJobEvaluation(job) {
  return Boolean(job && typeof job.score === 'number' && Number.isFinite(job.score)
    && (job.reportNum || job.summary?.trim() || job.match?.length) && !(!job.reportNum && job.priority === 'À évaluer'));
}
export function evaluationProjection(job, tasks = []) {
  const key=normalizeUrl(job?.url);
  const completed=key ? tasks.find(t=>t?.kind==='evaluate' && t?.status==='completed' && t?.result?.done && normalizeUrl(t?.input?.url)===key) : null;
  const completedScore=Number(completed?.result?.score);
  // A completed task is keyed by the exact normalized posting URL and profile.
  // Prefer that score over a candidature card that may have been hydrated by the
  // legacy company+role tracker matcher from a different posting.
  const score=Number.isFinite(completedScore) ? completedScore : typeof job?.score==='number' && Number.isFinite(job.score) ? job.score : job?.score;
  const evaluated=persistedJobEvaluation(job) || Boolean(completed);
  return {...job,...(evaluated&&Number.isFinite(Number(score))?{score:Number(score)}:{}),evaluationTaskId:completed?.id || null,evaluationState:evaluated?'evaluated':'discovered'};
}
export function discoveryProjection(discovery, jobs, tasks) {
  return { ...(discovery || {}), offers: (discovery?.offers || []).flatMap(offer => {
    const key = normalizeUrl(offer.url);
    if (!key) return [];
    const job = jobs.find(j => normalizeUrl(j.url) === key);
    const completed = tasks.find(t => t.kind === 'evaluate' && normalizeUrl(t.input?.url) === key && t.status === 'completed' && t.result?.done);
    if (persistedJobEvaluation(job) || completed) return [];
    const task = tasks.find(t => t.kind === 'evaluate' && normalizeUrl(t.input?.url) === key && ['queued','running','reconciling'].includes(t.status));
    const newestDeep=tasks.find(t=>t.kind==='deep_match' && normalizeUrl(t.input?.url || t.input?.offer?.url)===key);
    const deepCompleted=tasks.find(t=>t.kind==='deep_match' && normalizeUrl(t.input?.url || t.input?.offer?.url)===key && t.status==='completed' && t.result?.deepMatch);
    const deepActive=tasks.find(t=>t.kind==='deep_match' && normalizeUrl(t.input?.url || t.input?.offer?.url)===key && ['queued','running','reconciling'].includes(t.status));
    const deepFailed=tasks.find(t=>t.kind==='deep_match' && normalizeUrl(t.input?.url || t.input?.offer?.url)===key && ['failed','interrupted'].includes(t.status));
    return [{ ...offer, lifecycle: task ? 'evaluating' : 'discovered', taskId: task?.id || null, jobId: job?.id || null,
      deepMatch:deepCompleted?.result?.deepMatch || null,deepMatchState:deepActive?'loading':newestDeep&&['failed','interrupted'].includes(newestDeep.status)?'failed':deepCompleted?'ready':deepFailed?'failed':'pending',deepMatchTaskId:deepCompleted?.id || deepActive?.id || null }];
  }) };
}

export function normalizeAnalysis(result, taskId, cvText, resolutions = []) {
  const markdown = String(result?.markdown || '');
  let expressionIssues = Array.isArray(result?.expressionIssues) ? result.expressionIssues : [];
  const actionIssues = Array.isArray(result?.actionIssues) ? result.actionIssues : [];
  // Import explicit old before/after recommendations without paying an LLM to reanalyse unchanged evidence.
  if (!expressionIssues.length) {
    const pattern = /\*\*(?:当前|原文|Current|Before|Actuel(?:le)?|Avant)\s*[:：]?\*\*\s*\n+>\s*([^\n]+)[\s\S]*?\*\*(?:建议|修改后|Suggested|Proposed|After|Suggestion|Proposition|Après)\s*[:：]?\*\*\s*\n+>\s*([^\n]+)/gi;
    expressionIssues = [...markdown.matchAll(pattern)].map((m,i) => ({ id: `${taskId}-edit-${i+1}`, title: `CV · ${i+1}`, before: m[1].trim(), after: m[2].trim(), detail: m[2].trim(), evidence: 'Proposition explicite de l’analyse précédente' }));
  }
  const resolved = new Set(resolutions.map(r => r.issueId));
  const acceptedWording=new Set(resolutions.map(r=>r.after).filter(Boolean));
  const normalize = (items, prefix) => items.map((issue,i) => ({ ...issue, id: String(issue.id || `${taskId}-${prefix}-${i+1}`) })).filter(i => !resolved.has(i.id) && !(prefix === 'expression' && acceptedWording.has(i.before)));
  expressionIssues = normalize(expressionIssues,'expression').map(i => ({ ...i, applicable: Boolean(i.before && i.after && i.before !== i.after && cvText.split(i.before).length === 2) }));
  const sections = markdown.split(/(?=^#{1,4}\s)/m);
  return { ...result, markdown, expressionIssues, actionIssues: normalize(actionIssues,'action'),
    expressionMarkdown: sections.filter(s => /^#{1,4}\s[^\n]*(已有真实能力|建议的 CV|CV.*修改|改写|CV edits|reformul|expression)/i.test(s)).join('\n'),
    actionMarkdown: sections.filter(s => /^#{1,4}\s[^\n]*(真实.*(?:缺失|技能)|优先改进|实际.*差距|missing skills|real gaps|compétences.*manquant|actions à)/i.test(s)).join('\n'),
    resolvedCount: resolutions.length,
  };
}
export function applyEvidenceEdits(cv, issues, evidence) {
  if (!issues.length) throw new Error('Aucune reformulation précise applicable. Votre CV reste inchangé.');
  let draft = cv;
  const seen = new Set();
  for (const issue of issues) {
    if (seen.has(issue.id)) continue;
    seen.add(issue.id);
    if (!issue.before || !issue.after || draft.split(issue.before).length !== 2) throw new Error('Une suggestion ne correspond plus au CV actuel. Actualisez l’analyse après une modification réelle.');
    const numbers = issue.after.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
    if (numbers.some(n => !evidence.includes(n))) throw new Error('La proposition ajoute un chiffre non documenté. Validation manuelle nécessaire.');
    draft = draft.replace(issue.before, issue.after);
  }
  return draft;
}

export const CONTRACT_TYPES = ['Stage', 'Alternance', 'CDI', 'CDD'];
export function contractType(value) {
  const s = String(value || '').toLowerCase();
  if (/alternance|apprentice|apprentissage/.test(s)) return 'Alternance';
  if (/intern|\bstage\b/.test(s)) return 'Stage';
  if (/\bcdi\b|permanent|indefinite/.test(s)) return 'CDI';
  if (/\bcdd\b|fixed.term|durée déterminée/.test(s)) return 'CDD';
  return null;
}
export function contractMatches(offer, selected) {
  const declared = String(offer?.contractType || '').toLowerCase();
  const signal = declared && declared !== 'unknown' ? offer.contractType : (offer.contract || offer.title || offer.role);
  const actual = contractType(signal);
  return { type: actual, matches: !selected?.length || !actual || selected.includes(actual), confirmed: actual !== null };
}
