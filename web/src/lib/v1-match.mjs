import {roleCvOutcome} from './onward-cv.mjs';
import {MATCH_METHOD,ANCHORED_INSTRUCTIONS,anchoredBreakdown} from "./match-rubric.mjs";
import {normalizeUrl} from "./posting-url.mjs";
import {repairOfferText} from './text-repair.mjs';
// V1 student-facing match layer. This is deliberately separate from the legacy
// 0-5 official evaluation: fastMatch is immediate guidance, while deep_match is
// a read-only explanation. Neither one writes an application or official report.
export const V1_DEEP_MATCH_PREFETCH_LIMIT = 5;
export const V1_MATCH_VERSION = 'v1-student-match-2';

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

export function fastMatchOffer(candidate,config,offer){
  const candidateText=evidenceText(candidate), jobText=offerText(offer);
  const cvTools=aliasHits(candidateText,TOOL_ALIASES), jobTools=aliasHits(jobText,TOOL_ALIASES);
  const cvDomains=aliasHits(candidateText,DOMAIN_ALIASES), jobDomains=aliasHits(jobText,DOMAIN_ALIASES);
  const cvTokens=new Set(tokens(candidateText)), jobTokens=new Set(tokens(`${offer?.title||''} ${clean(offer?.description,9000)}`));
  const lexical=Math.min(100,Math.round(overlap(cvTokens,jobTokens)*220));
  const toolCoverage=jobTools.length?Math.round(jobTools.filter(x=>cvTools.includes(x)).length/jobTools.length*100):Math.min(80,lexical+10);
  const domainCoverage=jobDomains.length?Math.round(jobDomains.filter(x=>cvDomains.includes(x)).length/jobDomains.length*100):Math.min(80,lexical+5);
  const search=Number.isFinite(Number(offer?.searchRelevance))?clamp(offer.searchRelevance):55;
  let score=Math.round(search*.38+lexical*.24+toolCoverage*.20+domainCoverage*.18);
  const notes=[];
  if(offer?.seniorityFit==='above-target'){score-=9;notes.push('seniority');}
  if(offer?.roleFit==='outside-primary'){score-=7;notes.push('role');}
  if(offer?.locationFit==='outside-europe'){score-=12;notes.push('location');}
  else if(offer?.locationFit==='outside-target'){score-=7;notes.push('location');}
  else if(offer?.locationFit==='europe-other'){score-=3;notes.push('location');}
  if(offer?.relevanceTier==='closest')score-=7;
  score=clamp(score,18,96);
  const strengths=[];
  for(const tool of jobTools.filter(x=>cvTools.includes(x)).slice(0,3)) strengths.push({title:tool,type:'tool',evidence:`CV 中已出现 ${tool}`});
  for(const domain of jobDomains.filter(x=>cvDomains.includes(x)).slice(0,2)) if(!strengths.some(x=>x.title===domain)) strengths.push({title:domain,type:'domain',evidence:`经历中已有 ${domain} 相关信号`});
  if(!strengths.length && lexical>=30) strengths.push({title:'可迁移经历',type:'transferable',evidence:'简历与岗位描述存在多项直接词汇/职责重合'});
  const gaps=[];
  for(const tool of jobTools.filter(x=>!cvTools.includes(x)).slice(0,4)) gaps.push({title:tool,type:'not-demonstrated',reason:`岗位描述提到 ${tool}，当前档案未发现明确证据`});
  if(offer?.seniorityFit==='above-target')gaps.push({title:'经验年限 / seniority',type:'constraint',reason:'岗位资历可能高于当前目标'});
  if(offer?.locationFit==='outside-europe'||offer?.locationFit==='outside-target')gaps.push({title:'地点适配',type:'constraint',reason:'地点偏离当前偏好，需要确认可接受性'});
  const roleHint=titleCase(offer?.title);
  return {
    version:V1_MATCH_VERSION,score,confidence:jobText.length>500?'medium':'low',
    roleHint, strengths:strengths.slice(0,4),gaps:gaps.slice(0,4),
    components:{search,lexical,toolCoverage,domainCoverage},notes,
    disclaimer:'快速匹配用于探索，不代表录用概率。',
  };
}

export function enrichOffersWithFastMatch(candidate,config,offers){
  return (Array.isArray(offers)?offers:[]).map(offer=>({...offer,fastMatch:fastMatchOffer(candidate,config,offer)}))
    .sort((a,b)=>(b.fastMatch?.score||0)-(a.fastMatch?.score||0)||(b.rankScore||0)-(a.rankScore||0));
}

export function deepMatchPrompt({candidate,offer,fastMatch,jobIntelligence,language='en'}){
 return `You are a practical career guide assessing ONE real role for this candidate. Use the original CV, not assumptions about nationality, names or job titles. No tools, applications or invented achievements.
OUTPUT LANGUAGE: ${language}.
Give one coherent job-match score on a 0-100 scale. The supplied fastMatch is a lexical retrieval hint ONLY, not the final score. English CVs and French vacancies must be compared by meaning, not shared word counts. Never infer language proficiency from the language of the CV, UI, name or nationality. Only compare a documented proficiency with an explicit job-language requirement; unknown proficiency is a question, not a failure.
${ANCHORED_INSTRUCTIONS}
Anchors: below 40 = major role/domain gaps; 40-59 = a stretch with important experience/skill gaps; 60-74 = a credible junior candidate with relevant education and transferable experience; 75-89 = a strong direct fit; 90-100 = unusually complete match. A junior posting does NOT require a senior's experience; association/student projects count as transferable work, not senior ownership. Do not invent a floor or award points just to please the user. A clearly senior/specialised unrelated role can legitimately score below 60.
cv_potential_score is an estimate after selecting and expressing EXISTING facts better, current_score to at most current_score+18. Better writing cannot add missing years, specialist qualifications or language fluency. capability_potential_score may reflect actually learning later but is not the visible CV-edit score.
Use everyday language, 2-3 strengths, at most 2 CV edits and 2 gaps. Titles at most 8 words. Give each strength 2 useful sentences linking a specific CV example to a real job duty. For each edit or gap explain what to improve and a concrete, realistic next action, in 30-65 words total. No filler. Never put scoring formulas, criterion weights, awarded/deducted points or instructions for gaming a score into these user-facing explanations; keep numeric reasoning only in ratings and score_rationale. Avoid 'proven', 'not demonstrated', 'evidence not found', 'proof', audit/process narration and lectures. For a known shortfall say 'Limited export administration experience'. For an unknown ability use 'Clarify your Portuguese level' rather than claiming the candidate cannot speak Portuguese. State practical actions, not defence of your reasoning.
Return exactly one JSON object (no fence):
{"scoring_version":"role-fit-2","scoring_method":"anchored-4x4-v1","ratings":{"role":2,"duties":2,"tools_languages":2,"level":2},"score_rationale":{"role":{"reason":"rating explanation","job_evidence":"short verbatim excerpt or empty","cv_evidence":"short verbatim excerpt or empty","unknown":false},"duties":{"reason":"rating explanation","job_evidence":"excerpt or empty","cv_evidence":"excerpt or empty","unknown":false},"tools_languages":{"reason":"rating explanation","job_evidence":"excerpt or empty","cv_evidence":"excerpt or empty","unknown":false},"level":{"reason":"rating explanation","job_evidence":"excerpt or empty","cv_evidence":"excerpt or empty","unknown":false}},"role_summary":"plain-language description","responsibilities":["3 duties"],"requirements":[{"title":"requirement","kind":"must|nice","why":"brief"}],"tools":["explicit tools"],"strengths":[{"title":"strength","evidence":"specific example","impact":1}],"presentation_gaps":[{"title":"CV edit","why":"practical improvement","potential":1}],"capability_gaps":[{"title":"gap or practical check","why":"what this role needs","next_action":"one useful step","potential":1}],"cv_potential_score":0,"capability_potential_score":0,"cv_potential_reason":"one brief reason","confidence":"low|medium|high"}
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
  const strings=(value,limit)=>Array.isArray(value)?value.map(x=>String(x||'').trim()).filter(Boolean).slice(0,limit):[];
  return {
    currentScore:current,scoringMethod:anchored?MATCH_METHOD:null,scoreBreakdown:anchored?.rows || [],scoreComponents:rubric ? {...rubric} : null,scoringVersion:rubric?"role-fit-2":"legacy-fast",
    roleSummary:clean(result?.role_summary,1800),
    responsibilities:strings(result?.responsibilities,6),
    requirements:list(result?.requirements,8).map(x=>({title:clean(x.title,220),kind:x.kind==='must'?'must':'nice',why:clean(x.why,900)})).filter(x=>x.title),
    tools:strings(result?.tools,12),
    strengths:list(result?.strengths,6).map(x=>({title:clean(x.title,220),evidence:clean(x.evidence,1000),impact:clamp(x.impact,1,10)})).filter(x=>x.title),
    presentationGaps:list(result?.presentation_gaps,6).map(x=>({title:clean(x.title,220),why:clean(x.why,1000),potential:clamp(x.potential,1,10)})).filter(x=>x.title),
    capabilityGaps:list(result?.capability_gaps,7).map(x=>({title:clean(x.title,220),why:clean(x.why,1000),nextAction:clean(x.next_action,1000),potential:clamp(x.potential,1,10)})).filter(x=>x.title),
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
 if(!frozen && latest && (job.cvDraft?.status==='rejected' || !job.cvDraft?.baseVersionId || job.cvDraft.baseVersionId===versionId) && (!job.cv?.inputVersionId || job.cv.inputVersionId===versionId)) {
   const deep=latest.result.deepMatch;
   const gain=Math.max(0,Number(job.cv?.presentationDelta || 0));
   job={...job,v1Match:{...job.v1Match,currentScore:deep.currentScore,cvPotentialScore:deep.cvPotentialScore,displayScore:Math.min(deep.cvPotentialScore,deep.currentScore+gain),deepMatch:deep}};
 }
 const result={...job,matchScore:matchScoreView(job),cvOutcome:roleCvOutcome(job)};
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
