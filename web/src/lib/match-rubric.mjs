export const MATCH_METHOD='anchored-4x4-v1';
export const MATCH_CAPS={role:30,duties:30,tools_languages:20,level:20};
const text=(value,max=700)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
export function anchoredBreakdown(result) {
 if(result?.scoring_method!==MATCH_METHOD)throw new Error('Missing anchored scoring method');
 const rows=Object.entries(MATCH_CAPS).map(([key,max])=>{
  const rating=result.ratings?.[key],detail=result.score_rationale?.[key];
  if(!Number.isInteger(rating)||rating<0||rating>4||!text(detail?.reason))throw new Error(`Incomplete score detail: ${key}`);
  // Unknown is a declared provisional criterion, never an arbitrary model penalty.
  const normalizedRating=detail.unknown===true?2:rating;
  const points=Math.round(max*normalizedRating/4);
  return {key,max,rating:normalizedRating,points,deducted:max-points,reason:text(detail.reason),jobEvidence:text(detail.job_evidence),candidateEvidence:text(detail.cv_evidence),unknown:detail.unknown===true};
 });
 return {rows,components:Object.fromEntries(rows.map(r=>[r.key,r.points])),score:rows.reduce((sum,r)=>sum+r.points,0)};
}
export const ANCHORED_INSTRUCTIONS=`SCORING METHOD anchored-4x4-v1. Classify each independent criterion into rating 0,1,2,3,4; the SERVER maps role/duties to 0/8/15/23/30 points and tools_languages/level to 0/5/10/15/20. Never choose a free-form final score. Use the same anchors for every role:
0 = explicit fundamental mismatch; 1 = limited relevant foundation; 2 = partial fit with important remaining gaps; 3 = mostly fits the stated need; 4 = directly fits all the stated needs in this criterion. When the posting or CV gives too little information to assess the WHOLE criterion, use rating 2 and unknown=true; explain the missing information rather than inventing a shortfall. unknown=false otherwise, even if one minor detail remains unclear.
Separate criteria, do not count the same missing skill repeatedly:
role (30): occupational field and explicitly accepted study/domain only, never tools, prior duties, professional years or seniority. If the posting explicitly accepts a study field and the candidate studies that field, rate 4. Do NOT invent a more specialized degree requirement. Without an explicit study field, 4 means the same occupational domain, 3 an adjacent technical/domain foundation, 2 a general foundation, 1 weak connection, 0 unrelated required field. A seniority shortfall cannot reduce this criterion.
duties (30): direct/transferable examples for actual responsibilities at the posting's supervision level. Rate 4 when all required duty families have examples; 3 when most are covered by direct OR transferable examples with a limited unpractised activity; 2 when only some are covered and several major duty families lack examples; 1 when foundations exist but core responsibilities are largely unpractised; 0 when there is no relevant example. For a supervised student role explicitly requiring no prior employment, use student projects as full valid examples, do not demand end-to-end production ownership, and do not rate 2 merely because one activity will be learned on the job. Production ownership is relevant only when the posting actually requires it. Do not repeat tool/year penalties.
tools_languages (20): explicitly required practical tools and documented language proficiency. Optional nice-to-haves alone cannot lower this below rating 3. CV document/UI language is NOT proficiency. Do not invent required languages from country/company/name.
level (20): explicitly requested years, independence and qualifications versus the documented background. CDI alone does NOT mean senior. An apprenticeship asking for an enrolled Master student is a fit when the CV states that. Do not award fictitious professional years to a student, or penalize students for senior requirements absent from a junior posting.
For EVERY criterion provide score_rationale.<key> with a concise reason for its rating, short verbatim job_evidence and cv_evidence excerpts when available (empty if none), and unknown. Use maximum 35 words in reason. Explain exactly what lowers the rating; a fully matching criterion can say why it is full. One criterion's deducted points are calculated by the server, NOT by you. No extra global penalty, title-based bonus, score floor, lexical score or probability of hiring. Same title alone is not identical job content; ignore company prestige and order of search results.`;
