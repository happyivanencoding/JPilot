import {incompleteEmptySearch} from "@/lib/v1-directions.mjs";
import {compactDirectionHistory} from "@/lib/v1-directions.mjs";
import {projectV1JobScores} from "@/lib/v1-match.mjs";
import path from "node:path";
import {readJson,writeJson} from "@/lib/mobile-state.mjs";
import {prepareV1Display} from "@/lib/v1-display";
import {currentVersionTasks} from "@/lib/v1-journey.mjs";
import fs from "node:fs";
import { headers } from "next/headers";
import * as yaml from "js-yaml";
import { activeProfileId } from "@/lib/profile-request";
import { getProfile, listProfiles, profileFile } from "@/lib/profile-context";
import { mobileDirectory, prepareTaskHistory, readMobileTask, listMobileTasks, reconcileCompletedEvaluationCards, startMobileTask, type MobileTask } from "@/lib/mobile-engine";
import { readCandidatureStore, saveMobileOffer, updateMobileJob, reconcileCandidatures } from "@/lib/candidatures";
import { dashboardFor, APPLICATION_STATUSES, DISCOVERY_OFFER_LIMIT, stageOf, topDiscoveryOffers } from "@/lib/mobile-domain.mjs";
import { readReport, readApplications, workspaceRoot } from "@/lib/backend/workspace";
import { currentCandidateVersion, currentAnalysis, decideCvDraft, saveCanonicalCv } from "@/lib/mobile-history";
import { discoveryProjection, withProfileLock, evaluationProjection, contractMatches } from "@/lib/mobile-state.mjs";
import { taskView,estimateView } from "@/lib/mobile-view";
import {localizeDisplay} from "@/lib/display-localization";
import {requestUiLocale,applicationLanguage,documentLanguage,publicError} from "@/lib/language-contract.mjs";
import {updateTailoredCvDraft,decideTailoredCvDraft,updateTailoredCvGuidance} from "@/lib/tailored-cv";
import {reportForDisplay} from "@/lib/localization-core.mjs";
import { FLOW_DEFAULTS, flowEstimate } from "@/lib/ai-metrics.mjs";
import { reconcileMobileTasks } from "@/lib/mobile-recovery";
import { prewarmAgentDockCodex } from "@/lib/agentdock-acp";
import {recordServerProductEvent} from "@/lib/product-analytics.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const profileId = await activeProfileId(url.searchParams.get("profileId"));
    const locale=requestUiLocale(req,url.searchParams.get("uiLocale"));
    const preview=process.env.JOBPILOT_V1_PREVIEW === "1";
    // V1 explanations, company/job detail and saved-result localization follow
    // the visible app language. Legacy profile.display.analysis_language is kept
    // only for backward-compatible files and no longer overrides the device/UI.
    const analysisLocale=locale;
    const journey=(readJson(path.join(mobileDirectory(profileId),"journey.json")) || {});
    const localizationOptions={retry:url.searchParams.get("retryLocalization")==="1"};
    // Translate only job prose currently exposed by training/comparison.
    const displayJobIds=new Set((url.searchParams.get("displayJobIds") || "").split(",").filter(Boolean));
    // Presentation reads and language switches never prewarm or start business Agents.
    void reconcileMobileTasks(profileId).catch(()=>{});
    if (url.searchParams.has("taskId")) {
      const task=readMobileTask(profileId,url.searchParams.get("taskId")!);
      const view=taskView(task,readCandidatureStore(profileId).jobs,true,locale);
      if(view.result && task.kind!=="ingest") view.result=await localizeDisplay(profileId,analysisLocale,view.result,"result",{...localizationOptions,identity:task.id});
      return Response.json(view,{headers:{"Cache-Control":"no-store"}});
    }
    if(url.searchParams.has("jobId")) {
      const job=readCandidatureStore(profileId).jobs.find(j=>j.id===url.searchParams.get("jobId"));
      if(!job)throw new Error("Candidature introuvable.");
      const projected=projectV1JobScores({...evaluationProjection(job,listMobileTasks(profileId)),stage:stageOf(job.status)},listMobileTasks(profileId),currentCandidateVersion(profileId).id);
      return Response.json(await localizeDisplay(profileId,analysisLocale,projected,"job",{...localizationOptions,identity:job.id}),{headers:{"Cache-Control":"no-store"}});
    }
    if(url.searchParams.has("reportJobId")) {
      const job=readCandidatureStore(profileId).jobs.find(j=>j.id===url.searchParams.get("reportJobId"));
      if(!job?.reportNum || !readApplications(profileId).some(a=>String(a.n)===String(job.reportNum))) return Response.json({error:publicError("Rapport introuvable pour ce profil.",locale)},{status:404});
      const report=readReport(String(job.reportNum));
      if(!report) return Response.json({error:publicError("Rapport introuvable.",locale)},{status:404});
      return Response.json(await localizeDisplay(profileId,analysisLocale,{markdown:reportForDisplay(report.content)},"report",{...localizationOptions,identity:`report:${job.reportNum}`}),{headers:{"Cache-Control":"no-store"}});
    }
    let store = reconcileCandidatures(profileId);
    const read = (kind: "cv" | "config") => { try { return fs.readFileSync(profileFile(profileId, kind), "utf8"); } catch { return ""; } };
    const config = yaml.load(read("config")) as Record<string, unknown> | null;
    const {version,tasks} = await withProfileLock(mobileDirectory(profileId),()=>{
      const version=currentCandidateVersion(profileId);
      return {version,tasks:prepareTaskHistory(profileId,version)};
    });
    store=reconcileCompletedEvaluationCards(profileId,tasks,store);
    const requestHeaders=await headers();
    const restricted = requestHeaders.get("x-jobpilot-profiles")?.split(",").map(value=>value.trim()).filter(Boolean);
    const role=requestHeaders.get("x-jobpilot-role") || (restricted ? "user" : "admin");
    const profiles = listProfiles().filter(p => !restricted || restricted.includes(p.id)).map(({ id, name, shortName }) => ({ id, name, shortName }));
    const projectedJobs=store.jobs.map(j=>projectV1JobScores({...evaluationProjection(j,tasks),stage:stageOf(j.status)},tasks,version.id));
    const cv=read("cv");
    const foundAnalysis=currentAnalysis(profileId,version,tasks);
    const analysis=foundAnalysis?.stale ? null : foundAnalysis;
    const visibleTasks=tasks.filter((t:MobileTask)=>t.input?.silent!==true);
    const careerDirections=Array.isArray((analysis as any)?.careerDirections)?(analysis as any).careerDirections:[];
    const searchKeywords=Array.isArray((analysis as any)?.searchKeywords)?(analysis as any).searchKeywords:[];
    const v1AnalysisReady=Boolean(analysis && (analysis as any).inputVersionId===version.id && (careerDirections.length || searchKeywords.length));
    const activeAnalysis=tasks.find((t:MobileTask)=>t.kind==="analysis"&&t.inputVersionId===version.id&&["queued","running","reconciling"].includes(t.status));
    const failedV1Analysis=tasks.find((t:MobileTask)=>t.kind==="analysis"&&t.inputVersionId===version.id&&["failed","interrupted"].includes(t.status)&&(String(t.input?.source||"").startsWith("v1-")||String(t.operationKey||"").includes("analysis-v")));
    const selectedSearchTask=tasks.find((t:MobileTask)=>t.id===journey.searchTaskId&&t.kind==="search"&&t.inputVersionId===version.id);
    const isAnyV1SearchTask=(t:MobileTask)=>t.kind==="search"&&(t.input?.experience==="v1"||String(t.operationKey||"").includes("search-v"));
    const isCurrentV1SearchTask=(t:MobileTask)=>isAnyV1SearchTask(t)&&t.inputVersionId===version.id;
    const latestSearchTask=selectedSearchTask || tasks.find(isCurrentV1SearchTask);
    const completedCurrentSearches=tasks.filter((t:MobileTask)=>isCurrentV1SearchTask(t)&&t.status==="completed"&&Array.isArray(t.result?.offers));
    const completedSearches=tasks.filter((t:MobileTask)=>isAnyV1SearchTask(t)&&t.status==="completed"&&Array.isArray(t.result?.offers));
    const latestSearch=selectedSearchTask?.status==="completed" ? selectedSearchTask : completedCurrentSearches[0];
    const projectDiscovery=(task?:MobileTask)=>{
      const currentVersion=!!task && task.inputVersionId===version.id;
      const result=discoveryProjection(task?.result || null,currentVersion?projectedJobs:[],currentVersion?currentVersionTasks(tasks,version.id):[]);
      const eligible=result.offers.filter((o:any)=>contractMatches(o,(config as any)?.target_roles?.contract_types || []).matches);
      return {...result,offers:(preview?eligible:topDiscoveryOffers(eligible)).slice(0,preview?4:DISCOVERY_OFFER_LIMIT),displayLimit:DISCOVERY_OFFER_LIMIT,availableCount:eligible.length};
    };
    const currentDiscovery={...projectDiscovery(latestSearch),taskId:latestSearch?.id || null,query:String(latestSearch?.input?.query || ""),candidateVersionId:latestSearch?.inputVersionId || version.id,cvVersion:latestSearch?.cvVersion ?? version.cvVersion,staleForCurrentCv:false};
    const searchHistory=compactDirectionHistory(completedSearches.filter((t:MobileTask)=>t.id!==latestSearch?.id),analysis || {}).slice(0,24).flatMap((task:MobileTask)=>{
      const projected=projectDiscovery(task);
      const offers=[...new Map((projected.offers || []).filter((offer:any)=>offer.url).map((offer:any)=>[String(offer.url),offer])).values()];
      if(!offers.length)return [];
      return [{taskId:task.id,query:String(task.input?.query || ""),searchedAt:task.updatedAt || task.createdAt || "",candidateVersionId:task.inputVersionId || null,cvVersion:task.cvVersion ?? null,staleForCurrentCv:task.inputVersionId!==version.id,offers}];
    });
    const snapshot={
      version: "0.6.0", profile: { id: profileId, name: getProfile(profileId).name }, profiles,
      access:{role,canSwitchProfiles:role!=="user"&&profiles.length>1,needsCv:role==="user"&&!cv.trim()},
      cv, cvState:{versionId:version.id,cvVersion:version.cvVersion,revision:version.revision,changedAt:version.createdAt},
      languageSettings:{uiLocale:locale,analysisLanguage:analysisLocale,applicationLanguage:applicationLanguage(config || {},read("cv")),documentLanguage:documentLanguage(version)},
      config: config || {}, jobs: projectedJobs, dashboard: dashboardFor(projectedJobs), statuses: APPLICATION_STATUSES,
      tasks: visibleTasks.slice(0,60).map((t:MobileTask)=>taskView(t,projectedJobs,false,locale)),
      analysis,
      v1:{
        careerDirections,searchKeywords,
        analysisState:activeAnalysis?.status || (v1AnalysisReady?"completed":failedV1Analysis?.status || "pending"),
        searchState:v1AnalysisReady ? (latestSearchTask?.status || "pending") : "pending",
        needsBootstrap:Boolean(cv.trim())&&!v1AnalysisReady&&!activeAnalysis&&!failedV1Analysis,
        backgroundActive:tasks.some((t:MobileTask)=>t.input?.silent===true&&["analysis","search","ingest"].includes(t.kind)&&["queued","running","reconciling"].includes(t.status)),
        deepMatchPrefetchLimit:DISCOVERY_OFFER_LIMIT,
      },
      discovery:{...currentDiscovery,history:searchHistory},
      flowEstimates:Object.fromEntries(Object.entries(FLOW_DEFAULTS).map(([kind,choice])=>[kind,estimateView(flowEstimate(tasks,kind,choice.model,choice.reasoning),locale)])),
      updatedAt: store.updatedAt,
    };
    const display=preview ? await prepareV1Display(profileId,analysisLocale,snapshot,tasks,journey,localizationOptions.retry,locale)
      : await localizeDisplay(profileId,locale,snapshot,"snapshot",localizationOptions);
    // Full job prose is translated lazily on opening a detail. Cached translations
    // are reused here, but unrequested historical reports never consume Agents.
    display.jobs=[];
    for(const job of snapshot.jobs as Array<Record<string,any>>) display.jobs.push(await localizeDisplay(profileId,analysisLocale,job,"job",{...localizationOptions,schedule:displayJobIds.has(job.id),identity:job.id}));
    return Response.json(display,{headers:{"Cache-Control":"no-store"}});
  } catch (e) { console.error("mobile read failed",e);return Response.json({ error: publicError(e,requestUiLocale(req)) }, { status: 400 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profileId = await activeProfileId(body.profileId);
    const locale=requestUiLocale(req,body.input?.uiLocale || body.input?.language || body.uiLocale);
    if(body.action === "finishOnboarding") {
      await withProfileLock(mobileDirectory(profileId),()=>{
        const file=path.join(mobileDirectory(profileId),"journey.json");
        writeJson(file,{...(readJson(file) || {}),completed:true});
      });
      return Response.json({ok:true});
    }
    if(body.action === "retryV1") {
      const version=currentCandidateVersion(profileId);
      const tasks=currentVersionTasks(listMobileTasks(profileId),version.id);
      const analysis=tasks.find((t:any)=>t.kind==="analysis");
      if(!analysis || ["failed","interrupted"].includes(analysis.status)) await startMobileTask(profileId,{kind:"analysis",silent:true,retry:true,source:"v1-retry",uiLocale:locale});
      const journey=readJson(path.join(mobileDirectory(profileId),"journey.json")) || {};
      const selected=tasks.find((t:any)=>t.id===journey.searchTaskId);
      const urls=new Set((selected?.result?.offers || []).slice(0,4).map((o:any)=>o.url));
      for(const task of tasks.filter((t:any)=>(t.id===selected?.id || t.kind==="deep_match"&&urls.has(t.input.url))&&(["failed","interrupted"].includes(t.status)||incompleteEmptySearch(t)))) {
        const retried=await startMobileTask(profileId,{...task.input,retry:true});
        if(task.kind==="search") await withProfileLock(mobileDirectory(profileId),()=>{
          const file=path.join(mobileDirectory(profileId),"journey.json"),journey=(readJson(file) || {});
          if(journey.searchTaskId===task.id) writeJson(file,{...journey,searchTaskId:retried.id});
        });
      }
      return Response.json({ok:true});
    }
    if (body.action === "bootstrapV1") {
      const task=await startMobileTask(profileId,{kind:"analysis",silent:true,retry:true,source:"v1-auto-bootstrap",uiLocale:locale});
      return Response.json({ok:true,task:taskView(task,readCandidatureStore(profileId).jobs,false,locale)},{status:task.status==="completed"?200:202});
    }
    if (body.action === "task") {
      const task = await startMobileTask(profileId, {...body.input,uiLocale:locale});
      if(body.input?.kind==="search") await withProfileLock(mobileDirectory(profileId),()=>{
        const file=path.join(mobileDirectory(profileId),"journey.json");
        writeJson(file,{...(readJson(file) || {}),query:task.input.query,searchTaskId:task.id,searchRequestedAt:new Date().toISOString(),searchFeedback:(task as any).searchFeedback || "new"});
      });
      const view=taskView(task,readCandidatureStore(profileId).jobs,true,locale);
      if(view.result && task.kind!=="ingest")view.result=await localizeDisplay(profileId,locale,view.result,"result",{identity:task.id});
      return Response.json(view, { status: task.status === "completed" ? 200 : 202 });
    }
    if (body.action === "batchTasks") {
      const inputs=Array.isArray(body.inputs) ? body.inputs.slice(0,24) : [];
      if(!inputs.length) throw new Error("Aucune tâche sélectionnée.");
      const jobs=readCandidatureStore(profileId).jobs;
      const tasks=[];
      for(const input of inputs) {
        if(!input || typeof input!=="object" || Array.isArray(input)) continue;
        const task=await startMobileTask(profileId,{...input,uiLocale:locale});
        tasks.push(taskView(task,jobs,false,locale));
      }
      if(!tasks.length) throw new Error("Aucune tâche sélectionnée.");
      return Response.json({ok:true,tasks},{status:tasks.every(task=>["completed","failed"].includes(task.status))?200:202});
    }
    if (body.action === "saveOffers") {
      const offers=Array.isArray(body.offers) ? body.offers.slice(0,24) : [];
      if(!offers.length) throw new Error("Aucune offre sélectionnée.");
      const jobs=[];
      for(const offer of offers) jobs.push(await saveMobileOffer(profileId,offer));
      return Response.json({ok:true,jobs});
    }
    if (body.action === "saveOffer") return Response.json({ ok: true, job: await saveMobileOffer(profileId, body.offer) });
    if(body.action === "trackOffer") {
      const job=await saveMobileOffer(profileId,body.offer);
      return Response.json({ok:true,job:updateMobileJob(profileId,job.id,body.change || {})});
    }
    if (body.action === "tailorOffer") {
      const job=await saveMobileOffer(profileId,body.offer);
      const task=await startMobileTask(profileId,{kind:"cv",jobId:job.id,retry:true,uiLocale:locale});
      const view=taskView(task,readCandidatureStore(profileId).jobs,true,locale);
      return Response.json({ok:true,jobId:job.id,task:view},{status:task.status==="completed"?200:202});
    }
    if (body.action === "updateJob") return Response.json({ ok: true, job: updateMobileJob(profileId, String(body.id), body.change || {}) });
    if (body.action === "confirmCv") {
      const task = readMobileTask(profileId, String(body.taskId));
      if (task.kind !== "ingest" || task.status !== "completed" || body.confirmed !== true) throw new Error("Relire et confirmer l’aperçu avant d’enregistrer.");
      if (typeof body.content !== "string" || !body.content.trim()) throw new Error("CV vide.");
      const result = await saveCanonicalCv(profileId,body.content,body.expectedVersionId);
      void recordServerProductEvent(workspaceRoot(),profileId,'cv_ready',task.id,Date.now()).catch(()=>{});
      const analysisTask=await startMobileTask(profileId,{kind:"analysis",silent:true,retry:true,source:"v1-auto-after-cv",uiLocale:locale});
      return Response.json({...result,analysisTaskId:analysisTask.id || null,analysisState:analysisTask.status});
    }
    if (body.action === "decideCvDraft") return Response.json(await decideCvDraft(profileId,String(body.draftId),String(body.decision)));
    if (body.action === "updateTailoredCvGuidance") return Response.json({ok:true,...updateTailoredCvGuidance(profileId,String(body.jobId),{facts:body.facts,preferences:body.preferences,userProvidedConfirmed:body.userProvidedConfirmed===true})});
    if (body.action === "updateTailoredCvDraft") {
      const draft=await updateTailoredCvDraft(profileId,String(body.draftId),body.payload,body.userProvidedConfirmed===true);
      const store=readCandidatureStore(profileId);
      const job=store.jobs.find((item:any)=>item.cvDraft?.id===draft.id);
      const reviewTask=job?await startMobileTask(profileId,{kind:"cv_review",jobId:job.id,draftId:draft.id,revision:draft.revision,retry:true,silent:true,source:"v1-auto-after-draft-edit",uiLocale:locale}):null;
      return Response.json({ok:true,draft,reviewTaskId:reviewTask?.id || null,reviewState:reviewTask?.status || null});
    }
    if (body.action === "decideTailoredCvDraft") return Response.json(await decideTailoredCvDraft(profileId,String(body.draftId),String(body.decision),String(body.reason || "")));
    return Response.json({ error: publicError("Action inconnue.",locale) }, { status: 400 });
  } catch (e) {
    if((e as any)?.code==="direction-budget") return Response.json({error:(e as Error).message,code:"direction-budget"},{status:429});
    console.error("mobile action failed",e);return Response.json({error:publicError(e,requestUiLocale(req))},{status:400});
  }
}
