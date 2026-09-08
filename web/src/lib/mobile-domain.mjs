// Shared, deterministic mobile projections. The candidature store remains canonical.
export const UPLOAD_LIMIT = 12 * 1024 * 1024;
export const UPLOAD_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);
export const APPLICATION_STATUSES = ['À candidater', 'CV prêt', 'Candidature envoyée', 'Réponse reçue', 'Entretien', 'Offre reçue', 'Embauché', 'Refus', 'Archivée'];

export function hasRecordedFitScore(job) {
  return typeof job?.score === 'number' && Number.isFinite(job.score) && job.score >= 0 && job.score <= 5;
}

export function stageOf(status = '') {
  const s = String(status).toLocaleLowerCase('fr');
  if (/embauch|hired|accepté/.test(s)) return 'hired';
  if (/refus|reject/.test(s)) return 'rejected';
  if (/archiv|discard|skip/.test(s)) return 'archived';
  if (/offre reçue|^offer$/.test(s)) return 'offer';
  if (/entretien|interview/.test(s)) return 'interview';
  if (/réponse|respond/.test(s)) return 'responded';
  if (/envoy|applied/.test(s)) return 'applied';
  return 'preparing';
}

export function dashboardFor(jobs, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  const byStage = Object.fromEntries(['preparing', 'applied', 'responded', 'interview', 'offer', 'hired', 'rejected', 'archived'].map(k => [k, 0]));
  let sent = 0, replied = 0;
  for (const job of jobs) {
    const stage = stageOf(job.status);
    byStage[stage]++;
    const history = Array.isArray(job.statusHistory) ? job.statusHistory : [];
    const pastStages = history.flatMap(h => [h.status, h.from].filter(Boolean).map(stageOf));
    const sentStages = ['applied', 'responded', 'interview', 'offer', 'hired', 'rejected'];
    const replyStages = ['responded', 'interview', 'offer', 'hired', 'rejected'];
    const hasSent = sentStages.includes(stage) || pastStages.some(s => sentStages.includes(s));
    const humanReplies = (job.replies || []).filter(r => !/accusé auto|auto.?ack|automatic acknowledgment/i.test(String(r.kind || '')));
    const hasReply = replyStages.includes(stage) || pastStages.some(s => replyStages.includes(s)) || humanReplies.length > 0;
    if (hasSent) sent++;
    if (hasSent && hasReply) replied++;
  }
  const due = jobs.filter(j => j.followup?.dueDate && j.followup.dueDate <= today && !['hired', 'rejected', 'archived'].includes(stageOf(j.status)));
  const actionSets = Object.fromEntries(Object.keys(byStage).map(stage=>[stage,jobs.filter(j=>stageOf(j.status)===stage).map(j=>j.id)]));
  actionSets.all=jobs.map(j=>j.id);
  actionSets.high=jobs.filter(j=>hasRecordedFitScore(j)&&j.score>=4.25&&!['rejected','archived'].includes(stageOf(j.status))).map(j=>j.id);
  actionSets.due=due.map(j=>j.id);
  actionSets.decide=jobs.filter(j=>stageOf(j.status)==='preparing'&&hasRecordedFitScore(j)&&(j.reportNum||j.summary?.trim()||j.match?.length)&&!(!j.reportNum&&j.priority==='À évaluer')).map(j=>j.id);
  return {
    total: jobs.length, byStage, sent, replied, actionSets,
    responseRate: sent ? Math.round(replied / sent * 100) : null,
    responseRateDefinition: 'Candidatures envoyées avec une réponse enregistrée / candidatures envoyées. Les anciennes étapes sont déduites du statut courant lorsque leur date est inconnue.',
    highFit: jobs.filter(j => typeof j.score === 'number' && j.score >= 4 && !['rejected', 'archived'].includes(stageOf(j.status))).length,
    due: due.map(j => ({ id: j.id, company: j.company, role: j.role, ...j.followup })),
    recentReplies: jobs.flatMap(j => (j.replies || []).map(r => ({ ...r, jobId: j.id, company: j.company, role: j.role }))).sort((a,b) => String(b.at).localeCompare(String(a.at))).slice(0, 10),
  };
}

export function parseDiscoveredOffers(text) {
  const found = [], seen = new Set();
  for (const match of String(text).matchAll(/<<offer:(\{[^\r\n]*\})>>/g)) {
    try {
      const offer = JSON.parse(match[1]);
      const u = new URL(offer.url);
      if (!['https:', 'http:'].includes(u.protocol) || !offer.title || !offer.company || seen.has(u.href)) continue;
      seen.add(u.href);
      // Discovery does NOT have the authority to assign a compatibility score.
      const { score: _score, ...data } = offer;
      found.push({ ...data, url: u.href, verification: 'unconfirmed' });
    } catch { /* One malformed envelope must not hide other usable offers. */ }
  }
  return found;
}

export function parseCvProposal(text) {
  const error = String(text).match(/<<cv:error>>(\{[^\n]*\})/);
  if (error) throw new Error('Le CV n’a pas pu être lu : ' + error[1]);
  const match = String(text).match(/<<cv:start>>\s*\r?\n([\s\S]*?)\r?\n\s*<<cv:end>>/);
  if (!match?.[1]?.trim()) throw new Error('Aucun aperçu de CV exploitable. Votre CV actuel n’a pas été modifié.');
  return match[1].trim();
}

export function normalizeOffer(offer) {
  if (!offer || typeof offer !== 'object') throw new Error('Offre requise.');
  const url = new URL(String(offer.url || ''));
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('URL http(s) requise.');
  for (const key of ['company', 'title']) {
    if (typeof offer[key] !== 'string' || !offer[key].trim() || offer[key].length > 240) throw new Error('Entreprise et intitulé requis.');
  }
  return {
    url: url.href,
    company: offer.company.trim(),
    title: offer.title.trim(),
    location: String(offer.location || '').slice(0,300),
    country: String(offer.country || '').slice(0,100),
    why: String(offer.why || '').slice(0,3000),
    description: String(offer.description || '').slice(0,12000),
    source: String(offer.source || 'unknown-search').slice(0,100),
    sourceLabel: String(offer.sourceLabel || offer.source || '').slice(0,160),
    verification: 'unconfirmed',
    postedHint: String(offer.postedHint || '').slice(0,100),
    postedAt: offer.postedAt ? String(offer.postedAt).slice(0,100) : null,
    contractType: String(offer.contractType || offer.contract || '').slice(0,100),
    contractOptions: Array.isArray(offer.contractOptions) ? offer.contractOptions.map(x => String(x)).filter(x => ['Stage','Alternance','CDI','CDD'].includes(x)).slice(0,4) : [],
    direct: offer.direct === true,
    remote: offer.remote === true,
    searchRelevance: offer.searchRelevance !== null && offer.searchRelevance !== undefined && Number.isFinite(Number(offer.searchRelevance)) ? Number(offer.searchRelevance) : null,
    relevanceTier: ['strong','adjacent','closest'].includes(String(offer.relevanceTier || '')) ? String(offer.relevanceTier) : null,
    seniorityFit: ['above-target','target-or-unknown'].includes(String(offer.seniorityFit || '')) ? String(offer.seniorityFit) : null,
    roleFit: ['outside-primary','target-or-unknown'].includes(String(offer.roleFit || '')) ? String(offer.roleFit) : null,
    locationFit: ['target','target-or-unknown','remote-compatible','same-country','europe-other','outside-target','outside-europe','unknown'].includes(String(offer.locationFit || '')) ? String(offer.locationFit) : null,
    dataQuality: offer.dataQuality !== null && offer.dataQuality !== undefined && Number.isFinite(Number(offer.dataQuality)) ? Number(offer.dataQuality) : null,
    ageDays: offer.ageDays !== null && offer.ageDays !== undefined && Number.isFinite(Number(offer.ageDays)) ? Number(offer.ageDays) : null,
  };
}

export function applyJobUpdate(job, change, now = new Date().toISOString()) {
  const out = structuredClone(job);
  out.followup ||= { nextAction: '', dueDate: '', note: '' };
  if (change.status !== undefined) {
    if (!APPLICATION_STATUSES.includes(change.status)) throw new Error('Statut inconnu.');
    if (change.status !== out.status) {
      out.statusHistory = [...(out.statusHistory || []), { at: now, from: out.status, status: change.status }];
      out.status = change.status;
    }
  }
  for (const k of ['nextAction', 'note']) {
    if (change[k] !== undefined) {
      if (typeof change[k] !== 'string' || change[k].length > 12000) throw new Error('Texte invalide.');
      out.followup[k] = change[k];
      if(k === "nextAction") out.followup.nextActionSource = "user";
    }
  }
  if (change.dueDate !== undefined) {
    if (change.dueDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(change.dueDate)) throw new Error('Date attendue : AAAA-MM-JJ.');
    out.followup.dueDate = change.dueDate;
  }
  if (change.reply !== undefined) {
    if (typeof change.reply !== 'string' || !change.reply.trim() || change.reply.length > 12000) throw new Error('Réponse vide ou trop longue.');
    out.replies = [...(out.replies || []), { at: now, text: change.reply.trim(), kind: String(change.replyKind || 'Réponse').slice(0,100) }];
  }
  if (change.taskId && typeof change.taskDone === 'boolean') {
    out.prepTasks = (out.prepTasks || []).map(t => t.id === change.taskId ? { ...t, done: change.taskDone } : t);
  }
  out.updatedAt = now;
  return out;
}
