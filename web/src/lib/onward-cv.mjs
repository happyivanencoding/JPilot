/** Public uplift comes from a real, assessed document, never a hypothetical estimate. */
export function roleCvOutcome(value={}) {
 const draft=value.cvDraft;
 const match=(draft?.status==='pending'?draft.matchBasis:null)||value.cv?.matchBasis||value.v1Match||value.deepMatch||value;
 const baseline=Math.max(0,Math.min(100,Math.round(Number(match.currentScore??value.fastMatch?.score??0))));
 const deep=value.v1Match?.deepMatch||value.deepMatch||{};
 let actual=null,kind='none';
 if(draft?.status==='pending') {
   const assessment=draft.assessment;
   actual=assessment?.draftScore;
   if(actual!=null && assessment.scoringVersion!=='role-fit-2-cv') actual=Math.min(Number(match.cvPotentialScore ?? baseline),baseline+Math.max(0,Number(assessment.delta || 0)));
   kind='draft';
 }
 else if(value.cv?.file && value.cv.presentationScore!=null) { actual=value.cv.presentationScore;kind='accepted'; }
 else if(deep.preparedCvScore!=null) { actual=deep.preparedCvScore;kind='prepared'; }
 const ready=actual!=null && Number.isFinite(Number(actual));
 const score=ready?Math.max(baseline,Math.min(100,Math.round(Number(actual)))):baseline;
 return {baseline,score,gain:score-baseline,ready,kind};
}

/** Reuse the exact assessed content for this CV version, posting and document language. */
export function reusablePreparedCv(tasks,versionId,url,language,baseline) {
 const normalize=s=>String(s||'').trim().replace(/\/$/,'');
 for(const task of [...tasks].sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||''))) {
  const p=task.result?.preparedCv;
  if(task.kind==='deep_match' && task.status==='completed' && task.inputVersionId===versionId &&
     normalize(task.input?.url)===normalize(url) && p?.versionId===versionId && p.language===language &&
     p.matchBasis?.currentScore===baseline && p.assessment?.draftScore!=null && Number.isFinite(Number(p.assessment.draftScore)) && p.payload?.summary && Array.isArray(p.payload.experience)) return p;
 }
 return null;
}
