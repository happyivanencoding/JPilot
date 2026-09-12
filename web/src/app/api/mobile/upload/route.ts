import {normalizeSearchArea} from '@/lib/search-area.mjs';
import {assertCvConsent} from "@/lib/cv-privacy.mjs";
import {profileFile} from "@/lib/profile-context";
import {readJson,writeJson,withProfileLock} from "@/lib/mobile-state.mjs";
import {publicError,requestUiLocale,uiLocale} from "@/lib/language-contract.mjs";
import fs from "node:fs";
import path from "node:path";
import { activeProfileId } from "@/lib/profile-request";
import { mobileDirectory, startMobileTask } from "@/lib/mobile-engine";
import { readCandidatureStore } from "@/lib/candidatures";
import { taskView } from "@/lib/mobile-view";
import { UPLOAD_EXTENSIONS, UPLOAD_LIMIT } from "@/lib/mobile-domain.mjs";
import { workspaceRoot } from "@/lib/backend/workspace";
import { recordAnalytics } from "@/lib/product-analytics.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  let directory: string | undefined;
  try {
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > UPLOAD_LIMIT + 65536) return Response.json({ error: publicError(new Error("12 MB maximum"),requestUiLocale(req)) }, { status: 413 });
    const profileId = await activeProfileId(new URL(req.url).searchParams.get("profileId"));
    if(process.env.JOBPILOT_V1_PREVIEW === "1") {
      try {assertCvConsent(mobileDirectory(profileId));} catch(e) {return Response.json({error:e instanceof Error?e.message:String(e)},{status:428});}
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Sélectionnez un document.");
    const analyticsSessionId=String(form.get("analyticsSessionId")||"");
    const analyticsEventId=String(form.get("analyticsEventId")||"");
    if(analyticsSessionId&&analyticsEventId){
      try{await recordAnalytics(workspaceRoot(),profileId,{events:[{id:analyticsEventId,sessionId:analyticsSessionId,timestamp:Date.now(),event:"funnel",page:"onboarding_upload",step:"upload_cv"}]});}catch{/* Telemetry never blocks an upload. */}
    }
    const extension = path.extname(file.name).toLowerCase();
    if (!UPLOAD_EXTENSIONS.has(extension)) throw new Error("Formats acceptés : PDF, DOCX, TXT, MD.");
    if (file.size > UPLOAD_LIMIT || !file.size) throw new Error("Document vide ou supérieur à 12 Mo.");
    const uploadRoot = path.join(mobileDirectory(profileId), "uploads");
    fs.mkdirSync(uploadRoot, { recursive: true });
    directory = fs.mkdtempSync(path.join(uploadRoot, "cv-"));
    const destination = path.join(directory, "source" + extension);
    fs.writeFileSync(destination, Buffer.from(await file.arrayBuffer()));
    const autoImport=process.env.JOBPILOT_V1_PREVIEW === "1";
    const rawArea=form.get("searchArea");
    const searchArea=rawArea?normalizeSearchArea(JSON.parse(String(rawArea))):undefined;
    const rawContracts=form.get("contractTypes");
    const contractTypes=rawContracts==null ? undefined : JSON.parse(String(rawContracts));
    if(contractTypes!==undefined && (!Array.isArray(contractTypes) || !contractTypes.length || contractTypes.some((type:unknown)=>!['Stage','Alternance','CDI','CDD'].includes(String(type))))) throw new Error("Choisissez au moins un type de contrat.");
    if(autoImport && !fs.readFileSync(profileFile(profileId,"cv"),"utf8").trim() && !contractTypes?.length) throw new Error("Choisissez au moins un type de contrat avant votre CV.");
    const applicationLanguage=String(form.get("applicationLanguage")||"");
    if(applicationLanguage!=="fr" && applicationLanguage!=="en") throw new Error("Invalid application language");
    const analysisLanguage=uiLocale(form.get("analysisLanguage") || requestUiLocale(req));
    const task = await startMobileTask(profileId, {kind:"ingest",filename:path.basename(file.name),uiLocale:requestUiLocale(req),autoImport,applicationLanguage,analysisLanguage,contractTypes,searchArea,silent:autoImport}, destination);
    if(autoImport) await withProfileLock(mobileDirectory(profileId),()=>writeJson(path.join(mobileDirectory(profileId),"journey.json"),{completed:false,ingestTaskId:task.id,query:"",searchTaskId:null}));
    if(task.reused && directory) fs.rmSync(directory,{recursive:true,force:true});
    return Response.json(taskView(task,readCandidatureStore(profileId).jobs,true,requestUiLocale(req)), { status: task.status === "completed" ? 200 : 202 });
  } catch (error) {
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
    return Response.json({ error: publicError(error,requestUiLocale(req)) }, { status: 400 });
  }
}
