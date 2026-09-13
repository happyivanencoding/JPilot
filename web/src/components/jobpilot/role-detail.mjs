import {roleCvOutcome} from '../../lib/onward-cv.mjs';
/** Read-only adapter: opening a discovery offer must not create a candidature or AI task. */
export function roleDetailForOffer(offer,jobs=[]) {
 const saved=jobs.find(job=>job.url===offer.url);
 if(saved)return saved;
 const deep=offer.deepMatch || null,scores=offer.matchScore || {};
 const current=deep?.currentScore ?? null;
 return {id:'',url:offer.url,role:offer.title,company:offer.company,location:offer.location,
   contract:offer.contractType,status:'À candidater',matchScore:scores,enrichment:offer.enrichment,localization:offer.localization,
   v1Match:{currentScore:current,displayScore:current,cvPotentialScore:deep?.cvPotentialScore ?? current,deepMatch:deep}};
}
export function roleCvIsReady(job) {return job.cvDraft?.status==='pending' || !!job.cv?.file;}

const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const HARD_REQUIREMENT=/\b(?:master|licence|bachelor|degree|diplome|diploma|formation|bac\s*\+?\s*\d|student|etudiant|ecole|school|university|universite|engineering|ingenieur|commerce|business|finance|marketing|supply|data|analyse|analysis|analytical|excel|power\s*bi|sql|python|tableau|sap|office|crm|anglais|english|francais|french|langue|language|experience|competence|skill|communication|organisation|organization|b2b|statistique|econom)/i;
const HARD_REQUIREMENT_ZH=/(学历|学位|硕士|本科|专业|商科|工程|金融|市场|供应链|数据|分析|Excel|Power\s*BI|SQL|Python|英语|法语|语言|经验|能力|技能|沟通|组织|B2B|统计|经济)/i;
const START_DETAIL=/(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december|\b20\d{2}\b|\b\d{1,2}[\/-]\d{1,2}[\/-](?:20)?\d{2}\b|a partir de|des le|starting|start date|available from|disponible a partir|开始日期|入职日期|\d{1,2}月)/i;
const CONTRACT_ONLY=/(?:\bstage\b|internship|intern\b|实习|alternance|apprenticeship|学徒|\bcdi\b|\bcdd\b)/i;
const GENERIC_LOCATION=/(?:work(?:ing)?\s+(?:in|at)|based\s+in|location|on[- ]site|sur\s+site|travailler\s+a|poste\s+a|lieu\s+de\s+travail|工作地点|办公地点|在.{0,8}(?:工作|办公)|马赛|巴黎|里昂|法国)/i;
const GENERIC_CONDITION=/(?:no\s+travel|travel\s+not\s+required|sans\s+deplacement|aucun\s+deplacement|teletravail|remote|hybrid|hybride|无需出差|无须出差|不需要出差)/i;

/** Keep candidate qualifications; remove metadata/conditions already shown in the hero. */
export function visibleRoleRequirements(requirements=[],job={}) {
 const location=fold(job?.location);
 return (Array.isArray(requirements)?requirements:[]).filter(item=>{
   const raw=`${item?.title||''} ${item?.why||''}`.trim();if(!raw)return false;
   const text=fold(raw),hard=HARD_REQUIREMENT.test(text)||HARD_REQUIREMENT_ZH.test(raw),hasStart=START_DETAIL.test(text)||START_DETAIL.test(raw);
   if(CONTRACT_ONLY.test(text)||CONTRACT_ONLY.test(raw)){if(!hasStart&&!hard)return false;}
   const sameLocation=location&&text.includes(location);
   if((sameLocation||GENERIC_LOCATION.test(text)||GENERIC_LOCATION.test(raw))&&!hard)return false;
   if(GENERIC_CONDITION.test(text)||GENERIC_CONDITION.test(raw)){if(!hard)return false;}
   return true;
 }).slice(0,6);
}
