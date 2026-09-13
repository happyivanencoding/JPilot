import {roleCvOutcome} from './onward-cv.mjs';
import {MATCH_METHOD,ANCHORED_INSTRUCTIONS,anchoredBreakdown} from "./match-rubric.mjs";
import {normalizeUrl} from "./posting-url.mjs";
import {repairOfferText} from './text-repair.mjs';
// V1 student-facing match layer. This is deliberately separate from the legacy
// 0-5 official evaluation: Fast Fit is an internal ranking/prefetch signal, while
// deep_match is the user-visible 0-100 fit assessment. Neither one writes an
// application or official report.
export const V1_DEEP_MATCH_PREFETCH_LIMIT = 5;
export const V1_MATCH_VERSION = 'v1-fast-fit-3-intent-first';

const STOP = new Set([
  'and','the','for','with','from','your','you','our','this','that','will','are','des','les','une','un','pour','avec','dans','sur','vos','votre','aux','du','de','la','le','et','en',
  'job','jobs','role','roles','poste','postes','emploi','offre','offres','candidate','candidat','candidature','experience','expérience','skills','skill','compétences','competences',
  'junior','intern','internship','stage','cdi','cdd','alternance','assistant','analyst','analyste','manager','specialist','specialiste','responsable',
]);
const TOOL_ALIASES = [
  ['sql',['sql','postgresql','mysql','snowflake','bigquery']],
  ['python',['python','pandas','numpy','scikit-learn','sklearn','pytorch','tensorflow']],
  ['excel',['excel','vba','power query','powerquery']],
  ['power bi',['power bi','powerbi']],
  ['tableau',['tableau']],
  ['salesforce',['salesforce']],
  ['crm',['crm','customer relationship management']],
  ['google analytics',['google analytics','ga4']],
  ['seo',['seo','search engine optimization']],
  ['sem',['sem','paid search','sea']],
  ['sap',['sap']],
  ['bloomberg',['bloomberg']],
  ['aladdin',['aladdin']],
  ['r',[' r ','r studio','rstudio']],
  ['sas',['sas']],
  ['matlab',['matlab']],
  ['java',['java']],
  ['c++',['c++']],
  ['javascript',['javascript','typescript','node.js','nodejs']],
  ['git',['git','github','gitlab']],
  ['docker',['docker']],
  ['kubernetes',['kubernetes','k8s']],
  ['aws',['aws','amazon web services']],
  ['azure',['azure']],
  ['gcp',['gcp','google cloud']],
  ['jira',['jira']],
  ['agile',['agile','scrum']],
  ['figma',['figma']],
  ['powerpoint',['powerpoint','ppt']],
];
const DOMAIN_ALIASES = [
  ['sales',['sales','commercial','commerciale','vente','ventes','client','customer','export','prospection','prospect']],
  ['logistics',['logistics','logistique','supply chain','approvisionnement','inventory','stock']],
  ['marketing',['marketing','brand','consumer','campaign','crm','growth','acquisition']],
  ['data',['data','analytics','analysis','analytique','dashboard','reporting','statistics','statistique']],
  ['finance',['finance','financial','investment','asset management','portfolio','risk','fixed income','credit','market']],
  ['consulting',['consulting','consultant','conseil','strategy','stratégie']],
  ['product',['product','produit','roadmap','user research','go-to-market','gtm']],
  ['operations',['operations','opérations','process','processus','supply chain','procurement']],
];

function clean(value,max=30000){return String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function norm(value){return ` ${clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()} `;}
function tokens(value){return [...new Set(norm(value).split(/[^\p{L}\p{N}+#.]+/u).filter(t=>t.length>=3&&!STOP.has(t)))];}
function clamp(value,min=0,max=100){return Math.max(min,Math.min(max,Math.round(Number(value)||0)));}
function titleCase(value){return String(value||'').trim().replace(/\s+/g,' ');}
function aliasHits(text,groups){const n=norm(text);return groups.filter(([,aliases])=>aliases.some(alias=>n.includes(` ${norm(alias).trim()} `)||n.includes(norm(alias).trim()))).map(([label])=>label);}
function overlap(a,b){if(!a.size||!b.size)return 0;let hit=0;for(const token of a)if(b.has(token))hit++;return hit/Math.max(5,Math.min(a.size,b.size));}
function evidenceText(candidate){return [candidate?.sources?.cv?.text,candidate?.sources?.config?.text,candidate?.sources?.notes?.text].map(value=>clean(value)).join('\n');}
function offerText(offer){return [offer?.title,offer?.description,offer?.why,offer?.location,offer?.contractType].map(value=>clean(value)).join('\n');}

const BREAKDOWN_TITLES={
  role:'Direct role fit',duties:'Responsibilities to strengthen',tools_languages:'Tools / languages to clarify',level:'Level / scope to clarify',
};
function safeStructuredStrings(value,limit){
  return (Array.isArray(value)?value:[]).map(x=>clean(x,1200))
    .map(x=>x.replace(/\s*\]\s*,?\s*$/,'').trim())
    .filter(x=>x&&!/^(requirements?|requirements?\s*\[|任职要求\s*\[|tools?\s*\[)/i.test(x))
    .slice(0,limit);
}
function breakdownFallback(rows){
  const source=Array.isArray(rows)?rows:[];
  const strengths=source.filter(row=>Number(row?.rating)>=3).slice(0,3).map(row=>({
    title:BREAKDOWN_TITLES[row.key]||'Relevant fit',
    evidence:[clean(row?.reason,700),clean(row?.candidateEvidence,500)].filter(Boolean).join(' '),
    impact:Math.max(1,Math.min(10,Math.round(Number(row?.rating||1)*2.5))),
    fallback:true,
  }));
  const capabilityGaps=source.filter(row=>Number(row?.rating)<=2&&Number(row?.deducted)>0).slice(0,4).map(row=>({
    title:BREAKDOWN_TITLES[row.key]||'Area to clarify',
    why:clean(row?.reason,900),
    nextAction:'',
    potential:Math.max(1,Math.min(10,Math.round(Number(row?.deducted||1)/3))),
    fallback:true,
  }));
  return {strengths,capabilityGaps};
}

export function fastMatchOffer(candidate,config,offer){
  const candidateText=evidenceText(candidate), jobText=offerText(offer);
  const cvTools=aliasHits(candidateText,TOOL_ALIASES), jobTools=aliasHits(jobText,TOOL_ALIASES);
  const cvDomains=aliasHits(candidateText,DOMAIN_ALIASES), jobDomains=aliasHits(jobText,DOMAIN_ALIASES);
  const cvTokens=new Set(tokens(candidateText)), jobTokens=new Set(tokens(`${offer?.title||''} ${clean(offer?.description,9000)}`));
  const lexical=Math.min(100,Math.round(overlap(cvTokens,jobTokens)*220));
  const toolCoverage=jobTools.length?Math.round(jobTools.filter(x=>cvTools.includes(x)).length/jobTools.length*100):Math.min(80,lexical+10);
  const domainCoverage=jobDomains.length?Math.round(jobDomains.filter(x=>cvDomains.includes(x)).length/jobDomains.length*100):Math.min(80,lexical+5);
  // Fast Fit predicts the same four dimensions as Deep Match, but cheaply. It
  // is intentionally NOT search relevance: an explicit career switch should
  // still surface the occupation the user asked for even when current fit is low.
  const rolePct=clamp(domainCoverage*.75+lexical*.25);
  const dutiesPct=clamp(lexical);
  const toolsPct=jobTools.length?clamp(Math.min(75,toolCoverage)):60;
  const levelPct=offer?.seniorityFit==='above-target'?25:65;
  const components={
    role:Math.round(30*rolePct/100),
    duties:Math.round(30*dutiesPct/100),
    tools_languages:Math.round(20*toolsPct/100),
    level:Math.round(20*levelPct/100),
  };
  let score=Object.values(components).reduce((sum,value)=>sum+value,0);
  const notes=[];
  if(offer?.seniorityFit==='above-target')notes.push('seniority');
  if(offer?.roleFit==='outside-primary')notes.push('role');
  if(offer?.locationFit==='outside-europe'||offer?.locationFit==='outside-target'||offer?.locationFit==='europe-other')notes.push('location');
  score=clamp(score,18,96);
  const strengths=[];
  for(const tool of jobTools.filter(x=>cvTools.includes(x)).slice(0,3)) strengths.push({title:tool,type:'tool',evidence:`CV 中已出现 ${tool}`});
  for(const domain of jobDomains.filter(x=>cvDomains.includes(x)).slice(0,2)) if(!strengths.some(x=>x.title===domain)) strengths.push({title:domain,type:'domain',evidence:`经历中已有 ${domain} 相关信号`});
  if(!strengths.length && lexical>=30) strengths.push({title:'可迁移经历',type:'transferable',evidence:'简历与岗位描述存在多项直接词汇/职责重合'});
  const gaps=[];
  for(const tool of jobTools.filter(x=>!cvTools.includes(x)).slice(0,4)) gaps.push({title:tool,type:'not-demonstrated',reason:`岗位描述提到 ${tool}，当前档案未发现明确证据`});
  if(offer?.seniorityFit==='above-target')gaps.push({title:'经验年限 / seniority',type:'constraint',reason:'岗位资历可能高于当前目标'});
  if(offer?.locationFit==='outside-europe'||offer?.locationFit==='outside-target')gaps.push({title:'地点适配',type:'constraint',reason:'地点偏离当前偏好，需要确认可接受性'});
  // Bridgeability measures whether the gap is realistically actionable. Missing
  // tools/projects reduce it mildly; explicit seniority/leadership gaps reduce it
  // strongly. This signal only nudges ranking inside the requested occupation.
  let bridgeability=82;
  bridgeability-=Math.min(20,jobTools.filter(x=>!cvTools.includes(x)).length*5);
  if(offer?.seniorityFit==='above-target')bridgeability-=35;
  if(offer?.roleFit==='outside-primary')bridgeability-=12;
  bridgeability=clamp(bridgeability,20,95);
  const roleHint=titleCase(offer?.title);
  return {
    version:V1_MATCH_VERSION,score,confidence:jobText.length>500?'medium':'low',
    bridgeability,
    roleHint, strengths:strengths.slice(0,4),gaps:gaps.slice(0,4),
    components,signals:{lexical,toolCoverage,domainCoverage},notes,
    disclaimer:'快速匹配用于探索，不代表录用概率。',
  };
}

export function enrichOffersWithFastMatch(candidate,config,offers){
  const tier={strong:3,adjacent:2,closest:1};
  return (Array.isArray(offers)?offers:[]).map(offer=>{
    const fastMatch=fastMatchOffer(candidate,config,offer);
    // Search intent remains dominant. Fast Fit and bridgeability are bounded
    // tie-breakers, so a career switcher's low current fit cannot replace the
    // occupation they explicitly asked to explore.
    const searchRank=Number.isFinite(Number(offer?.rankScore))?clamp(offer.rankScore):clamp(offer?.searchRelevance ?? 50);
    const discoveryRank=Math.round(searchRank*.82+fastMatch.bridgeability*.12+fastMatch.score*.06);
    return {...offer,fastMatch,discoveryRank};
  }).sort((a,b)=>(tier[b.relevanceTier]||0)-(tier[a.relevanceTier]||0)
    ||(b.discoveryRank||0)-(a.discoveryRank||0)
    ||(b.rankScore||0)-(a.rankScore||0)
    ||(a.ageDays??9999)-(b.ageDays??9999));
}

export function deepMatchPrompt({candidate,offer,fastMatch,jobIntelligence,language='en'}){
 return `You are a practical career guide assessing ONE real role for this candidate. Use the original CV, not assumptions about nationality, names or job titles. No tools, applications or invented achievements.
OUTPUT LANGUAGE: ${language}.
Give one coherent job-match score on a 0-100 scale. The supplied fastMatch is a lexical retrieval hint ONLY, not the final score. English CVs and French vacancies must be compared by meaning, not shared word counts. Never infer language proficiency from the language of the CV, UI, name or nationality. Only compare a documented proficiency with an explicit job-language requirement; unknown proficiency is a question, not a failure.
${ANCHORED_INSTRUCTIONS}
Anchors: below 40 = major role/domain gaps; 40-59 = a stretch with important experience/skill gaps; 60-74 = a credible junior candidate with relevant education and transferable experience; 75-89 = a strong direct fit; 90-100 = unusually complete match. A junior posting does NOT require a senior's experience; association/student projects count as transferable work, not senior ownership. Do not invent a floor or award points just to please the user. A clearly senior/specialised unrelated role can legitimately score below 60.
cv_potential_score is an estimate after selecting and expressing EXISTING facts better, current_score to at most current_score+18. Better writing cannot add missing years, specialist qualifications or language fluency. capability_potential_score is the estimated TOTAL after the quick_boosts below are genuinely confirmed/completed; it is not the visible CV-edit score and must not assume years of experience, a new degree or a long retraining path.
Use everyday language, 2-3 strengths, at most 2 CV edits and 2 gaps. Also return 3-4 quick_boosts when credible, ranked by likely role-fit impact relative to user effort. quick_boosts may mix: (a) confirm_existing — a capability the candidate may plausibly already have but the CV does not state clearly enough to score, and (b) quick_build — a concrete short project, focused knowledge module, or genuinely job-relevant certificate/tool practice that can realistically be completed quickly. Never invent that the candidate already did something; confirm_existing must be phrased conditionally. Do not recommend generic certificates, multi-year experience, a whole degree, or vague advice such as “improve communication”. If fewer than 3 honest quick boosts exist, return fewer rather than fabricate them. capability_potential_score should reflect only these quick boosts.
Titles at most 8 words. Give each strength 2 useful sentences linking a specific CV example to a real job duty. Responsibilities must be 4-6 concrete duties phrased so a non-specialist immediately understands what the person actually does; avoid corporate jargon and vague verbs. Requirements must contain only candidate qualifications or hard selection criteria such as degree/field of study, required language level, tools/skills, prior experience, certification, or an explicit start month/date. Do NOT repeat the contract type, internship duration, work location, remote/on-site mode or no-travel condition as a requirement when those are already job metadata. If a precise start month/date is stated, that timing may remain. For each edit or gap explain what to improve and a concrete, realistic next action, in 30-65 words total. No filler. Never put scoring formulas, criterion weights, awarded/deducted points or instructions for gaming a score into these user-facing explanations; keep numeric reasoning only in ratings and score_rationale. Avoid 'proven', 'not demonstrated', 'evidence not found', 'proof', audit/process narration and lectures. For a known shortfall say 'Limited export administration experience'. For an unknown ability use 'Clarify your Portuguese level' rather than claiming the candidate cannot speak Portuguese. State practical actions, not defence of your reasoning.
Return exactly one JSON object (no fence):
{"scoring_version":"role-fit-2","scoring_method":"anchored-4x4-v1","ratings":{"role":2,"duties":2,"tools_languages":2,"level":2},"score_rationale":{"role":{"reason":"rating explanation","job_evidence":"short verbatim excerpt or empty","cv_evidence":"short verbatim excerpt or empty","unknown":false},"duties":{"reason":"rating explanation","job_evidence":"excerpt or empty","cv_evidence":"excerpt or empty","unknown":false},"tools_languages":{"reason":"rating explanation","job_evidence":"excerpt or empty","cv_evidence":"excerpt or empty","unknown":false},"level":{"reason":"rating explanation","job_evidence":"excerpt or empty","cv_evidence":"excerpt or empty","unknown":false}},"role_summary":"plain-language description","responsibilities":["4-6 plain-language duties"],"requirements":[{"title":"hard qualification or selection criterion","kind":"must|nice","why":"brief"}],"tools":["explicit tools"],"strengths":[{"title":"strength","evidence":"specific example","impact":1}],"presentation_gaps":[{"title":"CV edit","why":"practical improvement","potential":1}],"capability_gaps":[{"title":"gap or practical check","why":"what this role needs","next_action":"one useful step","potential":1}],"quick_boosts":[{"kind":"confirm_existing|quick_build","title":"specific quick boost","why":"why it matters for this role","next_action":"what to confirm or complete","potential":1}],"cv_potential_score":0,"capability_potential_score":0,"cv_potential_reason":"one brief reason","confidence":"low|medium|high"}
CV AND CANDIDATE NOTES: ${JSON.stringify({cv:clean(candidate?.sources?.cv?.text,40000),notes:clean(candidate?.sources?.notes?.text,5000)})}
POSTING: ${JSON.stringify({title:clean(offer?.title,300),description:clean(offer?.description,18000),contractType:offer?.contractType})}`;
}

export function normalizeDeepMatch(result,fastMatch){
  const anchored=result?.scoring_method===MATCH_METHOD?anchoredBreakdown(result):null;
  const rubric=anchored?.components || result?.scoring_version==='role-fit-2' && result.score_components;
  const caps={role:30,duties:30,tools_languages:20,level:20};
  if(rubric && Object.keys(caps).some(key=>!Number.isFinite(Number(rubric[key])))) throw new Error('Incomplete match rubric');
  const current=rubric?Object.entries(caps).reduce((sum,[key,cap])=>sum+clamp(rubric[key],0,cap),0):clamp(fastMatch?.score,0,100);
  const cv=clamp(Math.max(current,Math.min(current+18,Number(result?.cv_potential_score)||current)),current,Math.min(100,current+18));
  const capability=clamp(Math.max(cv,Math.min(current+35,Number(result?.capability_potential_score)||cv)),cv,Math.min(100,current+35));
  const list=(value,limit)=>Array.isArray(value)?value.filter(x=>x&&typeof x==='object').slice(0,limit):[];
  const strings=(value,limit)=>safeStructuredStrings(value,limit);
  const rows=anchored?.rows || [];
  const fallback=breakdownFallback(rows);
  const strengths=list(result?.strengths,6).map(x=>({title:clean(x.title,220),evidence:clean(x.evidence,1000),impact:clamp(x.impact,1,10)})).filter(x=>x.title);
  const capabilityGaps=list(result?.capability_gaps,7).map(x=>({title:clean(x.title,220),why:clean(x.why,1000),nextAction:clean(x.next_action,1000),potential:clamp(x.potential,1,10)})).filter(x=>x.title);
  const quickBoosts=list(result?.quick_boosts,4).map(x=>({kind:['confirm_existing','quick_build'].includes(String(x.kind))?String(x.kind):'quick_build',title:clean(x.title,220),why:clean(x.why,1000),nextAction:clean(x.next_action,1000),potential:clamp(x.potential,1,10)})).filter(x=>x.title);
  return {
    currentScore:current,scoringMethod:anchored?MATCH_METHOD:null,scoreBreakdown:rows,scoreComponents:rubric ? {...rubric} : null,scoringVersion:rubric?"role-fit-2":"legacy-fast",
    roleSummary:clean(result?.role_summary,1800),
    responsibilities:strings(result?.responsibilities,8),
    requirements:list(result?.requirements,8).map(x=>({title:clean(x.title,220),kind:x.kind==='must'?'must':'nice',why:clean(x.why,900)})).filter(x=>x.title),
    tools:strings(result?.tools,12),
    strengths:strengths.length?strengths:fallback.strengths,
    presentationGaps:list(result?.presentation_gaps,6).map(x=>({title:clean(x.title,220),why:clean(x.why,1000),potential:clamp(x.potential,1,10)})).filter(x=>x.title),
    capabilityGaps:capabilityGaps.length?capabilityGaps:fallback.capabilityGaps,
    quickBoosts,
    cvPotentialScore:cv,capabilityPotentialScore:capability,
    cvPotentialReason:clean(result?.cv_potential_reason,1800),
    confidence:['low','medium','high'].includes(String(result?.confidence))?String(result.confidence):'medium',
    disclaimer:'匹配分用于理解岗位与规划行动，不代表录用概率。',
  };
}

export function searchQueryFromAnalysis(analysis,config={}){
  const explicit=Array.isArray(config?.target_roles?.primary)?config.target_roles.primary.map(x=>String(x||'').trim()).filter(Boolean):[];
  if(explicit.length)return explicit.slice(0,3).join(' ');
  const directions=Array.isArray(analysis?.careerDirections)?analysis.careerDirections:[];
  const queries=directions.map(x=>String(x?.searchQuery||x?.title||'').trim()).filter(Boolean);
  if(queries.length)return queries.slice(0,3).join(' OR ');
  const keywords=Array.isArray(analysis?.searchKeywords)?analysis.searchKeywords.map(x=>String(x||'').trim()).filter(Boolean):[];
  return keywords.slice(0,4).join(' ');
}


// Use the same bounded gain as accepting a role CV, rather than mixing the
// internal writing-quality rubric with the user's exploration match score.
/** @param {Record<string, any>} job
 * @param {Record<string, any>} assessment
 * @returns {Record<string, any>} */
export function v1CvAssessment(job, assessment={}) {
  const match=(job?.cvDraft?.status==='pending'?job.cvDraft.matchBasis:null) || job?.cv?.matchBasis || job?.v1Match;
  if(assessment.scoringVersion==="role-fit-2-cv") return assessment;
  if(match?.currentScore==null || assessment.draftScore==null)return assessment;
  const baselineScore=Math.max(0,Math.min(100,Math.round(Number(match.currentScore))));
  const ceiling=Math.max(baselineScore,Math.min(100,Math.round(Number(match.cvPotentialScore ?? baselineScore))));
  const draftScore=Math.min(ceiling,baselineScore+Math.max(0,Math.round(Number(assessment.delta || 0))));
  return {...assessment,baselineScore,draftScore,delta:draftScore-baselineScore};
}

export function matchScoreView(value={}) {
 const match=(value.cvDraft?.status==='pending'?value.cvDraft.matchBasis:null) || value.cv?.matchBasis || value.v1Match || value.deepMatch || value;
 const baseline=clamp(match.currentScore ?? value.fastMatch?.score);
 const forecast=clamp(Math.max(baseline,Number(match.cvPotentialScore ?? baseline)));
 const current=clamp(Math.max(baseline,Math.min(forecast,Number(value.v1Match?.displayScore ?? match.displayScore ?? baseline))));
 const assessment=value.cvDraft?.status!=='rejected' && value.cvDraft?.assessment?.draftScore!=null ? v1CvAssessment(value,value.cvDraft.assessment) : null;
 const reviewed=!!assessment || !!value.cv?.file && value.cv?.presentationDelta!=null;
 // The original estimate is immutable for this frozen assessment. A review is
 // a separate observation; neither a zero gain nor acceptance rewrites potential.
 const reviewedScore=assessment ? assessment.draftScore : reviewed ? current : null;
 return {current,potential:forecast,baseline,forecast,reviewed,reviewedScore};
}
export function projectV1JobScores(job,tasks=[],versionId='') {
 job=repairOfferText(job);
 if(!job.v1Match)return job;
 const frozen=(job.cvDraft?.status==='pending'?job.cvDraft.matchBasis:null) || job.cv?.matchBasis;
 if(frozen) job={...job,v1Match:{...frozen,displayScore:job.v1Match.displayScore ?? frozen.currentScore}};
 const latest=tasks.find(t=>t.kind==='deep_match'&&t.status==='completed'&&t.inputVersionId===versionId&&normalizeUrl(t.input?.url)===normalizeUrl(job.url)&&t.result?.deepMatch?.scoringVersion==='role-fit-2');
 const active=tasks.find(t=>t.kind==='deep_match'&&['queued','running','reconciling'].includes(t.status)&&t.inputVersionId===versionId&&normalizeUrl(t.input?.url)===normalizeUrl(job.url));
 const failed=tasks.find(t=>t.kind==='deep_match'&&['failed','interrupted'].includes(t.status)&&t.inputVersionId===versionId&&normalizeUrl(t.input?.url)===normalizeUrl(job.url));
 if(!frozen && latest && (job.cvDraft?.status==='rejected' || !job.cvDraft?.baseVersionId || job.cvDraft.baseVersionId===versionId) && (!job.cv?.inputVersionId || job.cv.inputVersionId===versionId)) {
   const deep=latest.result.deepMatch;
   const gain=Math.max(0,Number(job.cv?.presentationDelta || 0));
   job={...job,v1Match:{...job.v1Match,currentScore:deep.currentScore,cvPotentialScore:deep.cvPotentialScore,capabilityPotentialScore:deep.capabilityPotentialScore,displayScore:Math.min(deep.cvPotentialScore,deep.currentScore+gain),deepMatch:deep}};
 }
 const deepReady=Boolean(job.v1Match?.deepMatch?.currentScore!=null);
 const result={...job,matchScore:matchScoreView(job),cvOutcome:roleCvOutcome(job),enrichment:{...(job.enrichment||{}),
   deepMatchState:deepReady?'ready':active?'loading':failed?'failed':'pending',
   deepMatchTaskId:latest?.id || active?.id || null,
   deepMatchEstimate:active?.estimate || latest?.estimate || null,
   deepMatchStartedAt:active?.createdAt || latest?.createdAt || null}};
 if(job.cvDraft) result.cvDraft={...job.cvDraft,assessment:v1CvAssessment(job,job.cvDraft.assessment || {})};
 return result;
}

export function friendlyGapTitle(value) {
 const text=String(value || '');
 if(/(?:未|没有|尚未).*(?:证明|证实|展示|体现)|not (?:demonstrated|proven|evidenced)|non demontre|non démontré/i.test(text)) {
   if(/[\p{Script=Han}]/u.test(text))return '补充'+text.replace(/(?:尚未|没有|未).*(?:证明|证实|展示|体现).*$/,'').replace(/水平$/,'')+'说明';
   if(/not (?:demonstrated|proven|evidenced)/i.test(text))return 'Clarify '+text.replace(/(?:is |was )?not (?:demonstrated|proven|evidenced).*$/i,'').trim();
   return 'Préciser '+text.replace(/(?:non|pas) démontré.*$/i,'').trim();
 }
 return text;
}
export function friendlyOffer(offer) {
 const repaired=repairOfferText(offer);
 if(!repaired.deepMatch)return repaired;
 return {...repaired,deepMatch:{...repaired.deepMatch,capabilityGaps:(repaired.deepMatch.capabilityGaps || []).map(g=>({...g,title:friendlyGapTitle(g.title)}))}};
}
