import {directionDescriptor,directionNotice} from "@/lib/v1-directions.mjs";
import {matchScoreView,friendlyOffer} from "@/lib/v1-match.mjs";
import {searchProgress} from "@/lib/v1-progress.mjs";
import {localizeDisplay} from '@/lib/display-localization';
import {completedOfferBatch} from '@/lib/v1-journey.mjs';

/** Release complete product sections, never placeholder translations or a score
 * computed from an older CV. Raw persisted model outputs stay untouched. */
export async function prepareV1Display(profileId:string, locale:string, snapshot:any, tasks:any[], journey:any, retry=false, uiLocale=locale) {
  const result={...snapshot};
  const analysis=snapshot.analysis && !snapshot.analysis.stale ? await localizeDisplay(profileId,locale,snapshot.analysis,'analysis',{retry}) : null;
  let analysisReady=!!analysis && !analysis.localization?.pending && snapshot.v1.analysisState==='completed';
  const localizeBatch=async(group:any)=>{
    const offers=group.offers || [];
    const deepReady=offers.filter((offer:any)=>offer.deepMatchState==='ready');
    const localized=await localizeDisplay(profileId,locale,{offers:deepReady},'discovery',{retry});
    const ready=completedOfferBatch(offers) && !localized.localization?.pending;
    return {...group,offers:ready?localized.offers:[],ready,localization:localized.localization,
      failed:offers.some((offer:any)=>offer.deepMatchState==='failed') || !!localized.localization?.failed};
  };
  const current=await localizeBatch(snapshot.discovery);
  const rawDirections=snapshot.analysis?.careerDirections || [];
  const allGroups=[snapshot.discovery,...(snapshot.discovery.history || [])];
  const descriptors=rawDirections.map((d:any)=>({...d,...directionDescriptor(d.searchQuery,snapshot.analysis,uiLocale),title:d.title,outputLocale:snapshot.analysis?.outputLocale || 'en'}));
  const titles=await localizeDisplay(profileId,uiLocale,{items:[...descriptors,...allGroups.map((g:any)=>{
    const descriptor=directionDescriptor(g.query,snapshot.analysis || {},uiLocale);
    return {...descriptor,outputLocale:descriptor.known?uiLocale:(snapshot.analysis?.careerDirections?.find((d:any)=>d.searchQuery===g.query)?'en':undefined)};
  })]},'directions',{retry});
  const labelsReady=!titles.localization?.pending;
  analysisReady=analysisReady&&labelsReady;
  const displayDirections=labelsReady?titles.items.slice(0,descriptors.length).map((item:any,index:number)=>({...analysis?.careerDirections?.[index],searchQuery:item.searchQuery,key:item.key,title:item.title})):[];
  const labelFor=(index:number)=>labelsReady?titles.items[descriptors.length+index]?.title:'';
  current.label=labelFor(0);
  current.directionKey=directionDescriptor(snapshot.discovery.query,snapshot.analysis || {}).key;
  const history=[];
  for(const [index,group] of (snapshot.discovery.history || []).entries()) {
    const projected=await localizeBatch(group);
    projected.label=labelFor(index+1);projected.directionKey=directionDescriptor(group.query,snapshot.analysis || {}).key;
    history.push(projected);
  }
  const importTask=tasks.find(t=>t.kind==='ingest' && t.id===journey.ingestTaskId);
  const searchTask=tasks.find(t=>t.kind==='search' && t.id===journey.searchTaskId);
  const activeImport=importTask && ['queued','running','reconciling'].includes(importTask.status);
  const failed=importTask?.status==='failed' || snapshot.v1.analysisState==='failed' || searchTask?.status==='failed' || current.failed || !!analysis?.localization?.failed;
  const hasNewSearch=searchTask && searchTask.id!==current.taskId;
  result.analysis=analysisReady && !activeImport ? analysis : null;
  if(analysisReady && analysis.candidateName) result.profile={...result.profile,name:analysis.candidateName};
  result.v1={...snapshot.v1,careerDirections:analysisReady&&!activeImport?displayDirections:[],
    analysisReady:analysisReady&&!activeImport,offersReady:current.ready&&labelsReady&&!hasNewSearch&&!activeImport,
    presentationFailed:!!failed||!!titles.localization?.failed,importState:importTask?.status || 'none',
    searchProgress:searchProgress(searchTask,{
      ...current,offers:hasNewSearch?[]:snapshot.discovery.offers || [],
      availableCount:hasNewSearch?undefined:snapshot.discovery.availableCount,
      resultMatches:!hasNewSearch,ready:current.ready&&labelsReady&&!hasNewSearch,
      failed:(!hasNewSearch&&current.failed)||!!titles.localization?.failed,
    },uiLocale,journey.searchRequestedAt),
    searchNotice:labelsReady?directionNotice(journey.searchFeedback || '',current.label || '',uiLocale):'',
    journey:{completed:journey.completed===true,query:journey.query || '',label:current.label || ''},
    backgroundActive:snapshot.v1.backgroundActive || !!activeImport || (!!titles.localization?.pending&&!titles.localization?.failed) || (!!analysis?.localization?.pending&&!analysis?.localization?.failed) || (!!current.localization?.pending&&!current.localization?.failed) || history.some(g=>g.localization?.pending&&!g.localization?.failed),
  };
  result.discovery={...current,offers:result.v1.offersReady&&labelsReady?current.offers:[],history:labelsReady?history.filter(g=>g.ready):[]};
  if(hasNewSearch && current.ready && labelsReady) result.discovery.history.unshift({...current,history:undefined});
  const format=(offer:any)=>{
    const saved=(snapshot.jobs || []).find((job:any)=>job.url===offer.url && job.v1Match);
    const match=saved?matchScoreView(saved):matchScoreView(offer);
    return {...friendlyOffer(offer),matchScore:match,
      deepMatch:offer.deepMatch?{...friendlyOffer(offer).deepMatch,currentScore:match.current,cvPotentialScore:match.potential}:offer.deepMatch};
  };
  result.discovery.offers=result.discovery.offers.map(format);
  result.discovery.history=result.discovery.history.map((group:any)=>({...group,offers:group.offers.map(format)}));
  result.localization={locale,pending:!analysisReady && !!snapshot.analysis,failed:!!analysis?.localization?.failed};
  return result;
}
