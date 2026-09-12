/** Public uplift comes from a real, assessed document, never a hypothetical estimate. */
export function roleCvOutcome(value={}) {
 const draft=value.cvDraft;
 const match=(draft?.status==='pending'?draft.matchBasis:null)||value.cv?.matchBasis||value.v1Match||value.deepMatch||value;
 const baseline=Math.max(0,Math.min(100,Math.round(Number(match.currentScore??value.fastMatch?.score??0))));
 let actual=null,kind='none';
 if(draft?.status==='pending') {
   const assessment=draft.assessment;
   actual=assessment?.draftScore;
   if(actual!=null && assessment.scoringVersion!=='role-fit-2-cv') actual=Math.min(Number(match.cvPotentialScore ?? baseline),baseline+Math.max(0,Number(assessment.delta || 0)));
   kind='draft';
 }
 else if(value.cv?.file && value.cv.presentationScore!=null) { actual=value.cv.presentationScore;kind='accepted'; }
 const ready=actual!=null && Number.isFinite(Number(actual));
 const score=ready?Math.max(baseline,Math.min(100,Math.round(Number(actual)))):baseline;
 return {baseline,score,gain:score-baseline,ready,kind};
}
