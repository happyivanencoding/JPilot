// V1 student-facing match layer. This is deliberately separate from the legacy
// 0-5 official evaluation: fastMatch is immediate guidance, while deep_match is
// a read-only explanation. Neither one writes an application or official report.
export const V1_DEEP_MATCH_PREFETCH_LIMIT = 5;
export const V1_MATCH_VERSION = 'v1-student-match-1';

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

export function deepMatchPrompt({candidate,offer,fastMatch,jobIntelligence,language='zh'}){
  return `You are JobPilot's read-only V1 role interpreter for a student or early-career candidate. No tools, files, web browsing, application writes, official evaluation reports, or fabricated candidate facts are allowed.\n\nOUTPUT LANGUAGE: ${language}.\n\nUse direct, concise product language addressed to the candidate. Each title at most 10 words, each explanation at most 22 words. Give 2-3 strengths, at most 2 presentation gaps and 2 capability gaps. No audit/process narration or repeated disclaimers; show practical next steps instead.\n\nYour job is to help a student understand ONE real posting and their distance from it. The deterministic fast score below is the current 0-100 exploration score and MUST be preserved exactly as current_score; do not invent a second current fit score. Distinguish CV presentation potential from real capability growth. A missing term in the CV means "not demonstrated", not "the candidate definitely cannot do it".\n\nCANDIDATE AUTHORITY (only these sources can establish candidate facts):\n${JSON.stringify(candidate)}\n\nPOSTING:\n${JSON.stringify({url:offer?.url,company:offer?.company,title:offer?.title,location:offer?.location,contractType:offer?.contractType,description:clean(offer?.description,18000),why:offer?.why},null,2)}\n\nFAST MATCH:\n${JSON.stringify(fastMatch)}\n\nREUSABLE JOB INTELLIGENCE (profile-independent; reuse if useful instead of changing it without reason):\n${JSON.stringify(jobIntelligence||null)}\n\nReturn ONE JSON object only with this exact shape:\n{"current_score":0,"role_summary":"1-2 sentences explaining what this job actually does","responsibilities":["3-5 concrete responsibilities"],"requirements":[{"title":"requirement","kind":"must|nice","why":"why it matters"}],"tools":["tools explicitly or strongly evidenced by the posting"],"strengths":[{"title":"candidate strength","evidence":"exact evidence grounded in candidate sources","impact":1}],"presentation_gaps":[{"title":"existing evidence is weakly presented","why":"why wording/selection currently hides it","potential":1}],"capability_gaps":[{"title":"real skill/experience not demonstrated","why":"what the posting expects","next_action":"concrete truthful action","potential":1}],"cv_potential_score":0,"capability_potential_score":0,"cv_potential_reason":"why better truthful presentation could help","confidence":"low|medium|high"}.\n\nScoring rules: current_score MUST equal ${clamp(fastMatch?.score)}. cv_potential_score must be >= current_score and <= min(100,current_score+18); it represents only better selection/rewording of ALREADY DOCUMENTED evidence. capability_potential_score must be >= cv_potential_score and <= min(100,current_score+35); it may assume the candidate genuinely fills the listed capability gaps later. If there is little room for honest wording gain, keep cv_potential_score close to current_score. Potentials are approximate guidance, not promises. Each impact/potential is an integer 1-10 and the lists do not need to sum to the score.\n\nDo not add a tool, language level, metric, ownership claim, degree, work authorization, relocation willingness, availability, or achievement that is not supported. No text outside JSON.`;
}

export function normalizeDeepMatch(result,fastMatch){
  const current=clamp(fastMatch?.score,0,100);
  const cv=clamp(Math.max(current,Math.min(current+18,Number(result?.cv_potential_score)||current)),current,Math.min(100,current+18));
  const capability=clamp(Math.max(cv,Math.min(current+35,Number(result?.capability_potential_score)||cv)),cv,Math.min(100,current+35));
  const list=(value,limit)=>Array.isArray(value)?value.filter(x=>x&&typeof x==='object').slice(0,limit):[];
  const strings=(value,limit)=>Array.isArray(value)?value.map(x=>String(x||'').trim()).filter(Boolean).slice(0,limit):[];
  return {
    currentScore:current,
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
  const match=job?.v1Match;
  if(match?.currentScore==null || assessment.draftScore==null)return assessment;
  const baselineScore=Math.max(0,Math.min(100,Math.round(Number(match.currentScore))));
  const ceiling=Math.max(baselineScore,Math.min(100,Math.round(Number(match.cvPotentialScore ?? baselineScore))));
  const draftScore=Math.min(ceiling,baselineScore+Math.max(0,Math.round(Number(assessment.delta || 0))));
  return {...assessment,baselineScore,draftScore,delta:draftScore-baselineScore};
}
