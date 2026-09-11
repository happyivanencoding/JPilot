/** Compare wording against one frozen role assessment, not a second presentation rubric. */
export function roleCvReviewPrompt({basis,master,draft,job,locale='en'}) {
  return `Review the actual tailored CV against the SAME frozen role-match assessment below. Do not re-evaluate the candidate or change the baseline, requirements, strengths or actual capability gaps. Compare by meaning across French and English. Document language is NOT language ability. Only a documented proficiency and an explicit job requirement can be a language gap.
The frozen baseline is ${basis.currentScore}/100. Its earlier CV-edit estimate ${basis.cvPotentialScore}/100 is an upper bound, NOT a promised result. Award only improvements actually present in this draft. No credit for suggested future edits, invented abilities or keyword stuffing. Missing capability remains missing; clearer wording cannot resolve it. A net negative improvement is allowed in raw_draft_score; the product separately preserves the existing baseline for display.
Use the original role-fit-2 rubric: role/domain 30, duties/transferable experience 30, tools/required language skills 20, actual level/requirements 20. Do NOT substitute a CV-writing score. Identify concrete before/after wording in improvements, at most three brief items; remaining_gaps come only from the frozen capability gaps. Do not tell the applicant to prove themselves. No self-criticism or missing-skills disclaimers should be added to the actual CV.
Return JSON only: {"raw_draft_score":0,"summary":"one concise sentence","improvements":["actual change and its benefit"],"remaining_gaps":["remaining practical gap"]}. All explanations in ${locale}.
FROZEN ROLE ASSESSMENT: ${JSON.stringify(basis)}
POSTING: ${JSON.stringify(job)}
ORIGINAL CV: ${master}
ACTUAL DRAFT: ${draft}`;
}
export function normalizeRoleCvReview(basis, result) {
  const raw=Number(result.raw_draft_score);
  if(!Number.isFinite(raw))throw new Error('Invalid role CV review score');
  const baselineScore=Math.round(Number(basis.currentScore));
  const ceiling=Math.max(baselineScore,Math.min(100,Number(basis.cvPotentialScore ?? baselineScore)));
  const rawDraftScore=Math.max(0,Math.min(100,Math.round(raw)));
  const draftScore=Math.max(baselineScore,Math.min(ceiling,rawDraftScore));
  const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).slice(0,3):[];
  return {scoringVersion:'role-fit-2-cv',baselineScore,rawDraftScore,draftScore,delta:draftScore-baselineScore,
    needsSubstantiveImprovement:draftScore===baselineScore,summary:String(result.summary || '').slice(0,800),
    improvements:draftScore>baselineScore?list(result.improvements):[],remainingGaps:list(result.remaining_gaps)};
}
