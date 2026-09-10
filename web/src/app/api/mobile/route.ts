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
import {updateTailoredCvDraft,decideTailoredCvDraft} from "@/lib/tailored-cv";
import {reportForDisplay} from "@/lib/localization-core.mjs";
import { FLOW_DEFAULTS, flowEstimate } from "@/lib/ai-metrics.mjs";
import { reconcileMobileTasks } from "@/lib/mobile-recovery";
import { prewarmAgentDockCodex } from "@/lib/agentdock-acp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const profileId = await activeProfileId(url.searchParams.get("profileId"));
    const locale=requestUiLocale(req,url.searchParams.get("uiLocale"));
    const localizationOptions={retry:url.searchParams.get("retryLocalization")==="1"};
    // Translate only job prose currently exposed by training/comparison.
    const displayJobIds=new Set((url.searchParams.get("displayJobIds") || "").split(",").filter(Boolean));
    // Presentation reads and language switches never prewarm or start business Agents.
    void reconcileMobileTasks(profileId).catch(()=>{});
    if (url.searchParams.has("taskId")) {
      const task=readMobileTask(profileId,url.searchParams.get("taskId")!);
      const view=taskView(task,readCandidatureStore(profileId).jobs,true,locale);
      if(view.result && task.kind!=="ingest") view.result=await localizeDisplay(profileId,locale,view.result,"result",{...localizationOptions,identity:task.id});
      return Response.json(view,{headers:{"Cache-Control":"no-store"}});
    }
    if(url.searchParams.has("jobId")) {
      const job=readCandidatureStore(profileId).jobs.find(j=>j.id===url.searchParams.get("jobId"));
      if(!job)throw new Error("Candidature introuvable.");
      const projected={...evaluationProjection(job,listMobileTasks(profileId)),stage:stageOf(job.status)};
      return Response.json(await localizeDisplay(profileId,locale,projected,"job",{...localizationOptions,identity:job.id}),{headers:{"Cache-Control":"no-store"}});
    }
    if(url.searchParams.has("reportJobId")) {
      const job=readCandidatureStore(profileId).jobs.find(j=>j.id===url.searchParams.get("reportJobId"));
      if(!job?.reportNum || !readApplications(profileId).some(a=>String(a.n)===String(job.reportNum))) return Response.json({error:publicError("Rapport introuvable pour ce profil.",locale)},{status:404});
      const report=readReport(String(job.reportNum));
      if(!report) return Response.json({error:publicError("Rapport introuvable.",locale)},{status:404});
      return Response.json(await localizeDisplay(profileId,locale,{markdown:reportForDisplay(report.content)},"report",{...localizationOptions,identity:`report:${job.reportNum}`}),{headers:{"Cache-Control":"no-store"}});
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
    const latest = (kind: string) => tasks.find((t:MobileTask) => t.kind === kind && t.status === "completed");
    const projectedJobs=store.jobs.map(j=>({...evaluationProjection(j,tasks),stage:stageOf(j.status)}));
    const cv=read("cv");
    const snapshot={
      version: "0.3.9", profile: { id: profileId, name: getProfile(profileId).name }, profiles,
      access:{role,canSwitchProfiles:role!=="user"&&profiles.length>1,needsCv:role==="user"&&!cv.trim()},
      cv, cvState:{versionId:version.id,cvVersion:version.cvVersion,revision:version.revision,changedAt:version.createdAt},
      languageSettings:{uiLocale:locale,applicationLanguage:applicationLanguage(config || {},read("cv")),documentLanguage:documentLanguage(version)},
      config: config || {}, jobs: projectedJobs, dashboard: dashboardFor(projectedJobs), statuses: APPLICATION_STATUSES,
      tasks: tasks.slice(0,60).map((t:MobileTask)=>taskView(t,projectedJobs,false,locale)),
      analysis: currentAnalysis(profileId,version,tasks),
      discovery: (()=>{const result=discoveryProjection(tasks.find((t:MobileTask)=>t.kind==="search" && t.result?.offers)?.result || null,projectedJobs,tasks);const eligible=result.offers.filter((o:any)=>contractMatches(o,(config as any)?.target_roles?.contract_types || []).matches);return {...result,offers:topDiscoveryOffers(eligible),displayLimit:DISCOVERY_OFFER_LIMIT,availableCount:eligible.length};})(),
      flowEstimates:Object.fromEntries(Object.entries(FLOW_DEFAULTS).map(([kind,choice])=>[kind,estimateView(flowEstimate(tasks,kind,choice.model,choice.reasoning),locale)])),
      updatedAt: store.updatedAt,
    };
    const display=await localizeDisplay(profileId,locale,snapshot,"snapshot",localizationOptions);
    // Full job prose is translated lazily on opening a detail. Cached translations
    // are reused here, but unrequested historical reports never consume Agents.
    display.jobs=[];
    for(const job of snapshot.jobs as Array<Record<string,any>>) display.jobs.push(await localizeDisplay(profileId,locale,job,"job",{...localizationOptions,schedule:displayJobIds.has(job.id),identity:job.id}));
    return Response.json(display,{headers:{"Cache-Control":"no-store"}});
  } catch (e) { console.error("mobile read failed",e);return Response.json({ error: publicError(e,requestUiLocale(req)) }, { status: 400 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profileId = await activeProfileId(body.profileId);
    const locale=requestUiLocale(req,body.input?.uiLocale || body.input?.language || body.uiLocale);
    if (body.action === "task") {
      const task = await startMobileTask(profileId, {...body.input,uiLocale:locale});
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
    if (body.action === "updateJob") return Response.json({ ok: true, job: updateMobileJob(profileId, String(body.id), body.change || {}) });
    if (body.action === "confirmCv") {
      const task = readMobileTask(profileId, String(body.taskId));
      if (task.kind !== "ingest" || task.status !== "completed" || body.confirmed !== true) throw new Error("Relire et confirmer l’aperçu avant d’enregistrer.");
      if (typeof body.content !== "string" || !body.content.trim()) throw new Error("CV vide.");
      const result = await saveCanonicalCv(profileId,body.content,body.expectedVersionId);
      return Response.json(result);
    }
    if (body.action === "decideCvDraft") return Response.json(await decideCvDraft(profileId,String(body.draftId),String(body.decision)));
    if (body.action === "updateTailoredCvDraft") return Response.json({ok:true,draft:await updateTailoredCvDraft(profileId,String(body.draftId),body.payload)});
    if (body.action === "decideTailoredCvDraft") return Response.json(await decideTailoredCvDraft(profileId,String(body.draftId),String(body.decision)));
    return Response.json({ error: publicError("Action inconnue.",locale) }, { status: 400 });
  } catch (e) { console.error("mobile action failed",e);return Response.json({ error: publicError(e,requestUiLocale(req)) }, { status: 400 }); }
}
