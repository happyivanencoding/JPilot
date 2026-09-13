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

const boundedScore=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
const quickKind=item=>{
 const declared=String(item?.kind||'');
 if(['confirm_existing','quick_build'].includes(declared))return declared;
 const text=`${item?.title||''} ${item?.why||''} ${item?.nextAction||item?.next_action||''}`.toLowerCase();
 return /clarif|confirm|mention|add |ajout|précis|补充|确认|说明|写出|体现/.test(text)?'confirm_existing':'quick_build';
};
const normalizedQuickBoost=item=>({
 kind:quickKind(item),
 title:String(item?.title||'').trim(),
 why:String(item?.why||'').trim(),
 nextAction:String(item?.nextAction||item?.next_action||'').trim(),
 potential:Math.max(1,Math.min(10,Math.round(Number(item?.potential)||1))),
});

/**
 * Three-step role-CV journey used by the V1 Optimize CV surface.
 * 1) current role fit; 2) fit after better presentation of existing facts;
 * 3) estimated potential after a small set of realistic quick boosts.
 */
export function roleCvJourney(value={}) {
 const draft=value.cvDraft;
 const match=(draft?.status==='pending'?draft.matchBasis:null)||value.cv?.matchBasis||value.v1Match||value.deepMatch||value;
 const deep=match?.deepMatch||value.v1Match?.deepMatch||value.deepMatch||{};
 const outcome=roleCvOutcome(value);
 const current=boundedScore(match?.currentScore??deep?.currentScore??outcome.baseline);
 const cvPotential=Math.max(current,boundedScore(match?.cvPotentialScore??deep?.cvPotentialScore??current));
 const optimised=outcome.ready?Math.max(current,boundedScore(outcome.score)):cvPotential;
 const explicit=Array.isArray(deep?.quickBoosts)?deep.quickBoosts:[];
 const fallback=Array.isArray(deep?.capabilityGaps)?deep.capabilityGaps:[];
 const quickBoosts=(explicit.length?explicit:fallback).map(normalizedQuickBoost).filter(item=>item.title).slice(0,4);
 const rawCapability=Math.max(optimised,boundedScore(match?.capabilityPotentialScore??deep?.capabilityPotentialScore??optimised));
 // Historical Deep Match results predate quick_boosts and their capability
 // ceiling could include long-term learning. Bound those old results by the
 // concrete gap potentials until the refreshed quick-boost contract arrives.
 const fallbackLift=quickBoosts.reduce((sum,item)=>sum+item.potential,0);
 const capability=explicit.length?rawCapability:Math.max(optimised,Math.min(rawCapability,optimised+fallbackLift));
 return {
   current,
   optimised,
   optimisedEstimated:!outcome.ready,
   capability,
   expressionGain:Math.max(0,optimised-current),
   totalGain:Math.max(0,capability-current),
   quickBoosts,
 };
}
