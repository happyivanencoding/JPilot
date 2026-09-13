import fs from 'node:fs';
import path from 'node:path';
import {historyDirectory} from '@/lib/mobile-history';
import {workspaceRoot} from '@/lib/backend/workspace';
import {readJson,writeJson,withProfileLock,processAlive} from '@/lib/mobile-state.mjs';
import {runTranslationTransport} from '@/lib/model-transport';
import {extractJsonObject} from '@/lib/model-json.mjs';
import {uiLocale,choose} from '@/lib/language-contract.mjs';
import {displaySlots,translationKey,alreadyLocalized,translationLooksLikeTarget,productText,pendingText,setDisplaySlot,protectTranslation,restoreTranslation,translationPrompt} from '@/lib/localization-core.mjs';

type Entry={key:string;text:string;id:string;packed:ReturnType<typeof protectTranslation>};
const host=globalThis as typeof globalThis & {jobPilotLocalizations?:Map<string,Promise<void>>};
const running=host.jobPilotLocalizations ??= new Map<string,Promise<void>>();
const TRANSLATION_ENGINE_ID='gpt-5.6-luna-none-v1-language-validated';
const validCached=(saved:any,source:string,locale:string)=>saved?.source===source && saved?.locale===locale && typeof saved.translation==='string' && translationLooksLikeTarget(saved.translation,locale);

/** Translation operations use the existing cross-process profile lock, but NOT
 * business tasks/results. Locale switches cannot create evaluation/CV task rows.
 * Source-addressed segments let different projections of the same result reuse
 * the translation. Each result version also gets an immutable manifest.
 */
export async function localizeDisplay(profileId:string,target:unknown,value:any,scope:string,options:{schedule?:boolean;retry?:boolean;identity?:string;preservePendingSource?:boolean}={}) {
  if(value==null)return value;
  const locale=uiLocale(target),directory=path.join(historyDirectory(profileId),'localizations',locale);
  const cacheDir=path.join(directory,'segments'),operations=path.join(directory,'operations');
  const slots=displaySlots(value,scope);
  const result=structuredClone(value);
  const missing=new Map<string,string>();
  const sourceKeys:string[]=[];
  for(const slot of slots) {
    const fixed=productText(slot.text,locale);
    if(fixed!==slot.text || alreadyLocalized(slot.text,locale,slot.hint)) {setDisplaySlot(result,slot.path,fixed);continue;}
    const key=translationKey(slot.text);sourceKeys.push(key);
    const saved=readJson(path.join(cacheDir,key+'.json'));
    if(validCached(saved,slot.text,locale)) setDisplaySlot(result,slot.path,saved.translation);
    else {missing.set(key,slot.text);if(!options.preservePendingSource)setDisplaySlot(result,slot.path,pendingText(locale));}
  }
  let active:any=readJson(path.join(directory,'active.json'));
  if(options.schedule!==false && missing.size) {
    await withProfileLock(historyDirectory(profileId),()=>{
      active=readJson(path.join(directory,'active.json'));
      const activeUpdated=Date.parse(active?.updatedAt || active?.createdAt || '');
      const activeFresh=Number.isFinite(activeUpdated) && Date.now()-activeUpdated<5*60*1000;
      if(active && ['queued','running'].includes(active.status) && processAlive(active.ownerPid) && activeFresh)return;
      // Interrupted readonly work never silently launches a replacement Agent.
      if(active && ['queued','running'].includes(active.status)) {
        active={...active,status:'interrupted',updatedAt:new Date().toISOString()};
        writeJson(path.join(operations,active.key+'.json'),active);writeJson(path.join(directory,'active.json'),active);
      }
      const entries:Entry[]=[];let characters=0;
      for(const [key,text] of missing) {
        const cached=readJson(path.join(cacheDir,key+'.json'));
        if(validCached(cached,text,locale))continue;
        if(entries.length && (characters+text.length>20000 || entries.length>=70))break;
        entries.push({key,text,id:String(entries.length),packed:protectTranslation(text)});characters+=text.length;
      }
      if(!entries.length)return;
      const key=translationKey(JSON.stringify(['localize',TRANSLATION_ENGINE_ID,locale,entries.map(e=>e.key).sort()]));
      const previous=readJson(path.join(operations,key+'.json'));
      if(previous && ['failed','interrupted'].includes(previous.status) && !options.retry) {active=previous;return;}
      const now=new Date().toISOString();
      active={key,kind:'localize',profileId,locale,scope,identity:options.identity || scope,status:'queued',ownerPid:process.pid,createdAt:now,updatedAt:now,segmentKeys:entries.map(e=>e.key),model:'gpt-5.6-luna',reasoning:'none',transport:'openai-direct',attempt:(previous?.attempt || 0)+1};
      writeJson(path.join(operations,key+'.json'),active);writeJson(path.join(directory,'active.json'),active);
      const operation={...active};
      const work=executeLocalization(directory,operation,entries);
      running.set(`${profileId}:${locale}:${key}`,work);
      void work.finally(()=>running.delete(`${profileId}:${locale}:${key}`));
    });
  }
  const relevantActive=missing.size>0 && active && Array.isArray(active.segmentKeys) && active.segmentKeys.some((key:string)=>missing.has(key));
  const failed=!!relevantActive && ['failed','interrupted'].includes(active.status);
  const status=!missing.size?'ready':failed?'failed':options.schedule===false?'idle':'translating';
  const state={locale,status,pending:missing.size>0,failed,retryable:failed,missingSegments:missing.size,operationId:relevantActive?active?.key || null:null,
    startedAt:relevantActive?active?.createdAt || null:null,
    message:missing.size ? failed ? choose(locale,'翻译暂未完成，原始结果仍保留。请重试显示翻译，不需要重新评估。','Traduction indisponible. Le résultat original est conservé ; réessayez la traduction, pas l’analyse.','Translation is unavailable. The original result is preserved; retry translation, not analysis.') : choose(locale,'正在翻译已有结果，不会重新分析，也不会修改评分或简历。','Traduction du résultat enregistré, sans nouvelle analyse ni modification du score ou du CV.','Translating saved results without reanalysis or changes to scores or CV.') : ''};
  result.localization=state;
  if(options.schedule!==false && sourceKeys.length && !missing.size) {
    const version=translationKey(JSON.stringify([scope,options.identity || '',slots.map(s=>[s.path,s.text])]));
    const manifest=path.join(directory,'results',version+'.json');
    if(!fs.existsSync(manifest))writeJson(manifest,{identity:options.identity || scope,resultVersion:version,locale,segmentKeys:[...new Set(sourceKeys)],createdAt:new Date().toISOString()});
  }
  return result;
}

async function executeLocalization(directory:string,operation:any,entries:Entry[]) {
  const file=path.join(directory,'operations',operation.key+'.json');
  const save=()=>{operation.updatedAt=new Date().toISOString();writeJson(file,operation);writeJson(path.join(directory,'active.json'),operation);};
  const cache=(entry:Entry,text:string)=>writeJson(path.join(directory,'segments',entry.key+'.json'),{locale:operation.locale,source:entry.text,translation:text,operationId:operation.key,createdAt:new Date().toISOString()});
  const translate=async(batch:Entry[],repair=false)=>{
    let output='';
    await runTranslationTransport({cwd:workspaceRoot(),prompt:translationPrompt(batch,operation.locale,repair),timeoutMs:120000,
      onRun:run=>{if(repair)Object.assign(operation,{repairRunId:run.runId,repairSessionId:run.sessionId});else Object.assign(operation,{sessionId:run.sessionId,runId:run.runId,remoteSessionId:run.remoteSessionId,transport:run.transport,status:'running'});save();},
      onMetrics:metrics=>{if(repair)operation.repairMetrics=metrics;else operation.metrics=metrics;save();},
      onText:text=>{output+=text;},onFinalText:text=>{output=text;},
    });
    fs.writeFileSync(path.join(directory,'operations',operation.key+(repair?'.repair':'')+'.output.txt'),output,'utf8');
    const parsed=extractJsonObject(output),rows=(parsed.obj as any)?.translations;
    if(parsed.truncated || !Array.isArray(rows) || rows.length!==batch.length || new Set(rows.map((r:any)=>r.id)).size!==batch.length)
      return {valid:[] as Array<{entry:Entry,text:string}>,invalid:[...batch]};
    const valid:Array<{entry:Entry,text:string}>=[],invalid:Entry[]=[];
    for(const entry of batch) {
      try {
        const text=restoreTranslation(rows.find((r:any)=>r.id===entry.id)?.text,entry.packed.protectedValues);
        if(translationLooksLikeTarget(text,operation.locale))valid.push({entry,text});else invalid.push(entry);
      } catch { invalid.push(entry); }
    }
    return {valid,invalid};
  };
  try {
    const first=await translate(entries,false);
    first.valid.forEach(({entry,text})=>cache(entry,text));
    let invalid=first.invalid;
    if(invalid.length) {
      operation.repairSegments=invalid.length;save();
      const repaired=await translate(invalid,true);
      repaired.valid.forEach(({entry,text})=>cache(entry,text));
      invalid=repaired.invalid;
    }
    if(invalid.length)throw new Error(`Localization output is not in target locale ${operation.locale}: ${invalid.length} segment(s) after repair`);
    operation.status='completed';operation.completedAt=new Date().toISOString();operation.error=undefined;
  } catch(error) {operation.status='failed';operation.error=error instanceof Error?error.message:String(error);}
  finally {operation.wallMs=Date.now()-Date.parse(operation.createdAt);save();}
}
