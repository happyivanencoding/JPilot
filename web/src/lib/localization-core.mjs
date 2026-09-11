import { createHash } from 'node:crypto';
import catalog from '../../shared/jobpilot-i18n.json' with {type:'json'};
import {choose,uiLocale,detectedDocumentLanguage,LANGUAGE_NAMES} from './language-contract.mjs';

export function productText(text,locale) {return catalog[text]?.[uiLocale(locale)] ?? text;}
export function pendingText(locale) {return choose(locale,'正在翻译已有结果…','Traduction du résultat enregistré…','Translating the saved result…');}
// Hashing replaces expensive translation calls, not business-result identity.
export function translationKey(text) {return createHash('sha256').update('display-v1\0'+text).digest('hex');}
export function alreadyLocalized(text,locale,hint='fr') {
  if(!text.trim() || !/[\p{L}]/u.test(text)) return true;
  const han=(text.match(/[\p{Script=Han}]/gu)||[]).length;
  // Legacy candidature projections wrap translated facts in French templates.
  // One Chinese word does not make that whole explanation Chinese.
  if(locale==='zh' && /^(?:Mettre en avant|Construire la candidature|Comment répondez-vous|Préparer (?:un cas|l[’']écart)|Évaluation career-ops)/i.test(text.trim()))return false;
  const detected=han>0 ? 'zh' : detectedDocumentLanguage(text) || hint;
  return detected===locale;
}


export function translationLooksLikeTarget(text,locale) {
  const value=String(text || '').trim();if(!value)return false;
  const target=uiLocale(locale),han=(value.match(/[\p{Script=Han}]/gu)||[]).length,latin=(value.match(/[\p{Script=Latin}]/gu)||[]).length;
  // A Chinese proper name may legitimately remain inside French/English prose. A
  // whole Chinese explanation may not be cached as a French/English translation.
  if(target!=='zh' && han>=8 && (latin===0 || han>latin*.18))return false;
  if(target==='zh' && han<2) {
    const detected=detectedDocumentLanguage(value);if(detected && detected!=='zh')return false;
  }
  const detected=detectedDocumentLanguage(value);
  return !detected || detected===target || (target!=='zh' && han>0 && han<8);
}

/** Only paths explicitly owned by JobPilot's explanation layer are editable.
 * Scores, status enums, identities, before/after, targetBlocks.text, CV/JD and user input are never slots.
 */
export function displaySlots(value,scope) {
  const slots=[];
  const put=(obj,key,path,hint='fr')=>{if(obj && typeof obj[key]==='string' && obj[key].trim()) slots.push({path:[...path,key],text:obj[key],hint});};
  const fields=(obj,keys,path,hint)=>keys.forEach(key=>put(obj,key,path,hint));
  const strings=(obj,key,path,hint)=>{if(Array.isArray(obj?.[key]))obj[key].forEach((v,i)=>{if(typeof v==='string')put(obj[key],i,[...path,key],hint);});};
  const rows=(obj,key,path,fn)=>{if(Array.isArray(obj?.[key])) obj[key].forEach((row,i)=>fn(row,[...path,key,i]));};
  function analysis(a,p=[]) {
    if(!a)return;const hint=a.outputLocale || (/[\p{Script=Han}]/u.test(a.markdown||'')?'zh':detectedDocumentLanguage(a.markdown)||'fr');
    fields(a,['markdown','changeSummary','expressionMarkdown','actionMarkdown'],p,hint);
    rows(a,'strengths',p,(r,q)=>fields(r,['title','evidence'],q,hint));
    rows(a,'growthAreas',p,(r,q)=>fields(r,['title','nextAction'],q,hint));
    rows(a,'expressionIssues',p,(r,q)=>fields(r,['title','detail','evidence'],q,hint));
    rows(a,'actionIssues',p,(r,q)=>fields(r,['title','detail','nextAction','evidence'],q,hint));
    rows(a,'careerDirections',p,(r,q)=>{fields(r,['title','why'],q,hint);strings(r,'evidence',q,hint);});
    // searchQuery/searchKeywords are execution inputs, not display prose; do not translate them.
    strings(a,'tasks',p,hint);strings(a,'questions',p,hint);
    const plan=a.globalLayout;
    if(plan){const q=[...p,'globalLayout'];fields(plan,['headline','languageNote'],q,hint);strings(plan,'overlooked',q,hint);strings(plan,'issues',q,'fr');
      rows(plan,'signals',q,(r,s)=>fields(r,['title','why','evidence'],s,hint));
      rows(plan,'allocations',q,(r,s)=>fields(r,['section','reason','spaceTradeoff'],s,hint));
      rows(plan,'changes',q,(r,s)=>fields(r,['reason'],s,hint));}
    rows(a,'history',p,(r,q)=>put(r,'changeSummary',q,detectedDocumentLanguage(r.changeSummary)||hint));
  }
  function deepMatch(m,p,hint='fr') {
    if(!m)return;const mh=m.outputLocale || (/[\p{Script=Han}]/u.test(m.roleSummary||'')?'zh':detectedDocumentLanguage(m.roleSummary)||hint);
    fields(m,['roleSummary','cvPotentialReason'],p,mh);strings(m,'responsibilities',p,mh);
    rows(m,'requirements',p,(r,q)=>fields(r,['title','why'],q,mh));
    rows(m,'strengths',p,(r,q)=>fields(r,['title','evidence'],q,mh));
    rows(m,'presentationGaps',p,(r,q)=>fields(r,['title','why'],q,mh));
    rows(m,'capabilityGaps',p,(r,q)=>fields(r,['title','why','nextAction'],q,mh));
    // tools are search/domain terms and remain source-language tokens.
  }
  function fastMatch(f,p,hint='zh') {
    if(!f)return;rows(f,'strengths',p,(r,q)=>fields(r,['title','evidence'],q,detectedDocumentLanguage(r.evidence)||hint));
    rows(f,'gaps',p,(r,q)=>fields(r,['title','reason'],q,detectedDocumentLanguage(r.reason)||hint));
  }
  function offer(o,p) {fields(o,['why'],p,detectedDocumentLanguage(o.why)||'fr');deepMatch(o.deepMatch,[...p,'deepMatch']);fastMatch(o.fastMatch,[...p,'fastMatch']);}
  function job(j,p=[],detail=true) {
    const hint=j.outputLocale || (/[\p{Script=Han}]/u.test(j.summary||'')?'zh':detectedDocumentLanguage(j.summary)||'fr');
    if(j.followup?.nextActionSource!=='user') put(j.followup,'nextAction',[...p,'followup'],hint);
    if(!detail)return;
    if(j.v1Match){deepMatch(j.v1Match.deepMatch,[...p,'v1Match','deepMatch'],hint);fastMatch(j.v1Match.fastMatch,[...p,'v1Match','fastMatch']);}
    fields(j,['summary','angle','recommendation'],p,hint);strings(j,'strengths',p,hint);
    rows(j,'gaps',p,(r,q)=>fields(r,['title','why','positioning','severity'],q,hint));
    rows(j,'match',p,(r,q)=>fields(r,['requirement','evidence','action','fit'],q,hint));
    strings(j.cv,'changes',[...p,'cv'],j.cv?.notesLocale || hint);
    const cvDraft=j.cvDraft;
    if(cvDraft){
      const q=[...p,'cvDraft'],draftHint=cvDraft.notesLocale || hint;
      strings(cvDraft,'changes',q,draftHint);
      rows(cvDraft,'atsIssues',q,(r,s)=>put(r,'message',s,detectedDocumentLanguage(r?.message)||'en'));
      const assessment=cvDraft.assessment;
      if(assessment){const a=[...q,'assessment'];put(assessment,'summary',a,draftHint);strings(assessment,'improvements',a,draftHint);strings(assessment,'remainingGaps',a,draftHint);}
      // cvDraft.payload is the actual application material. Never localize it with the UI.
    }
    const interview=j.interview;
    if(interview){const q=[...p,'interview'];strings(interview,'process',q,hint);put(interview,'caseStudy',q,hint);rows(interview,'questions',q,(r,s)=>fields(r,['question','answer','proof'],s,hint));}
    if(j.mobilePlan){const q=[...p,'mobilePlan'];const ph=j.mobilePlan.outputLocale || (/[\p{Script=Han}]/u.test(j.mobilePlan.markdown||'')?'zh':hint);put(j.mobilePlan,'markdown',q,ph);strings(j.mobilePlan,'questions',q,ph);}
    rows(j,'prepTasks',p,(r,q)=>{if(r.source!=='user')put(r,'label',q,hint);});
  }
  function discovery(d,p=[]) {if(!d)return;put(d,'warning',p,'fr');rows(d,'offers',p,offer);rows(d,'history',p,(group,q)=>rows(group,'offers',q,offer));}
  if(scope==='snapshot') {
    analysis(value.analysis,['analysis']);rows(value,'jobs',[],(j,p)=>job(j,p,false));discovery(value.discovery,['discovery']);
    put(value.dashboard,'responseRateDefinition',['dashboard'],'fr');
    rows(value.dashboard,'due',['dashboard'],(r,p)=>{if(r.nextActionSource!=='user')put(r,'nextAction',p,'fr');});
  } else if(scope==='job') job(value);
  else if(scope==='cards') rows(value,'jobs',[],(j,p)=>job(j,p,true));
  else if(scope==='analysis') analysis(value);
  else if(scope==='offer') offer(value,[]);
  else if(scope==='directions') rows(value,'items',[],(r,p)=>put(r,'title',p,r.outputLocale || 'en'));
  else if(scope==='report') put(value,'markdown',[],detectedDocumentLanguage(value.markdown)||'fr');
  else if(scope==='meta') {put(value,'layoutNote',[],'fr');strings(value,'warnings',[],'fr');strings(value.layout,'issues',['layout'],'fr');}
  else {
    analysis(value);discovery(value);strings(value.cv,'changes',['cv'],'fr');put(value,'summary',[],value.outputLocale || 'fr');
  }
  return slots;
}
export function setDisplaySlot(target,path,text) {
  let node=target;for(const part of path.slice(0,-1))node=node[part];node[path.at(-1)]=text;
}

export function protectTranslation(text) {
  const protectedValues=[];
  // Exact source quotes, code, URLs, and all numeric/CEFR evidence remain byte-for-byte.
  const packed=text.replace(/```[\s\S]*?```|`[^`\n]+`|^>[^\n]*|https?:\/\/[^\s)\]>]+|\b(?:[ABC][12])\b|\d+(?:[.,]\d+)*(?:%)?/gm,raw=>{
    const token=`⟦P${protectedValues.length}⟧`;protectedValues.push(raw);return token;
  });
  return {text:packed,protectedValues};
}
export function restoreTranslation(translated,protectedValues) {
  if(typeof translated!=='string'||!translated.trim())throw new Error('Empty localization output');
  const tokens=translated.match(/⟦P\d+⟧/g)||[];
  if(tokens.length!==protectedValues.length || protectedValues.some((_,i)=>tokens.filter(t=>t===`⟦P${i}⟧`).length!==1)) throw new Error('Localization changed protected evidence');
  return translated.replace(/⟦P(\d+)⟧/g,(_,i)=>protectedValues[Number(i)]);
}
export function translationPrompt(entries,locale) {
  const target=LANGUAGE_NAMES[uiLocale(locale)];
  return `Translate SAVED JobPilot explanations into ${target}. This is display localization ONLY, NEVER a new evaluation, CV analysis, recommendation or research. Do not use tools, files, web, agents, or candidate inference. The source MAY be Chinese, French or English. MANDATORY: every segment that is not already in ${target} must actually be translated into ${target}; never copy a Chinese or English explanation unchanged when the target is French, and never copy a Chinese or French explanation unchanged when the target is English. Preserve every fact, qualification, conclusion, uncertainty, negation, date, score, names of employers/schools/roles, proper nouns, Markdown structure and every ⟦Pn⟧ token EXACTLY ONCE. Do not translate names or protected tokens. Do not add or remove conclusions. Natural product Chinese: 岗位评估 / 你的优势 / 主要差距 / 下一步建议 / 投递. Return ONLY JSON {"translations":[{"id":"exact supplied id","text":"complete translation"}]} with every id exactly once, no extras.\n${JSON.stringify(entries.map(e=>({id:e.id,text:e.packed.text})))}`;
}
export function reportForDisplay(raw) {
  // Machine Summary is parser metadata, not prose UI; the original report is untouched.
  return String(raw).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').split(/^#{1,6}\s+(?:Machine Summary|Résumé machine|机器摘要).*$/mi)[0].trim();
}
