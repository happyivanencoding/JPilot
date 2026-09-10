// Browser projections only. Business identity, scores, history and writes stay in the mobile backend.
export const PHONE = Object.freeze({ width: 384, height: 832 }); // USB reference: 1440×3120, density 600.
export const TABS = ['home', 'offers', 'profile'];
export const ACTIVE = new Set(['queued', 'running', 'reconciling']);
export function validScore(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5 ? value : null; }
export function filteredJobs(jobs = [], sets = {}, filter = '', query = '') {
  const key = filter || 'all';
  const ids = Array.isArray(sets[key]) ? new Set(sets[key]) : null;
  const q = query.trim().toLocaleLowerCase();
  return jobs.filter(j => (ids ? ids.has(j.id) : !filter || j.stage === filter || j.status === filter)
    && `${j.company || ''} ${j.role || ''}`.toLocaleLowerCase().includes(q))
    .sort((a, b) => (validScore(b.score) ?? -1) - (validScore(a.score) ?? -1));
}
export function centerTasks(tasks = []) {
  const seen = new Set();
  const recent = tasks.filter(t => {
    if (ACTIVE.has(t.status)) return false;
    const key = `${t.kind}:${t.inputVersionId || ''}:${t.jobId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 3);
  return [...tasks.filter(t => ACTIVE.has(t.status)), ...recent];
}
export function safeExternalUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function parseRoute(search = '') {
  const p = new URLSearchParams(search);
  const route = { tab: TABS.includes(p.get('tab')) ? p.get('tab') : 'home', filter: p.get('filter') || '' };
  for (const key of ['view', 'job', 'task', 'draft', 'report', 'jobTab', 'ids']) if (p.get(key)) route[key] = p.get(key);
  if (route.job && !route.view) route.view = 'job';
  if (route.task && !route.view) route.view = 'task';
  if (!['tasks', 'task', 'job', 'analysis', 'report', 'pdf', 'compare', 'edit-cv', 'applications', 'prepare', 'settings'].includes(route.view)) delete route.view;
  return route;
}
export function routeUrl(route) {
  const p = new URLSearchParams();
  for (const key of ['tab', 'filter', 'view', 'job', 'jobTab', 'task', 'draft', 'report', 'ids']) {
    if (route[key] && !(key === 'tab' && route[key] === 'home')) p.set(key, route[key]);
  }
  return '/' + (p.size ? '?' + p.toString() : '');
}
export function destinationFor(task) {
  if (task.status !== 'completed') return { view: 'task', task: task.id };
  const job = task.destination?.jobId || task.result?.jobId || task.jobId;
  switch (task.kind) {
    case 'analysis': return { tab: 'profile', view: 'analysis' };
    case 'search': return { tab: 'offers' };
    case 'evaluate': return job ? { tab: 'profile', view: 'job', job } : { tab: 'profile', view: 'applications' };
    case 'plan': return job ? { tab: 'profile', view: 'job', job, jobTab: '2' } : { tab: 'profile', view: 'prepare' };
    case 'cv': return job ? { tab: 'profile', view: 'job', job, jobTab: '1' } : { tab: 'profile', view: 'applications' };
    case 'cv_review': return job ? { tab: 'profile', view: 'job', job, jobTab: '1' } : { tab: 'profile', view: 'applications' };
    case 'rewrite': return { tab: 'profile', view: 'pdf', draft: task.result?.draftId || task.destination?.draftId };
    default: return { view: 'task', task: task.id };
  }
}
export function pendingDisplay(value) { return value?.localization?.pending === true && !value.localization.failed; }
export function desktopScale(width, height) { return Math.min(1, Math.max(0.1, (width - 32) / PHONE.width), Math.max(0.1, (height - 32) / PHONE.height)); }
export function legacyDestination(path) {
  const parts = path.split('/').filter(Boolean);
  const map = { explore: { tab: 'offers' }, pipeline: { tab: 'profile', view: 'applications' }, candidatures: { tab: 'profile', view: 'applications' }, apply: { tab: 'profile', view: 'applications' }, followups: { tab: 'profile', view: 'applications', filter: 'due' }, cv: { tab: 'profile' }, config: { tab: 'profile', view: 'settings' }, portals: { tab: 'offers' }, analytics: { tab: 'home' }, jobs: { view: 'tasks' } };
  if (parts[0] === 'pipeline' && parts[1]) return routeUrl({ tab: 'profile', view: 'job', job: parts[1] });
  if (parts[0] === 'jobs' && parts[1]) return routeUrl({ view: 'task', task: parts[1] });
  return routeUrl(map[parts[0]] || { tab: 'home' });
}
