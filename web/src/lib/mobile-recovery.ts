import {parseOrientation} from "@/lib/v1-journey.mjs";
import fs from "node:fs";
import path from "node:path";
import { listMobileTasks, mobileDirectory, type MobileTask } from "@/lib/mobile-engine";
import { readCandidatureStore, writeCandidatureStore } from "@/lib/candidatures";
import { observeAgentDockRun } from "@/lib/agentdock-acp";
import { extractJsonObject } from "@/lib/model-json.mjs";
import { parseDiscoveredOffers } from "@/lib/mobile-domain.mjs";
import { findPersistedEvaluation } from "@/lib/evaluation-state";
import { withProfileLock, processAlive, writeJson, readJson, loadCandidateVersion } from "@/lib/mobile-state.mjs";
import { readCodexUsage, readCodexFinalAnswer, apiEquivalent } from "@/lib/ai-metrics.mjs";
import {parseAnalysisResult} from "@/lib/analysis-result.mjs";
import {preservePresentationLanguage} from "@/lib/cv-global-plan.mjs";
import {rankSearchResults} from "@/lib/job-search/index.mjs";
import {searchRequestFromConfig} from "@/lib/job-search/mobile-context.mjs";
import * as yaml from "js-yaml";
const host=globalThis as typeof globalThis & {jobPilotRecovery?:Map<string,number>};
const last=host.jobPilotRecovery??=new Map();
/** Reconciliation only. Never starts a new agent or changes another profile. */
export async function reconcileMobileTasks(profileId:string) {
  const directory=mobileDirectory(profileId);
  for(const task of listMobileTasks(profileId)) {
    if(!["queued","running","reconciling"].includes(task.status) || processAlive(task.ownerPid) || processAlive(task.workerPid))continue;
    const key=profileId+":"+task.id;
    if(Date.now()-(last.get(key)||0)<15000)continue;
    last.set(key,Date.now());
    if(!task.runId)continue; // Ambiguous crash before acknowledgement: do not guess it is safe to relaunch.
    try {
      const run=await observeAgentDockRun(task.runId);
      if(["running","queued"].includes(run.status))continue;
      const final=run.status==="completed"?readCodexFinalAnswer(task.remoteSessionId,task.createdAt):null;
      if(final){run.text=final;run.completeHistory=true;}
      if(!run.completeHistory)continue;
      await withProfileLock(directory,()=>{
        const file=path.join(directory,"tasks",task.id+".json");
        const current=readJson(file) as MobileTask;
        if(current.status === "completed")return;
        let result:Record<string,any>|null=null;
        if(task.kind === "evaluate") result=findPersistedEvaluation(profileId,String(task.input.url));
        else if(run.status === "completed" && task.kind === "search") {
          const version=loadCandidateVersion(directory,task.inputVersionId);
          const request=searchRequestFromConfig(String(task.input.query || ""),(yaml.load(version.sources.config.text) || {}) as Record<string,unknown>,readCandidatureStore(profileId).jobs.map(j=>j.url));
          const existing=Array.isArray(task.result?.offers)?task.result.offers:[];
          const previousMetrics=(task.result?.searchMetrics || {}) as Record<string,unknown>;
          const ranked=rankSearchResults(request,[...existing,...parseDiscoveredOffers(run.text)]);
          result={offers:ranked.offers,searchedAt:run.endedAt,contractTypes:request.contractTypes,searchMetrics:{...previousMetrics,...ranked.metrics},recovered:true};
        }
        else if(run.status === "completed" && ["analysis","coach","compare","practice","plan"].includes(task.kind)) {
          let object:Record<string,any>|null=null;
          if(task.kind==="analysis") {
            try{object=task.input.experience==="v1" ? parseOrientation(extractJsonObject(run.text).obj,loadCandidateVersion(directory,task.inputVersionId).sources.cv.text) : preservePresentationLanguage(parseAnalysisResult(run.text),loadCandidateVersion(directory,task.inputVersionId),String(task.input.language || "fr"));}
            catch(error){current.status="failed";current.error=String(error);current.updatedAt=new Date().toISOString();writeJson(file,current);return;}
          }else {const parsed=extractJsonObject(run.text);object=parsed.truncated?null:parsed.obj as Record<string,any>|null;}
          if(object?.markdown)result=object;
        }
        const usage=readCodexUsage(task.remoteSessionId,task.createdAt);
        const ended=Date.parse(String(run.endedAt)) || Date.now();
        current.metrics={...current.metrics,...usage,...apiEquivalent(current.metrics?.model,usage),wallMs:ended-Date.parse(task.createdAt),agentMs:ended-(Date.parse(String(run.startedAt))||Date.parse(task.createdAt))};
        if(result) {
          current.status="completed";current.result=result;current.completedAt=new Date(ended).toISOString();current.phase="Résultat retrouvé après redémarrage";
          if(task.kind === "plan" && task.input.jobId) {
            const store=readCandidatureStore(profileId),job=store.jobs.find(j=>j.id===task.input.jobId);
            if(job){job.mobilePlan={...result,taskId:task.id,generatedAt:current.completedAt};writeCandidatureStore(profileId,store);}
          }
        } else if(task.kind === "cv" && run.status === "completed") {
          const object=extractJsonObject(run.text).obj as Record<string,any>|null;
          if(object?.summary && Array.isArray(object.experience)) {
            writeJson(path.join(directory,"cv-generations",String(task.inputVersionId),encodeURIComponent(String(task.input.jobId))+".json"),{operationKey:task.operationKey,profileId,jobId:task.input.jobId,inputVersionId:task.inputVersionId,output:run.text,metrics:current.metrics,createdAt:task.createdAt});
            current.status="failed";current.error="Le contenu est enregistré. Réessayez pour terminer la mise en page sans nouvel appel IA.";
          } else {current.status="failed";current.error="Le traitement terminé n’a pas fourni de résultat exploitable.";}
        } else {current.status="failed";current.error=run.error || "Le traitement précédent s’est terminé sans résultat enregistré. Une relance explicite est nécessaire.";}
        current.updatedAt=new Date().toISOString();writeJson(file,current);
      });
    } catch { /* An unavailable observer is not evidence that the agent stopped. Keep the claim. */ }
  }
}
