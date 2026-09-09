import { normalizeUrl } from "@/lib/core/url-key.mjs";
import type { MobileTask } from "@/lib/mobile-engine";
import {productText} from "@/lib/localization-core.mjs";
import {choose,publicError} from "@/lib/language-contract.mjs";
export function estimateView(estimate:any,locale:string) {
  if(!estimate)return estimate;
  const min=Number(estimate.minSeconds || 0),max=Number(estimate.maxSeconds || 0);
  if(!min || !max)return {...estimate,label:productText("Habituellement quelques minutes",locale)};
  const label=max < 90
    ? choose(locale,`预计耗时 ${min}–${max} 秒`,`Durée estimée : ${min}–${max} s`,`Estimated time: ${min}–${max} s`)
    : choose(locale,`预计耗时 ${Math.max(1,Math.floor(min/60))}–${Math.max(1,Math.ceil(max/60))} 分钟`,`Durée estimée : ${Math.max(1,Math.floor(min/60))}–${Math.max(1,Math.ceil(max/60))} min`,`Estimated time: ${Math.max(1,Math.floor(min/60))}–${Math.max(1,Math.ceil(max/60))} min`);
  return {...estimate,label};
}

/** User-facing task projections intentionally exclude raw ACP transcript and internal paths. */
export function taskView(task: MobileTask, jobs: Array<Record<string, any>>, detail = false, locale = "fr") {
  const job = jobs.find(j => j.id === task.input.jobId || j.id === task.result?.jobId
    || (task.kind === "evaluate" && normalizeUrl(j.url) === normalizeUrl(String(task.input.url || ""))));
  const names: Record<string,string> = {analysis:"Analyse du CV et des compétences",search:"Recherche d’opportunités",evaluate:"Évaluation du poste",cv:"CV adapté",rewrite:"Brouillon du CV",plan:"Préparation de l’entretien",practice:"Entraînement à l’entretien",compare:"Comparaison des opportunités",coach:"Conseil de carrière",ingest:"Import du CV"};
  const targets:Record<string,string> = {analysis:"profile-analysis",search:"discovery",evaluate:"job",cv:"job-cv",rewrite:"cv-draft",plan:"training",ingest:"cv-import",practice:"practice",compare:"comparison",coach:"career-advice"};
  const destination = {type:targets[task.kind] || "profile-analysis",jobId:job?.id || null,draftId:task.result?.draftId || null,taskId:task.id};
  const location:Record<string,string> = {analysis:"Dossier → CV et compétences",search:"Opportunités",evaluate:"Candidatures",cv:"Candidatures → CV",rewrite:"Dossier → Brouillon à valider",plan:"Préparation",practice:"Préparation",compare:"Candidatures",coach:"Préparation",ingest:"Dossier → Import à confirmer"};
  const completed=task.status === "completed";
  const title=`${task.kind === "evaluate" && job ? job.company + " · " : ""}${productText(names[task.kind] || "Traitement",locale)}${completed ? " · " + productText("terminé",locale) : ""}`;
  const metrics=task.metrics || (completed ? {wallMs:Math.max(0,Date.parse(task.updatedAt)-Date.parse(task.createdAt)),totalTokens:null,estimatedCostUsd:null,actualCostUsd:null,tokenSource:"unavailable"} : null);
  const safeResult=task.kind === "evaluate" ? {...task.result,jobId:job?.id || null} : task.result;
  return {id:task.id,profileId:task.profileId,kind:task.kind,status:task.status,createdAt:task.createdAt,updatedAt:task.updatedAt,
    phase:completed ? `${choose(locale,"已更新：","Mis à jour : ","Updated: ")}${productText(location[task.kind] || "Dossier",locale)}` : productText(["failed","interrupted"].includes(task.status) ? "Une action est nécessaire" : task.status === "queued" ? "En attente de traitement" : task.status === "reconciling" ? "Vérification du traitement précédent" : "Traitement en cours — vous pouvez continuer à naviguer",locale),
    title,location:productText(location[task.kind] || "Dossier",locale),jobId:job?.id || null,error:task.error ? publicError(task.error,locale) : undefined,metrics,estimate:estimateView(task.estimate,locale),destination,
    reused:task.reused === true,cvVersion:task.cvVersion,inputVersionId:task.inputVersionId,
    ...(detail ? {input:task.input,result:safeResult} : {}),
  };
}
