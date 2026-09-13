import {offerInSearchArea} from '@/lib/search-area.mjs';
import {roleCvOutcome} from '@/lib/onward-cv.mjs';
import {broadCareerDirections} from "@/lib/career-directions.mjs";
import {directionDescriptor,directionNotice} from "@/lib/v1-directions.mjs";
import {matchScoreView,friendlyOffer} from "@/lib/v1-match.mjs";
import {searchProgress} from "@/lib/v1-progress.mjs";
import {cvProgress} from "@/lib/v1-cv-progress.mjs";
import {localizeDisplay} from '@/lib/display-localization';
import {orientationOutputLocale} from '@/lib/v1-journey.mjs';
import {candidateNameForMaterial} from '@/lib/candidate-display-name.mjs';

/** Release complete product sections, never placeholder translations or a score
 * computed from an older CV. Raw persisted model outputs stay untouched. */
export async function prepareV1Display(profileId:string, locale:string, snapshot:any, tasks:any[], journey:any, retry=false, uiLocale=locale) {
  const result={...snapshot};
  const analysis=snapshot.analysis && !snapshot.analysis.stale ? await localizeDisplay(profileId,locale,snapshot.analysis,'analysis',{retry}) : null;
  const analysisReady=!!analysis && !analysis.localization?.pending && snapshot.v1.analysisState==='completed';
  const localizeBatch=async(group:any)=>{
    const offers=(group.offers || []).filter((offer:any)=>offerInSearchArea(offer,snapshot.config?.target_roles?.search_area)).map((offer:any)=>{
      const saved=group.staleForCurrentCv?null:(snapshot.jobs || []).find((job:any)=>job.url===offer.url);
      return saved?.v1Match?.deepMatch ? {...offer,deepMatch:saved.v1Match.deepMatch} : offer;
    });
    const localizedOffers=[];let pending=false,localizationFailed=false;
    for(const offer of offers) {
      const localized=await localizeDisplay(profileId,locale,offer,'offer',{retry,identity:`discovery:${offer.url || ''}`,preservePendingSource:true});
      pending ||= !!localized.localization?.pending;
      localizationFailed ||= !!localized.localization?.failed;
      localizedOffers.push({...localized,enrichment:{
        deepMatchState:offer.deepMatchState || 'pending',
        deepMatchTaskId:offer.deepMatchTaskId || null,
        deepMatchEstimate:offer.deepMatchEstimate || null,
        deepMatchStartedAt:offer.deepMatchStartedAt || null,
        localization:localized.localization,
      }});
    }
    return {...group,offers:localizedOffers,ready:Boolean(group.taskId),
      localization:{locale,status:localizationFailed?'failed':pending?'translating':'ready',pending,failed:localizationFailed,retryable:localizationFailed},
      enrichmentFailed:offers.some((offer:any)=>offer.deepMatchState==='failed') || localizationFailed};
  };
  const current=await localizeBatch(snapshot.discovery);
  const rawDirections=broadCareerDirections(snapshot.analysis?.careerDirections || [],uiLocale,snapshot.config?.target_roles?.primary || []);
  const sourceOrientationLocale=orientationOutputLocale(snapshot.analysis || {});
  const allGroups=[snapshot.discovery,...(snapshot.discovery.history || [])];
  const descriptors=rawDirections.map((d:any)=>({...d,...directionDescriptor(d.searchQuery,snapshot.analysis,uiLocale),title:d.title,outputLocale:d.broad?uiLocale:sourceOrientationLocale}));
  const titles=await localizeDisplay(profileId,uiLocale,{items:[...descriptors,...allGroups.map((g:any)=>{
    const descriptor=directionDescriptor(g.query,snapshot.analysis || {},uiLocale);
    return {...descriptor,outputLocale:descriptor.known?uiLocale:(snapshot.analysis?.careerDirections?.find((d:any)=>d.searchQuery===g.query)?sourceOrientationLocale:undefined)};
  })]},'directions',{retry});
  const labelsReady=!titles.localization?.pending;
  const firstRunReady=analysisReady&&labelsReady;
  const displayDirections=labelsReady?titles.items.slice(0,descriptors.length).map((item:any,index:number)=>({...analysis?.careerDirections?.[rawDirections[index].sourceIndex],searchQuery:item.searchQuery,key:item.key,title:item.title})):[];
  const pendingDirectionLabel=uiLocale==='zh'?'正在准备方向':uiLocale==='fr'?'Direction en préparation':'Preparing direction';
  const labelFor=(index:number)=>labelsReady?titles.items[descriptors.length+index]?.title:pendingDirectionLabel;
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
  const searchIncomplete=searchTask?.status==='completed' && (searchTask.result?.searchMetrics?.providers || []).some((r:any)=>!['arbeitnow-dev','tracked-ats'].includes(r.id)&&['error','partial'].includes(r.status));
  const sourceNotice=searchIncomplete ? (uiLocale==='fr'?'Certaines sources sont temporairement indisponibles. Les résultats sont incomplets ; réessayez plus tard.':uiLocale==='zh'?'部分职位来源暂不可用，当前结果不完整，请稍后重试。':'Some job sources are temporarily unavailable. Results are incomplete; please retry later.') : '';
  const activeImport=importTask && ['queued','running','reconciling'].includes(importTask.status);
  const failed=['failed','interrupted'].includes(importTask?.status) || ['failed','interrupted'].includes(snapshot.v1.analysisState) || ['failed','interrupted'].includes(searchTask?.status) || !!analysis?.localization?.failed;
  result.analysis=analysisReady && !activeImport ? analysis : null;
  if(analysisReady && analysis.candidateName) result.profile={...result.profile,name:candidateNameForMaterial(analysis.candidateName,snapshot.languageSettings?.applicationLanguage)};
  result.v1={...snapshot.v1,careerDirections:firstRunReady&&!activeImport?displayDirections:[],
    analysisReady:firstRunReady&&!activeImport,offersReady:current.ready&&!activeImport,
    presentationFailed:!!failed||!!titles.localization?.failed,importState:importTask?.status || 'none',
    cvProgress:cvProgress(snapshot,tasks,journey,{ready:analysisReady&&!activeImport,translationFailed:!!analysis?.localization?.failed||!!titles.localization?.failed},uiLocale),
    searchProgress:searchProgress(searchTask,current,uiLocale,journey.searchRequestedAt),
    searchIncomplete,
    searchNotice:sourceNotice || (labelsReady?directionNotice(journey.searchFeedback || '',current.label || '',uiLocale):''),
    journey:{completed:journey.completed===true,query:journey.query || '',label:current.label || ''},
    backgroundActive:snapshot.v1.backgroundActive || !!activeImport || (!!titles.localization?.pending&&!titles.localization?.failed) || (!!analysis?.localization?.pending&&!analysis?.localization?.failed) || (!!current.localization?.pending&&!current.localization?.failed) || history.some(g=>g.localization?.pending&&!g.localization?.failed),
  };
  result.discovery={...current,offers:result.v1.offersReady?current.offers:[],history:history.filter(g=>g.ready)};
  const format=(offer:any,historyStale=false)=>{
    const saved=historyStale?null:(snapshot.jobs || []).find((job:any)=>job.url===offer.url && job.v1Match);
    const deepState=String(offer.enrichment?.deepMatchState || '');
    const deepReady=deepState==='ready'&&Boolean(saved?.v1Match?.deepMatch?.currentScore!=null || offer.deepMatch?.currentScore!=null);
    const match=deepReady?(saved?matchScoreView(saved):matchScoreView(offer)):{current:null,potential:null,baseline:null,forecast:null,reviewed:false,reviewedScore:null};
    const roleCv=saved?.cvDraft?.status==='pending' ? {jobId:saved.id,status:"pending",draftId:saved.cvDraft.id} : saved?.cv?.file ? {jobId:saved.id,status:"accepted"} : saved && tasks.some(t=>t.kind==='cv'&&t.input?.jobId===saved.id&&['queued','running','reconciling'].includes(t.status)) ? {jobId:saved.id,status:"generating"} : null;
    const friendly:any=friendlyOffer(offer);
    return {...friendly,historyStale,matchScore:historyStale?{current:null,baseline:null,forecast:null}:match,cvOutcome:historyStale?null:roleCvOutcome(saved || offer),roleCv,
      deepMatch:offer.deepMatch?{...friendly.deepMatch,currentScore:match.baseline,cvPotentialScore:match.forecast}:offer.deepMatch};
  };
  // Search order is intent-first and already decided by the retrieval/ranking
  // pipeline. Deep Match explains fit; it must not reshuffle a user's explicit
  // career direction after results are visible.
  result.discovery.offers=result.discovery.offers.map((offer:any)=>format(offer,false));
  result.discovery.history=result.discovery.history.map((group:any)=>({...group,offers:group.offers.map((offer:any)=>format(offer,!!group.staleForCurrentCv))}));
  result.localization={locale,status:analysis?.localization?.status || (!snapshot.analysis?'idle':analysisReady?'ready':'translating'),pending:!analysisReady && !!snapshot.analysis,failed:!!analysis?.localization?.failed};
  return result;
}
