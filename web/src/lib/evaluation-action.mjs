// Completing an evaluation must retire only system-owned "evaluate first" text.
// User-authored follow-up notes, dates and decisions remain untouched.
export function evaluationAction(machine) {
  const decision=String(machine.final_decision || '').trim().toLowerCase();
  const recommendation=/^(skip|discard|do not apply|not apply|no[ _-]?go)$/.test(decision)
    ? 'À écarter selon l’évaluation'
    : /^(apply|go|candidater)$/.test(decision) ? 'Candidater' : 'À décider après revue';
  const nextAction=typeof machine.next_action==='string' && machine.next_action.trim()
    ? machine.next_action.trim() : 'Relire l’analyse, préparer les écarts puis décider de la candidature.';
  return {recommendation,nextAction};
}
export function evaluationSummary(notes) {
  return String(notes || '').split(';').filter(part=>!/^\s*(?:profile|posted):/i.test(part)).join(';').trim();
}
export function retirePendingEvaluation(job,machine) {
  const action=evaluationAction(machine);
  const patch={};
  if(job.analysisSource==='official-report' && typeof job.summary==='string') {
    const summary=evaluationSummary(job.summary);
    if(summary!==job.summary)patch.summary=summary;
  }
  if(!job.recommendation || job.recommendation==='Évaluation officielle nécessaire')patch.recommendation=action.recommendation;
  if(!job.followup?.nextAction || job.followup.nextAction==='Évaluer la compatibilité avant de candidater') {
    patch.followup={...(job.followup || {}),nextAction:action.nextAction};
  }
  return patch;
}
