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
const finiteScore=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
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
 * 1) current Deep Match; 2) fixed Deep Match estimate after better presentation;
 * 3) estimated potential after a small set of realistic boosts.
 *
 * Scores stay hidden until the current Deep Match contract is ready. Accepting
 * the generated role CV promotes the visible current score to step 2; the CV
 * review rubric remains internal feedback and never replaces that fixed target.
 */
export function roleCvJourney(value={}) {
 const draft=value.cvDraft;
 const match=(draft?.status==='pending'?draft.matchBasis:null)||value.cv?.matchBasis||value.v1Match||value.deepMatch||value;
 const deep=match?.deepMatch||value.v1Match?.deepMatch||value.deepMatch||{};
 const deepState=String(value.enrichment?.deepMatchState||'');
 const currentContract=Array.isArray(deep?.quickBoosts);
 const ready=(deepState?deepState==='ready':currentContract) && currentContract && finiteScore(deep?.currentScore??match?.currentScore);
 if(!ready) return {current:null,optimised:null,optimisedEstimated:true,capability:null,expressionGain:null,totalGain:null,quickBoosts:[],ready:false,accepted:false};
 const baseline=boundedScore(deep?.currentScore??match?.currentScore);
 const optimised=finiteScore(deep?.cvPotentialScore??match?.cvPotentialScore)?Math.max(baseline,boundedScore(deep?.cvPotentialScore??match?.cvPotentialScore)):null;
 const capability=optimised!=null&&finiteScore(deep?.capabilityPotentialScore??match?.capabilityPotentialScore)?Math.max(optimised,boundedScore(deep?.capabilityPotentialScore??match?.capabilityPotentialScore)):null;
 const accepted=Boolean(value.cv?.file && value.cv?.matchBasis) || draft?.status==='accepted';
 const current=accepted&&optimised!=null?optimised:baseline;
 const explicit=Array.isArray(deep?.quickBoosts)?deep.quickBoosts:[];
 const quickBoosts=explicit.map(normalizedQuickBoost).filter(item=>item.title).slice(0,4);
 return {
   current,
   optimised,
   optimisedEstimated:!accepted,
   capability,
   expressionGain:optimised==null?null:Math.max(0,optimised-baseline),
   totalGain:capability==null?null:Math.max(0,capability-baseline),
   quickBoosts,
   ready:true,
   accepted,
 };
}
