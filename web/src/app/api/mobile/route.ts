import fs from "node:fs";
import { headers } from "next/headers";
import * as yaml from "js-yaml";
import { activeProfileId } from "@/lib/profile-request";
import { getProfile, listProfiles, profileFile } from "@/lib/profile-context";
import { coreRequest, mobileDirectory, prepareTaskHistory, readMobileTask, readCandidatureStore, saveMobileOffer, startMobileTask, updateMobileJob, type MobileTask } from "@/lib/mobile-engine";
import { dashboardFor, APPLICATION_STATUSES, DISCOVERY_OFFER_LIMIT, stageOf, topDiscoveryOffers } from "@/lib/mobile-domain.mjs";
import { readReport, readApplications, careerOpsRoot } from "@/lib/career-ops";
import { currentCandidateVersion, currentAnalysis, decideCvDraft, saveCanonicalCv } from "@/lib/mobile-history";
import { discoveryProjection, withProfileLock, persistedJobEvaluation, contractMatches } from "@/lib/mobile-state.mjs";
import { taskView,estimateView } from "@/lib/mobile-view";
import {localizeDisplay} from "@/lib/display-localization";
import {requestUiLocale,applicationLanguage,documentLanguage,publicError} from "@/lib/language-contract.mjs";
import {reportForDisplay} from "@/lib/localization-core.mjs";
import { FLOW_DEFAULTS, historicalEstimate } from "@/lib/ai-metrics.mjs";
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
      return Response.json(await localizeDisplay(profileId,locale,{...job,stage:stageOf(job.status),evaluationState:persistedJobEvaluation(job)?"evaluated":"discovered"},"job",{...localizationOptions,identity:job.id}),{headers:{"Cache-Control":"no-store"}});
    }
    if(url.searchParams.has("reportJobId")) {
      const job=readCandidatureStore(profileId).jobs.find(j=>j.id===url.searchParams.get("reportJobId"));
      if(!job?.reportNum || !readApplications(profileId).some(a=>String(a.n)===String(job.reportNum))) return Response.json({error:publicError("Rapport introuvable pour ce profil.",locale)},{status:404});
      const report=readReport(String(job.reportNum));
      if(!report) return Response.json({error:publicError("Rapport introuvable.",locale)},{status:404});
      return Response.json(await localizeDisplay(profileId,locale,{markdown:reportForDisplay(report.content)},"report",{...localizationOptions,identity:`report:${job.reportNum}`}),{headers:{"Cache-Control":"no-store"}});
    }
    // Existing route reconciles official reports into the rich cockpit.
    let store = readCandidatureStore(profileId);
    if (fs.existsSync(profileFile(profileId, "candidatures"))) store = await (await coreRequest(profileId, `/api/candidatures?profileId=${encodeURIComponent(profileId)}`)).json();
    const read = (kind: "cv" | "config") => { try { return fs.readFileSync(profileFile(profileId, kind), "utf8"); } catch { return ""; } };
    const config = yaml.load(read("config")) as Record<string, unknown> | null;
    const {version,tasks} = await withProfileLock(mobileDirectory(profileId),()=>{
      const version=currentCandidateVersion(profileId);
      return {version,tasks:prepareTaskHistory(profileId,version)};
    });
    const restricted = (await headers()).get("x-jobpilot-profiles")?.split(",");
    const profiles = listProfiles().filter(p => !restricted || restricted.includes(p.id)).map(({ id, name, shortName }) => ({ id, name, shortName }));
    const latest = (kind: string) => tasks.find((t:MobileTask) => t.kind === kind && t.status === "completed");
    const snapshot={
      version: "0.3.2", profile: { id: profileId, name: getProfile(profileId).name }, profiles,
      cv: read("cv"), cvState:{versionId:version.id,cvVersion:version.cvVersion,revision:version.revision,changedAt:version.createdAt},
      languageSettings:{uiLocale:locale,applicationLanguage:applicationLanguage(config || {},read("cv")),documentLanguage:documentLanguage(version)},
      config: config || {}, jobs: store.jobs.map(j=>({...j,stage:stageOf(j.status),evaluationState:persistedJobEvaluation(j)?"evaluated":"discovered"})), dashboard: dashboardFor(store.jobs), statuses: APPLICATION_STATUSES,
      tasks: tasks.slice(0,60).map((t:MobileTask)=>taskView(t,store.jobs,false,locale)),
      analysis: currentAnalysis(profileId,version,tasks),
      discovery: (()=>{const result=discoveryProjection(tasks.find((t:MobileTask)=>t.kind==="search" && t.result?.offers)?.result || null,store.jobs,tasks);const eligible=result.offers.filter((o:any)=>contractMatches(o,(config as any)?.target_roles?.contract_types || []).matches);return {...result,offers:topDiscoveryOffers(eligible),displayLimit:DISCOVERY_OFFER_LIMIT,availableCount:eligible.length};})(),
      flowEstimates:Object.fromEntries(Object.entries(FLOW_DEFAULTS).map(([kind,choice])=>[kind,estimateView(historicalEstimate(tasks,kind,choice.model,choice.reasoning),locale)])),
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
    const locale=requestUiLocale(req,body.input?.uiLocale || body.input?.language);
    if (body.action === "task") {
      const task = await startMobileTask(profileId, {...body.input,uiLocale:locale});
      const view=taskView(task,readCandidatureStore(profileId).jobs,true,locale);
      if(view.result && task.kind!=="ingest")view.result=await localizeDisplay(profileId,locale,view.result,"result",{identity:task.id});
      return Response.json(view, { status: task.status === "completed" ? 200 : 202 });
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
    return Response.json({ error: publicError("Action inconnue.",locale) }, { status: 400 });
  } catch (e) { console.error("mobile action failed",e);return Response.json({ error: publicError(e,requestUiLocale(req)) }, { status: 400 }); }
}
