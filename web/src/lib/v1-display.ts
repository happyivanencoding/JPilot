import {localizeDisplay} from '@/lib/display-localization';
import {completedOfferBatch} from '@/lib/v1-journey.mjs';

/** Release complete product sections, never placeholder translations or a score
 * computed from an older CV. Raw persisted model outputs stay untouched. */
export async function prepareV1Display(profileId:string, locale:string, snapshot:any, tasks:any[], journey:any, retry=false) {
  const result={...snapshot};
  const analysis=snapshot.analysis && !snapshot.analysis.stale ? await localizeDisplay(profileId,locale,snapshot.analysis,'analysis',{retry}) : null;
  const analysisReady=!!analysis && !analysis.localization?.pending && snapshot.v1.analysisState==='completed';
  const localizeBatch=async(group:any)=>{
    const offers=group.offers || [];
    const deepReady=offers.filter((offer:any)=>offer.deepMatchState==='ready');
    const localized=await localizeDisplay(profileId,locale,{offers:deepReady},'discovery',{retry});
    const ready=completedOfferBatch(offers) && !localized.localization?.pending;
    return {...group,offers:ready?localized.offers:[],ready,localization:localized.localization,
      failed:offers.some((offer:any)=>offer.deepMatchState==='failed') || !!localized.localization?.failed};
  };
  const current=await localizeBatch(snapshot.discovery);
  const history=[];
  for(const group of snapshot.discovery.history || []) history.push(await localizeBatch(group));
  const importTask=tasks.find(t=>t.kind==='ingest' && t.id===journey.ingestTaskId);
  const searchTask=tasks.find(t=>t.kind==='search' && t.id===journey.searchTaskId);
  const activeImport=importTask && ['queued','running','reconciling'].includes(importTask.status);
  const failed=importTask?.status==='failed' || snapshot.v1.analysisState==='failed' || searchTask?.status==='failed' || current.failed || !!analysis?.localization?.failed;
  const hasNewSearch=searchTask && searchTask.id!==current.taskId;
  result.analysis=analysisReady && !activeImport ? analysis : null;
  if(analysisReady && analysis.candidateName) result.profile={...result.profile,name:analysis.candidateName};
  result.v1={...snapshot.v1,careerDirections:analysisReady&&!activeImport?analysis.careerDirections:[],
    analysisReady:analysisReady&&!activeImport,offersReady:current.ready&&!hasNewSearch&&!activeImport,
    presentationFailed:!!failed,importState:importTask?.status || 'none',
    journey:{completed:journey.completed===true,query:journey.query || ''},
    backgroundActive:snapshot.v1.backgroundActive || !!activeImport || (!!analysis?.localization?.pending&&!analysis?.localization?.failed) || (!!current.localization?.pending&&!current.localization?.failed) || history.some(g=>g.localization?.pending&&!g.localization?.failed),
  };
  result.discovery={...current,offers:result.v1.offersReady?current.offers:[],history:history.filter(g=>g.ready)};
  if(hasNewSearch && current.ready) result.discovery.history.unshift({...current,history:undefined});
  result.localization={locale,pending:!analysisReady && !!snapshot.analysis,failed:!!analysis?.localization?.failed};
  return result;
}
