import {normalizeSearchArea} from '@/lib/search-area.mjs';
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import * as yaml from "js-yaml";
import { renderReferenceCv } from "@/lib/backend/cv-document.mjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { workspaceRoot } from "@/lib/backend/workspace";
import { getProfile, profileFile } from "@/lib/profile-context";
import { atomicWriteWithBackup } from "@/lib/backend/files.mjs";
import {compileGlobalPlan,globalPlanView,preservePresentationLanguage} from "@/lib/cv-global-plan.mjs";
import {detectedDocumentLanguage, documentLanguage,contradictsDocumentLanguage} from "@/lib/language-contract.mjs";
import { candidateVersion, loadCandidateVersion, readJson, writeJson, withProfileLock, resolvedIssues, normalizeAnalysis, applyEvidenceEdits } from "@/lib/mobile-state.mjs";

export function historyDirectory(profileId: string) {
  const profile=getProfile(profileId);
  if(profile.id!==profileId) throw new Error("Profil inconnu.");
  return path.join(workspaceRoot(), ".career-ops-web", "profiles", profile.id, "mobile");
}
export function currentCandidateVersion(profileId: string): Record<string, any> {
  const sources: Record<string, any> = {};
  for (const kind of ["cv","config","notes"] as const) {
    const file = profileFile(profileId, kind);
    sources[kind] = fs.existsSync(file) ? { text: fs.readFileSync(file,"utf8"), modifiedMs: fs.statSync(file).mtimeMs } : { text:"", modifiedMs:0 };
  }
  return candidateVersion(historyDirectory(profileId), sources);
}
export function candidateEvidenceFiles(profileId: string, versionId: string) {
  const state=loadCandidateVersion(historyDirectory(profileId),versionId);
  const directory=path.join(historyDirectory(profileId),"cv-history",versionId);
  fs.mkdirSync(directory,{recursive:true});
  const files={cv:"cv.md",config:"profile.yml",notes:"_profile.md"};
  for(const [kind,name] of Object.entries(files)) {
    const file=path.join(directory,name);
    if(!fs.existsSync(file)) fs.writeFileSync(file,state.sources[kind].text,"utf8");
  }
  return Object.fromEntries(Object.entries(files).map(([kind,name])=>[kind,path.relative(workspaceRoot(),path.join(directory,name)).replaceAll("\\","/")])) as Record<"cv"|"config"|"notes",string>;
}
export function currentAnalysis(profileId: string, version: Record<string, any>, tasks: Array<Record<string, any>>) {
  const completed = tasks.filter(t => t.kind === "analysis" && t.status === "completed" && t.result?.markdown);
  const task = completed.find(t => t.inputVersionId === version.id) || completed[0];
  if (!task) return null;
  const sourceVersion=task.inputVersionId ? loadCandidateVersion(historyDirectory(profileId),task.inputVersionId) : version;
  const safe=preservePresentationLanguage(task.result,sourceVersion,task.input.uiLocale || task.input.language || 'fr');
  return { ...normalizeAnalysis(safe, task.id, version.sources.cv.text, resolvedIssues(historyDirectory(profileId))),
    outputLocale:task.input.uiLocale || task.input.language || 'fr',
    taskId: task.id, inputVersionId: task.inputVersionId || null, cvVersion: task.cvVersion || null,
    stale: task.inputVersionId !== version.id, createdAt: task.createdAt,
    globalLayout:globalPlanView(safe.globalPlan,task.inputVersionId ? loadCandidateVersion(historyDirectory(profileId),task.inputVersionId).sources.cv.text : version.sources.cv.text),
    history: completed.slice(0,10).map(t => ({ taskId:t.id, cvVersion:t.cvVersion || null, createdAt:t.createdAt, changeSummary:t.result.changeSummary || "" })),
  };
}
export function analysisContinuity(profileId: string, tasks: Array<Record<string, any>>) {
  const task = tasks.find(t => t.kind === "analysis" && t.status === "completed" && t.result?.markdown);
  if (!task) return null;
  let previousCv: string | null = null;
  if (task.inputVersionId) previousCv = loadCandidateVersion(historyDirectory(profileId), task.inputVersionId).sources.cv.text;
  return { taskId: task.id, previousCv, analysis: normalizeAnalysis(task.result,task.id,previousCv || "",[]),
    note: previousCv === null ? "La version historique exacte du CV n’était pas enregistrée. Ne pas inventer une comparaison textuelle." : "Comparer explicitement avec cette version enregistrée." };
}
export async function saveCanonicalCv(profileId: string, content: string, expectedVersionId?: string) {
  return withProfileLock(historyDirectory(profileId), () => {
    const before = currentCandidateVersion(profileId);
    if (expectedVersionId && before.id !== expectedVersionId) throw new Error("Le CV a changé sur un autre écran. Rechargez avant de sauvegarder.");
    if (before.sources.cv.text === content) return { ok:true, changed:false, versionId:before.id, cvVersion:before.cvVersion };
    atomicWriteWithBackup(profileFile(profileId,"cv"), content);
    const after = currentCandidateVersion(profileId);
    return { ok:true, changed:true, versionId:after.id, cvVersion:after.cvVersion };
  });
}
function draftFile(profileId: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Brouillon invalide.");
  return path.join(historyDirectory(profileId),"cv-drafts",id+".json");
}
export function readCvDraft(profileId: string, id: string): Record<string, any> {
  const draft = readJson(draftFile(profileId,id));
  if (!draft || draft.profileId !== profileId) throw new Error("Brouillon introuvable pour ce profil.");
  return draft;
}
export function createCvDraft(profileId: string, version: Record<string, any>, analysis: Record<string, any>, ids: string[]) {
  const global=ids.includes("global-plan");
  if(analysis.globalPlan && !global) throw new Error("Ce CV dispose d’un plan d’ensemble. Appliquez le plan coordonné, pas des expansions isolées.");
  if(global) {
    const compiled=compileGlobalPlan(analysis.globalPlan,version.sources.cv.text);
    if(!compiled.applicable) throw new Error(compiled.issues.join(" "));
    if(contradictsDocumentLanguage(compiled.content,documentLanguage(version),version.sources.cv.text)) throw new Error('CV language mismatch; original preserved.');
    const draft={id:randomUUID(),profileId,documentLanguage:documentLanguage(version),status:"pending",baseVersionId:version.id,sourceAnalysisId:analysis.taskId,
      issueIds:[`global-plan-${analysis.taskId}`,...analysis.expressionIssues.filter((i:any)=>i.after && compiled.content.includes(i.after) && !compiled.content.includes(i.before)).map((i:any)=>i.id)],edits:compiled.changes,content:compiled.content,
      globalPlan:true,layoutBudget:compiled.budget,beforeBudget:compiled.beforeBudget,createdAt:new Date().toISOString()};
    writeJson(draftFile(profileId,draft.id),draft);return draft;
  }
  const issues = analysis.expressionIssues.filter((i: any) => ids.includes(i.id));
  if (issues.length !== new Set(ids).size) throw new Error("Suggestion inconnue dans l’analyse actuelle.");
  if(issues.some((i:any)=>contradictsDocumentLanguage(i.after,documentLanguage(version),i.before))) throw new Error('CV language mismatch; original preserved.');
  const content = applyEvidenceEdits(version.sources.cv.text, issues, ["cv","config","notes"].map(k=>version.sources[k].text).join("\n"));
  const draft = { id:randomUUID(), profileId, status:"pending", baseVersionId:version.id, sourceAnalysisId:analysis.taskId,
    issueIds:issues.map((i: any)=>i.id), edits:issues, content, createdAt:new Date().toISOString() };
  writeJson(draftFile(profileId,draft.id),draft);
  return draft;
}
export async function decideCvDraft(profileId: string, id: string, decision: string) {
  if (!["accept","reject"].includes(decision)) throw new Error("Décision invalide.");
  const pending=readCvDraft(profileId,id);
  if(decision === "accept" && pending.status === "pending" && pending.globalPlan) {
    const rendered=await renderCvPreview(profileId,id);
    if(!rendered.layout?.acceptable) throw new Error("Ce plan dépasse le budget de lecture. Le CV original reste inchangé ; la police ne sera pas réduite.");
  }
  return withProfileLock(historyDirectory(profileId), () => {
    const draft = readCvDraft(profileId,id);
    if (draft.status !== "pending") {
      if ((decision === "accept" && draft.status === "accepted") || (decision === "reject" && draft.status === "rejected")) return {ok:true,draft,reused:true};
      throw new Error("Ce brouillon a déjà fait l’objet d’une décision.");
    }
    if (decision === "reject") {
      if(draft.accepting && fs.readFileSync(profileFile(profileId,"cv"),"utf8") === draft.content) throw new Error("L’acceptation a déjà enregistré ce CV. Reprenez la confirmation pour terminer l’historique.");
      draft.status="rejected";draft.decidedAt=new Date().toISOString();writeJson(draftFile(profileId,id),draft);
      return {ok:true,draft,canonicalChanged:false};
    }
    const before = currentCandidateVersion(profileId);
    const base = loadCandidateVersion(historyDirectory(profileId),draft.baseVersionId);
    const finishingInterruptedAccept = draft.accepting === true && before.sources.cv.text === draft.content
      && ["config","notes"].every(k=>before.sources[k].text === base.sources[k].text);
    if (before.id !== draft.baseVersionId && !finishingInterruptedAccept) throw new Error("Le CV ou ses preuves ont changé depuis ce brouillon. Il ne peut pas remplacer la nouvelle version.");
    // Journal first, then canonical write: a repeated accept can finish an interrupted commit.
    draft.accepting=true;writeJson(draftFile(profileId,id),draft);
    if (!finishingInterruptedAccept) atomicWriteWithBackup(profileFile(profileId,"cv"),draft.content);
    const after = currentCandidateVersion(profileId);
    const indexFile = path.join(historyDirectory(profileId),"cv-history/index.json");
    const index = readJson(indexFile);
    const at = new Date().toISOString();
    const existingIds = new Set((index.resolutions || []).filter((r:any)=>r.draftId === id).map((r:any)=>r.issueId));
    const added = draft.issueIds.filter((issueId:string)=>!existingIds.has(issueId)).map((issueId:string)=>({issueId,analysisTaskId:draft.sourceAnalysisId,draftId:id,resolvedAt:at,fromVersion:base.id,toVersion:after.id,before:draft.edits.find((e:any)=>e.id===issueId)?.before,after:draft.edits.find((e:any)=>e.id===issueId)?.after}));
    writeJson(indexFile,{...index,resolutions:[...(index.resolutions||[]),...added]});
    draft.status="accepted";draft.accepting=false;draft.decidedAt=at;draft.acceptedVersionId=after.id;
    writeJson(draftFile(profileId,id),draft);
    return {ok:true,draft,canonicalChanged:true,cvVersion:after.cvVersion};
  });
}
export async function renderCvPreview(profileId: string, draftId?: string, versionId?: string) {
  const directory=historyDirectory(profileId);
  const draft = draftId ? readCvDraft(profileId,draftId) : null;
  const version = versionId ? loadCandidateVersion(directory,versionId) : await withProfileLock(directory,()=>currentCandidateVersion(profileId));
  const id = draft ? `layout6-draft-${draft.id}` : `layout7-version-${version.id}`;
  const folder=path.join(directory,"cv-previews",id);
  const pdf=path.join(folder,"cv.pdf"), meta=path.join(folder,"render.json");
  if (!fs.existsSync(pdf) || !fs.existsSync(meta)) {
    fs.mkdirSync(folder,{recursive:true});
    let layoutSource=null;
    const professional=process.env.JOBPILOT_V1_PREVIEW==="1" && !draft;
    if(professional) {
      const taskFolder=path.join(directory,"tasks");
      const imports=fs.existsSync(taskFolder)?fs.readdirSync(taskFolder).filter(name=>name.endsWith(".json")).map(name=>readJson(path.join(taskFolder,name))).filter(task=>task?.kind==="ingest"&&task?.status==="completed"&&task.result?.versionId&&task.uploadSource?.endsWith(".pdf")&&fs.existsSync(task.uploadSource)):[];
      const source=imports.find(task=>loadCandidateVersion(directory,task.result.versionId).sources.cv.text===version.sources.cv.text);
      if(source){
        const out=await promisify(execFile)(process.env.JOBPILOT_PYTHON || "python",[path.resolve(process.cwd(),"scripts/cv-layout.py"),source.uploadSource],{timeout:30000,encoding:"utf8",maxBuffer:1024*1024,env:{...process.env,PYTHONIOENCODING:"utf-8"}});
        layoutSource=JSON.parse(out.stdout);
      }
    }
    await renderReferenceCv({content:draft?.content || version.sources.cv.text,language:draft?.documentLanguage || documentLanguage(version),globalPlan:!!draft?.globalPlan,professional,layoutSource},folder);
  }
  return { pdf, ...readJson(meta), draft, versionId:version.id, cvVersion:version.cvVersion };
}

export async function saveImportedCv(profileId:string, content:string, expectedVersionId:string, sourceLanguage:string, analysisLanguage:string, contractTypes?:string[], searchArea?:Record<string,unknown>) {
  return withProfileLock(historyDirectory(profileId),()=>{
    const before=currentCandidateVersion(profileId);
    if(before.id!==expectedVersionId) throw new Error("Le CV a changé. Réessayez avec votre nouveau fichier.");
    const config=(yaml.load(fs.readFileSync(profileFile(profileId,"config"),"utf8")) || {}) as any;
    const detected=detectedDocumentLanguage(content);
    const explicit=["en","fr"].includes(sourceLanguage)?sourceLanguage:null;
    const material=explicit || detected || (["en","fr"].includes(config.cv?.language)?config.cv.language:"en");
    config.cv={...config.cv,language:material,source_language:detected || explicit || material};
    config.display={...config.display,analysis_language:analysisLanguage};
    if(searchArea)config.target_roles={...config.target_roles,search_area:normalizeSearchArea(searchArea)};
    if(contractTypes?.length) config.target_roles={...config.target_roles,contract_types:[...new Set(contractTypes)],contract_policy:"confirmed_only"};
    atomicWriteWithBackup(profileFile(profileId,"config"),yaml.dump(config));
    if(before.sources.cv.text!==content) atomicWriteWithBackup(profileFile(profileId,"cv"),content);
    const after=currentCandidateVersion(profileId);
    return {imported:true,versionId:after.id,cvVersion:after.cvVersion};
  });
}
