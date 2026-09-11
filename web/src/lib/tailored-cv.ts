import {reusablePreparedCv} from '@/lib/onward-cv.mjs';
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {roleCvReviewPrompt,normalizeRoleCvReview} from "@/lib/v1-cv-review.mjs";
import {projectV1JobScores} from "@/lib/v1-match.mjs";
import { renderTailoredCv } from "@/lib/backend/cv-document.mjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as yaml from "js-yaml";
import { workspaceRoot } from "@/lib/backend/workspace";
import { activeProfileId } from "@/lib/profile-request";
import { getProfile, profileFile } from "@/lib/profile-context";
import { runModelTransport } from "@/lib/model-transport";
import { extractJsonObject } from "@/lib/model-json.mjs";
import { atomicWrite } from "@/lib/backend/files.mjs";
import { currentCandidateVersion, historyDirectory, renderCvPreview } from "@/lib/mobile-history";
import { withProfileLock, loadCandidateVersion, operationKey, readJson, writeJson } from "@/lib/mobile-state.mjs";
import { FLOW_DEFAULTS } from "@/lib/ai-metrics.mjs";
import {applicationLanguage,requestUiLocale,explanationDirective,contradictsDocumentLanguage,choose} from "@/lib/language-contract.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 420;



type CvInfo = {
  language?: string;
  notesLocale?: string;
  label?: string;
  pdfCompany?: string;
  file?: string;
  pages?: number;
  atsScore?: number;
  keywordCoverage?: number | null;
  generatedAt?: string;
  changes?: string[];
  keywords?: string[];
  inputVersionId?: string;
  presentationScore?: number | null;
  baselinePresentationScore?: number | null;
  presentationDelta?: number | null;
  draftId?: string;
  matchBasis?: Record<string,any>;
};

type Job = {
  id: string;
  company: string;
  role: string;
  location?: string;
  score?: number;
  summary?: string;
  angle?: string;
  strengths?: string[];
  gaps?: unknown[];
  match?: unknown[];
  cv?: CvInfo;
  status?: string;
  prepTasks?: Array<{ id: string; label: string; done: boolean }>;
  [key: string]: unknown;
};

type Store = { candidate: string; updatedAt: string; jobs: Job[] };

export type TailoredPayload = {
  summary?: string;
  experience?: Array<{company?:string;role?:string;location?:string;dates?:string;bullets?:string[]}>;
  projects?: Array<{name?:string;description?:string;tech?:string}>;
  education?: Array<{title?:string;org?:string;year?:string;description?:string}>;
  skills?: Array<{category?:string;items?:string[]}>;
  change_notes?: unknown[];
};

export type TailoredAssessment = {
  scoringVersion?:string; baselineScore:number; draftScore:number; delta:number; summary:string;
  improvements:string[]; remainingGaps:string[]; assessedAt:string; revision:number; needsSubstantiveImprovement:boolean;
};

export type TailoredDraft = {
  matchBasis?:Record<string,any>;
  id:string; status:"pending"|"accepted"|"rejected"; baseVersionId:string; language:string; notesLocale:string; revision:number;
  createdAt:string; updatedAt:string; payload:TailoredPayload; file:string; htmlFile:string; pages:number; atsScore:number; atsPass:boolean;
  atsGrade?:string; atsIssues:Array<{severity?:string;message?:string}>; keywordCoverage:number|null; changes:string[]; baselinePresentationScore?:number|null; assessment?:TailoredAssessment|null;
};

function slug(value: string, fallback = "cv") {
  return (String(value).toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-").slice(0, 72) || fallback;
}

function readStore(profileId: string): Store {
  return JSON.parse(fs.readFileSync(profileFile(profileId, "candidatures"), "utf8")) as Store;
}

function readProfileConfig(profileId: string, content?: string): Record<string, unknown> {
  try {
    const parsed = yaml.load(content ?? fs.readFileSync(profileFile(profileId, "config"), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function profileCvOptions(profileId: string, content?: string) {
  const config = readProfileConfig(profileId,content);
  const cv = config.cv && typeof config.cv === "object" && !Array.isArray(config.cv) ? (config.cv as Record<string, unknown>) : {};
  const language = config.language && typeof config.language === "object" && !Array.isArray(config.language)
    ? (config.language as Record<string, unknown>)
    : {};
  return {
    template: typeof cv.template === "string" && cv.template.trim() ? cv.template.trim() : "standard",
    preferredPages: typeof cv.preferred_pages === "number" && cv.preferred_pages > 0 ? Math.floor(cv.preferred_pages) : 1,
    language: applicationLanguage(config,fs.readFileSync(profileFile(profileId,"cv"),"utf8")),
  };
}

function todayLocal() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function cleanArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
}

export function tailoredJobContext(job: Job) {
  return {
    company: job.company,
    role: job.role,
    location: job.location,
    fit_score: job.score,
    summary: job.summary,
    application_angle: job.angle,
    strengths: job.strengths,
    gaps: job.gaps,
    requirement_matches: job.match,
    requested_keywords: job.cv?.keywords ?? [],
    planned_changes: job.cv?.changes ?? [],
    posting_description: boundedText(job.sourceDescription || job.description, 18_000),
    v1_match: job.v1Match ? {
      current_score: (job.v1Match as any).currentScore,
      cv_potential_score: (job.v1Match as any).cvPotentialScore,
      role_summary: (job.v1Match as any).deepMatch?.roleSummary,
      responsibilities: (job.v1Match as any).deepMatch?.responsibilities,
      requirements: (job.v1Match as any).deepMatch?.requirements,
      tools: (job.v1Match as any).deepMatch?.tools,
      strengths: (job.v1Match as any).deepMatch?.strengths,
      presentation_gaps: (job.v1Match as any).deepMatch?.presentationGaps,
      capability_gaps: (job.v1Match as any).deepMatch?.capabilityGaps,
    } : null,
  };
}

function buildPrompt(profileId: string, job: Job, version: Record<string,any>, uiLocale: string, material: string) {
  const p = getProfile(profileId);
  const cvOptions = {...profileCvOptions(profileId),language:material};
  const target = tailoredJobContext(job);
  return `You are producing the CONTENT for a CV tailored to one concrete job. This is a real application for ${p.name}; accuracy matters more than keyword coverage.

CANDIDATE EVIDENCE IS EMBEDDED BELOW. Do not read files or use tools.

MASTER CV / EVIDENCE BASE:
${version.sources.cv.text}

CANDIDATE CONFIGURATION:
${version.sources.config.text}

CANDIDATE POSITIONING / CV SELECTION RULES:
${version.sources.notes.text}

The Master CV is deliberately comprehensive. It is NOT a request to put every historical experience on the sent CV. Follow the candidate-specific selection and positioning rules in the notes file. Prefer recent, direct evidence; use older or adjacent evidence only when it materially strengthens this job. Never turn an adjacent experience into direct experience, and never invent a missing skill, metric, employer, responsibility or credential. Never add or imply willingness to relocate, a different availability/start date, work authorization, contact details, a higher language level, or a changed location preference unless that fact is explicitly documented in the candidate evidence. If the job location differs from the documented preference, do not invent a relocation claim.

TARGET JOB ANALYSIS (this is the authoritative job-specific context already prepared by career-ops):
${JSON.stringify(target, null, 2)}

LANGUAGE: every candidate-facing CV field (summary, experience, project, education and skills) MUST be written in ${cvOptions.language}. Only change_notes are user-facing explanations, in ${uiLocale}. ${explanationDirective(uiLocale)}

CONTENT BUDGET — respect the configured ${cvOptions.preferredPages}-page target and keep the CV compact:
- Summary: direct and role-specific. No generic enthusiasm. Never put missing skills, negative self-assessments, unproven-ability disclaimers, or analysis instructions into the CV itself. Keep only relevant positive factual content; discuss gaps in change_notes instead.
- Experience: normally 2-4 strongest entries, ordered by relevance. Keep bullets short and evidence-led.
- Projects: 0-2 entries, only when they strengthen this job.
- Education: keep the most useful degrees/programs for this role.
- Skills: compact categories containing only demonstrated skills.
- Do NOT add a photo, cover letter text, references, hobbies or a career objective unless the candidate-specific notes explicitly require it.
- Preserve dates and chronology from the candidate evidence; do not revive conflicting historical wording.

Return ONLY one compact JSON object with this exact shape (no markdown fence, no prose before/after):
{
  "summary": "...",
  "experience": [
    {"company":"...","role":"...","location":"...","dates":"...","bullets":["**Short label:** evidence...","..."]}
  ],
  "projects": [
    {"name":"...","description":"...","tech":"optional short tech string"}
  ],
  "education": [
    {"title":"University / school","org":"City, Country","year":"dates","description":"Degree / program"}
  ],
  "skills": [
    {"category":"IT","items":["Python","SQL"]}
  ],
  "change_notes": ["3-6 concise notes in ${uiLocale} explaining the adaptation"]
}
`;
}

export function floorTailoredPresentationScore(baseline: unknown, rawDraft: unknown) {
  const clamp=(value:unknown)=>Math.max(0,Math.min(100,Math.round(Number(value))));
  const baselineScore=clamp(baseline),rawDraftScore=clamp(rawDraft),draftScore=Math.max(baselineScore,rawDraftScore);
  return {baselineScore,rawDraftScore,draftScore,delta:draftScore-baselineScore,needsSubstantiveImprovement:rawDraftScore<=baselineScore};
}

function boundedText(value: unknown, max = 12_000) { return typeof value === "string" ? value.slice(0,max) : ""; }
function sanitizePayload(value: unknown, fallback?: TailoredPayload): TailoredPayload {
  const input=value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const base=fallback || {};
  const str=(v:unknown,d="")=>typeof v==="string"?v.slice(0,12_000):d;
  const list=(v:unknown,max=20)=>Array.isArray(v)?v.filter(x=>typeof x==="string").map(x=>String(x).slice(0,3000)).slice(0,max):[];
  const experience=Array.isArray(input.experience)?input.experience.slice(0,8).map((raw:any,i)=>({
    company:str(raw?.company,base.experience?.[i]?.company||""),role:str(raw?.role,base.experience?.[i]?.role||""),location:str(raw?.location,base.experience?.[i]?.location||""),dates:str(raw?.dates,base.experience?.[i]?.dates||""),bullets:list(raw?.bullets,12),
  })):base.experience || [];
  const projects=Array.isArray(input.projects)?input.projects.slice(0,6).map((raw:any,i)=>({name:str(raw?.name,base.projects?.[i]?.name||""),description:str(raw?.description,base.projects?.[i]?.description||""),tech:str(raw?.tech,base.projects?.[i]?.tech||"")})):base.projects || [];
  const education=Array.isArray(input.education)?input.education.slice(0,8).map((raw:any,i)=>({title:str(raw?.title,base.education?.[i]?.title||""),org:str(raw?.org,base.education?.[i]?.org||""),year:str(raw?.year,base.education?.[i]?.year||""),description:str(raw?.description,base.education?.[i]?.description||"")})):base.education || [];
  const skills=Array.isArray(input.skills)?input.skills.slice(0,12).map((raw:any,i)=>({category:str(raw?.category,base.skills?.[i]?.category||""),items:list(raw?.items,30)})):base.skills || [];
  return {summary:str(input.summary,base.summary||""),experience,projects,education,skills,change_notes:Array.isArray(input.change_notes)?input.change_notes:base.change_notes||[]};
}

function payloadText(payload: TailoredPayload) {
  const out=[`SUMMARY\n${payload.summary || ""}`];
  if(payload.experience?.length) out.push("EXPERIENCE\n"+payload.experience.map(x=>`${x.company||""} | ${x.role||""} | ${x.location||""} | ${x.dates||""}\n${(x.bullets||[]).map(b=>`- ${b}`).join("\n")}`).join("\n\n"));
  if(payload.projects?.length) out.push("PROJECTS\n"+payload.projects.map(x=>`${x.name||""}\n${x.description||""}\n${x.tech||""}`).join("\n\n"));
  if(payload.education?.length) out.push("EDUCATION\n"+payload.education.map(x=>`${x.title||""} | ${x.org||""} | ${x.year||""}\n${x.description||""}`).join("\n\n"));
  if(payload.skills?.length) out.push("SKILLS\n"+payload.skills.map(x=>`${x.category||"Skills"}: ${(x.items||[]).join(", ")}`).join("\n"));
  return out.join("\n\n").slice(0,45_000);
}

function candidateRenderContext(profileId:string, version:Record<string,any>, material:string) {
  const cvOptions={...profileCvOptions(profileId,version.sources.config.text),language:material};
  const profile=getProfile(profileId),config=readProfileConfig(profileId,version.sources.config.text);
  const candidateConfig=config.candidate && typeof config.candidate === "object" && !Array.isArray(config.candidate) ? config.candidate as Record<string,unknown> : {};
  const linkedinUrl=typeof candidateConfig.linkedin === "string" ? candidateConfig.linkedin.trim() : typeof candidateConfig.linkedin_url === "string" ? candidateConfig.linkedin_url.trim() : "";
  return {cvOptions,candidate:{
    name:typeof candidateConfig.full_name === "string" ? candidateConfig.full_name : profile.name,
    phone:typeof candidateConfig.phone === "string" ? candidateConfig.phone : "",email:typeof candidateConfig.email === "string" ? candidateConfig.email : "",
    linkedin:{url:linkedinUrl,display:linkedinUrl.replace(/^https?:\/\/(?:www\.)?/i,"").replace(/\/$/,"")},location:typeof candidateConfig.location === "string" ? candidateConfig.location : "",photo:"",
  }};
}

async function renderDraftFiles(profileId:string,job:Job,version:Record<string,any>,payload:TailoredPayload,material:string,draftId:string) {
  const root=workspaceRoot(),{cvOptions,candidate}=candidateRenderContext(profileId,version,material);
  const renderPayload={lang:cvOptions.language,page_format:"a4",candidate,sections:{summary:"Professional Summary",competencies:"Core Competencies",experience:"Professional Experience",projects:"Selected Projects",education:"Education",certifications:"Certifications",awards:"Awards & Honors",interests:"Interests",skills:"Skills"},summary:payload.summary,competencies:[],experience:payload.experience||[],projects:payload.projects||[],education:payload.education||[],certifications:[],awards:[],interests:[],skills:payload.skills||[]};
  const outputDir=path.join(root,"output");
  const stem=`cv-draft-${slug(candidate.name,"candidate")}-${slug(job.company,"company")}-${draftId.slice(0,8)}`;
  const htmlPath=path.join(outputDir,stem+".html"),pdfPath=path.join(outputDir,stem+".pdf");
  const rendered=await renderTailoredCv(renderPayload,{htmlPath,pdfPath,language:material,template:cvOptions.template,maxPages:cvOptions.preferredPages,keywords:cleanArray(job.cv?.keywords)});
  return {file:path.relative(root,pdfPath).replaceAll("\\","/"),htmlFile:path.relative(root,htmlPath).replaceAll("\\","/"),...rendered};
}

async function compareCvPresentation(profileId:string,job:Job,version:Record<string,any>,payload:TailoredPayload,locale:string,revision:number,hooks?:{onRun?:(run:any)=>void;onMetrics?:(metrics:any)=>void}) {
  const legacyPrompt=`You are comparing how well TWO CV versions PRESENT the same candidate for ONE job. This is not hiring probability and not a new candidate-fit evaluation. The candidate's real capability is unchanged. Score only how clearly each CV surfaces documented, job-relevant evidence without exaggeration.\n\nUse the exact same 0-100 rubric for both versions: relevance/selection 35, specificity of evidence 30, recruiter scan clarity 20, honest keyword/requirement alignment 15. Do not reward keyword stuffing. Penalize invented or unsupported claims.\n\nReturn ONE JSON object only: {"baseline_score":0,"draft_score":0,"summary":"...","improvements":["..."],"remaining_gaps":["..."]}. Scores are integers 0-100.\n\nJOB DATA:\n${JSON.stringify({company:job.company,role:job.role,location:job.location,summary:job.summary,angle:job.angle,strengths:job.strengths,gaps:job.gaps,match:job.match,description:boundedText(job.sourceDescription||job.description,18000)},null,2)}\n\nMASTER CV:\n${boundedText(version.sources.cv.text,35000)}\n\nTAILORED DRAFT:\n${payloadText(payload)}\n\nOUTPUT LANGUAGE: ${locale}. ${explanationDirective(locale)}`;
  const basis=job.v1Match as Record<string,any>|undefined;
  const prompt=basis ? roleCvReviewPrompt({basis,master:boundedText(version.sources.cv.text,35000),draft:payloadText(payload),job:tailoredJobContext(job),locale}) : legacyPrompt;
  let output="",metrics:any={};
  await runModelTransport({cwd:workspaceRoot(),prompt,model:FLOW_DEFAULTS.cv.model as any,reasoning:FLOW_DEFAULTS.cv.reasoning as any,timeoutMs:180_000,onRun:run=>hooks?.onRun?.(run),onMetrics:m=>{metrics=m;hooks?.onMetrics?.(m);},onText:text=>{output+=text;},onFinalText:complete=>{output=complete;}});
  const parsed=extractJsonObject(output).obj as any;if(!parsed)throw new Error("La comparaison du CV n'a pas renvoyé de résultat structuré.");
  if(basis) {
    const assessment={...normalizeRoleCvReview(basis,parsed),assessedAt:new Date().toISOString(),revision};
    return {assessment,metrics};
  }
  if(!Number.isFinite(Number(parsed.baseline_score))||!Number.isFinite(Number(parsed.draft_score)))throw new Error("Score de présentation du CV invalide.");
  const floored=floorTailoredPresentationScore(parsed.baseline_score,parsed.draft_score);
  const {baselineScore,rawDraftScore,draftScore:effectiveDraftScore,needsSubstantiveImprovement}=floored;
  const summary=needsSubstantiveImprovement
    ? choose(locale,"仅靠调整表达没有进一步提升当前岗位的简历呈现分。当前最佳呈现水平保持不变；下一步需要通过真实经历、技能、语言能力、地点/入职时间适配或其他实质证据来提升，而不是继续润色措辞。","Une reformulation seule n’améliore pas davantage la présentation du CV pour ce poste. Le meilleur niveau actuel reste inchangé ; la prochaine progression doit venir de preuves réelles — expérience, compétences, langue, mobilité/disponibilité ou autres éléments substantiels — plutôt que d’un nouveau polissage du texte.","Wording changes alone do not improve this CV further for the role. The best current presentation score stays unchanged; further gains need real evidence such as experience, skills, language ability, location/start-date fit, or other substantive improvements rather than more rewriting.")
    : String(parsed.summary||"").slice(0,4000);
  const assessment:TailoredAssessment & {rawDraftScore:number}={baselineScore,rawDraftScore,draftScore:effectiveDraftScore,delta:effectiveDraftScore-baselineScore,summary,improvements:needsSubstantiveImprovement?[]:cleanArray(parsed.improvements).slice(0,8),remainingGaps:cleanArray(parsed.remaining_gaps).slice(0,8),assessedAt:new Date().toISOString(),revision,needsSubstantiveImprovement};
  return {assessment,metrics};
}

function findDraft(store:Store,draftId:string) {
  const job=store.jobs.find(item=>(item as any).cvDraft?.id===draftId);if(!job)throw new Error("Brouillon de CV introuvable.");
  return {job,draft:(job as any).cvDraft as TailoredDraft};
}

function writeStore(profileId:string,store:Store) { store.updatedAt=new Date().toISOString();atomicWrite(profileFile(profileId,"candidatures"),`${JSON.stringify(store,null,2)}\n`); }

export async function updateTailoredCvDraft(profileId:string,draftId:string,payload:unknown) {
  const store=readStore(profileId),{job,draft}=findDraft(store,draftId);if(draft.status!=="pending")throw new Error("Ce brouillon a déjà été traité.");
  const version=loadCandidateVersion(historyDirectory(profileId),draft.baseVersionId),next=sanitizePayload(payload,draft.payload);const revision=draft.revision+1;
  const files=await renderDraftFiles(profileId,job,version,next,draft.language,draft.id);
  if(!Number.isFinite(Number(draft.baselinePresentationScore)) && Number.isFinite(Number(draft.assessment?.baselineScore))) draft.baselinePresentationScore=Number(draft.assessment?.baselineScore);
  Object.assign(draft,{...files,payload:next,revision,updatedAt:new Date().toISOString(),assessment:null});writeStore(profileId,store);return draft;
}

export async function reviewTailoredCvDraft(profileId:string,draftId:string,locale:string,hooks?:{onRun?:(run:any)=>void;onMetrics?:(metrics:any)=>void}) {
  const store=readStore(profileId),{job,draft}=findDraft(store,draftId);if(draft.status!=="pending")throw new Error("Ce brouillon a déjà été traité.");
  const version=loadCandidateVersion(historyDirectory(profileId),draft.baseVersionId);const result=await compareCvPresentation(profileId,draft.matchBasis?{...job,v1Match:draft.matchBasis}:job,version,draft.payload,locale,draft.revision,hooks);
  const fixedBaseline=Number(draft.baselinePresentationScore);
  if(Number.isFinite(fixedBaseline)){
    const floored=floorTailoredPresentationScore(fixedBaseline,(result.assessment as any).rawDraftScore ?? result.assessment.draftScore);
    result.assessment.baselineScore=floored.baselineScore;result.assessment.draftScore=floored.draftScore;result.assessment.delta=floored.delta;
    result.assessment.needsSubstantiveImprovement=floored.needsSubstantiveImprovement;
    if(result.assessment.needsSubstantiveImprovement){result.assessment.improvements=[];result.assessment.summary=choose(locale,"仅靠调整表达没有进一步提升当前岗位的简历呈现分。当前最佳呈现水平保持不变；下一步需要通过真实经历、技能、语言能力、地点/入职时间适配或其他实质证据来提升，而不是继续润色措辞。","Une reformulation seule n’améliore pas davantage la présentation du CV pour ce poste. Le meilleur niveau actuel reste inchangé ; la prochaine progression doit venir de preuves réelles — expérience, compétences, langue, mobilité/disponibilité ou autres éléments substantiels — plutôt que d’un nouveau polissage du texte.","Wording changes alone do not improve this CV further for the role. The best current presentation score stays unchanged; further gains need real evidence such as experience, skills, language ability, location/start-date fit, or other substantive improvements rather than more rewriting.");}
  } else draft.baselinePresentationScore=result.assessment.baselineScore;
  draft.assessment=result.assessment;draft.updatedAt=new Date().toISOString();writeStore(profileId,store);return result;
}

export async function decideTailoredCvDraft(profileId:string,draftId:string,decision:string) {
  if(!["accept","reject"].includes(decision))throw new Error("Décision invalide.");
  const store=readStore(profileId),{job,draft}=findDraft(store,draftId);if(draft.status!=="pending")throw new Error("Ce brouillon a déjà été traité.");
  if(job.v1Match) {
    const taskDir=path.join(historyDirectory(profileId),"tasks");
    const tasks=fs.existsSync(taskDir)?fs.readdirSync(taskDir).filter(name=>name.endsWith(".json")).map(name=>readJson(path.join(taskDir,name))).filter(Boolean).sort((a:any,b:any)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)):[];
    job.v1Match=projectV1JobScores(job,tasks,currentCandidateVersion(profileId).id).v1Match;
  }
  draft.status=decision==="accept"?"accepted":"rejected";draft.updatedAt=new Date().toISOString();
  if(decision==="accept") {
    job.cv={...(job.cv||{}),matchBasis:draft.matchBasis,language:draft.language,notesLocale:draft.notesLocale,label:`CV adapté — ${job.company}`,pdfCompany:job.company,file:draft.file,pages:draft.pages,atsScore:draft.atsScore,keywordCoverage:draft.keywordCoverage,generatedAt:draft.updatedAt,inputVersionId:draft.baseVersionId,changes:draft.changes,presentationScore:draft.assessment?.draftScore??null,baselinePresentationScore:draft.assessment?.baselineScore??null,presentationDelta:draft.assessment?.delta??null,draftId:draft.id};
    const v1Match=job.v1Match as Record<string,any>|undefined;
    if(v1Match && Number.isFinite(Number(v1Match.currentScore))) {
      const current=Math.max(0,Math.min(100,Math.round(Number(v1Match.currentScore))));
      const ceiling=Math.max(current,Math.min(100,Math.round(Number(v1Match.cvPotentialScore ?? current))));
      const presentationGain=Math.max(0,Math.round(Number(draft.assessment?.delta ?? 0)));
      v1Match.acceptedCvScore=Math.min(ceiling,current+presentationGain);
      v1Match.displayScore=v1Match.acceptedCvScore;
      v1Match.acceptedDraftId=draft.id;
    }
    if(job.status==="À candidater")job.status="CV prêt";
    const cvTask=job.prepTasks?.find(task=>/adapter le cv|cv anglais|version ciblée du cv|cv quant/i.test(task.label));if(cvTask)cvTask.done=true;
  }
  writeStore(profileId,store);return {ok:true,job,draft};
}

export async function downloadTailoredCv(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) return new Response("id required", { status: 400 });
  const profileId = await activeProfileId(url.searchParams.get("profileId"));
  try {
    const store=readStore(profileId);
    const job = store.jobs.find((item) => item.id === id);
    const draftId=url.searchParams.get("draftId")?.trim();
    const draft=draftId ? (job as any)?.cvDraft as TailoredDraft | undefined : undefined;
    if(draftId && (!draft || draft.id!==draftId)) return new Response("tailored CV draft not found",{status:404});
    const rel = draft?.file || job?.cv?.file;
    if (!rel) return new Response("no tailored CV for this candidature", { status: 404 });
    const abs = path.resolve(workspaceRoot(), rel);
    const outputRoot = path.resolve(workspaceRoot(), "output") + path.sep;
    if (!abs.startsWith(outputRoot)) return new Response("invalid CV path", { status: 400 });
    const compare=url.searchParams.get("compare");
    let output=abs;
    if(compare) {
      if(!["baseline","highlight"].includes(compare))return new Response("Invalid comparison mode",{status:400});
      const baseVersionId=draft?.baseVersionId || job?.cv?.inputVersionId;
      if(!baseVersionId)return new Response("Original CV version not found",{status:404});
      const baseline=await renderCvPreview(profileId,undefined,baseVersionId);
      if(compare==="baseline")output=baseline.pdf;
      else {
        output=abs.replace(/\.pdf$/i,`-changes-v2-r${draft?.revision || 1}.pdf`);
        if(!fs.existsSync(output))await promisify(execFile)(process.env.JOBPILOT_PYTHON || "python",[path.resolve(process.cwd(),"scripts/cv-compare.py"),baseline.pdf,abs,output],{timeout:30000,maxBuffer:1024*1024,env:{...process.env,PYTHONIOENCODING:"utf-8"}});
      }
    }
    const bytes = fs.readFileSync(output);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        ...(url.searchParams.get("download")==="1" ? {"Content-Disposition": `attachment; filename="${path.basename(abs)}"`} : {}),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "could not read tailored CV", { status: 500 });
  }
}

/** Prepare only the visible top roles. No candidature, master CV or PDF is written.
 * This exact assessed payload is later rendered, never regenerated after showing a gain. */
export async function prepareRoleCv(profileId:string,version:Record<string,any>,offer:Record<string,any>,deep:Record<string,any>,locale:string,hooks:{onRun?:(run:any)=>void;onMetrics?:(m:any)=>void;onPhase?:(phase:string)=>void;applicationLanguage?:string}={}) {
  const language=["en","fr"].includes(String(hooks.applicationLanguage)) ? String(hooks.applicationLanguage) : profileCvOptions(profileId,version.sources.config.text).language;
  const basis={currentScore:deep.currentScore,cvPotentialScore:deep.cvPotentialScore,displayScore:deep.currentScore,deepMatch:structuredClone(deep)};
  const job:Job={id:'prepared',company:String(offer.company||''),role:String(offer.title||offer.role||''),url:offer.url,
    location:offer.location,sourceDescription:offer.description,summary:deep.roleSummary,v1Match:basis};
  hooks.onPhase?.('Préparation du contenu concret du CV ciblé');
  let output='';
  await runModelTransport({cwd:workspaceRoot(),prompt:buildPrompt(profileId,job,version,locale,language),
    model:FLOW_DEFAULTS.cv.model as any,reasoning:FLOW_DEFAULTS.cv.reasoning as any,timeoutMs:180_000,
    onRun:hooks.onRun,onMetrics:hooks.onMetrics,onText:text=>{output+=text;},onFinalText:text=>{output=text;}});
  const parsed=extractJsonObject(output).obj;
  if(!parsed || typeof parsed.summary!=='string' || !Array.isArray(parsed.experience))throw new Error('Invalid prepared role CV');
  const payload=sanitizePayload(parsed);
  if(contradictsDocumentLanguage(JSON.stringify({...payload,change_notes:undefined}),language,version.sources.cv.text))throw new Error('Prepared CV language mismatch');
  hooks.onPhase?.('Vérification du CV réellement préparé');
  const comparison=await compareCvPresentation(profileId,job,version,payload,locale,1,hooks);
  return {versionId:version.id,language,notesLocale:locale,matchBasis:basis,payload,assessment:comparison.assessment};
}

export async function generateTailoredCv(req: Request, choice?: {model: any; reasoning: any}) {
  let body: { id?: string; profileId?: string; inputVersionId?: string; uiLocale?: string; applicationLanguage?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.id) return Response.json({ error: "Identifiant de candidature manquant" }, { status: 400 });

  const profileId = await activeProfileId(body.profileId);
  const root = workspaceRoot();
  const inputVersion = body.inputVersionId ? loadCandidateVersion(historyDirectory(profileId),body.inputVersionId)
    : await withProfileLock(historyDirectory(profileId),()=>currentCandidateVersion(profileId));
  let store: Store;
  let job: Job | undefined;
  try {
    store = readStore(profileId);
    job = store.jobs.find((item) => item.id === body.id);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Impossible de lire les candidatures." }, { status: 500 });
  }
  if (!job) return Response.json({ error: "Candidature introuvable" }, { status: 404 });
  let prepared:any=null;
  const requestedMaterial=["fr","en"].includes(String(body.applicationLanguage)) ? String(body.applicationLanguage) : profileCvOptions(profileId).language;
  if(job.v1Match) {
    const taskDir=path.join(historyDirectory(profileId),"tasks");
    const tasks=fs.existsSync(taskDir)?fs.readdirSync(taskDir).filter(name=>name.endsWith(".json")).map(name=>readJson(path.join(taskDir,name))).filter(Boolean).sort((a:any,b:any)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)):[];
    job=projectV1JobScores(job,tasks,inputVersion.id) as Job;
    prepared=reusablePreparedCv(tasks,inputVersion.id,job.url,requestedMaterial,(job.v1Match as any).currentScore);
  }
  const locale=requestUiLocale(req,body.uiLocale);
  const material=["fr","en"].includes(String(body.applicationLanguage)) ? String(body.applicationLanguage) : profileCvOptions(profileId).language;
  const generationKey=JSON.stringify(["tailored-cv-v4-onward-prepared",operationKey("cv",{jobId:job.id,applicationLanguage:material},inputVersion,[job])]);
  const generationFile=path.join(historyDirectory(profileId),"cv-generations",inputVersion.id,encodeURIComponent(job.id)+"-"+material+".json");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (value: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      const fail = (message: string) => {
        emit({ t: "error", message });
        controller.close();
      };
      try {
        emit({ t: "progress", label: "Lecture du profil et du poste" });
        const prompt = buildPrompt(profileId, job!, inputVersion,locale,material);
        const cached=readJson(generationFile);
        let output = "";
        let generationMetrics:Record<string,any>={};
        if(prepared) {
          output=JSON.stringify(prepared.payload);
          emit({t:"progress",label:"Mise en page du contenu déjà vérifié, sans nouvelle estimation"});
        } else if(cached?.operationKey===generationKey && cached.output) {
          output=cached.output;
          emit({t:"progress",label:"Contenu déjà enregistré · reprise de la mise en page sans IA"});
          emit({t:"metrics",metrics:{model:"local-render",reasoning:"none",queueMs:0,agentMs:0,inputTokens:0,outputTokens:0,totalTokens:0,actualCostUsd:null,estimatedCostUsd:0,costKind:"no-ai",reusedAgentOutput:true}});
        } else {
          emit({ t: "progress", label: "Le modèle adapte le contenu du CV" });
          await runModelTransport({
            prompt, cwd: root,
            model: choice?.model || FLOW_DEFAULTS.cv.model as any,
            reasoning: choice?.reasoning || FLOW_DEFAULTS.cv.reasoning as any,
            timeoutMs: 300_000,
            onRun: run => emit({t:"execution",transport:run.transport,sessionId:run.sessionId,runId:run.runId,remoteSessionId:run.remoteSessionId}),
            onMetrics: metrics => { generationMetrics=metrics;emit({t:"metrics",metrics}); },
            onText: (text) => { output += text; },
            onFinalText: complete=>{output=complete;},
          });
        }
        const parsed = extractJsonObject(output).obj as TailoredPayload | null;
        if (!parsed || typeof parsed.summary !== "string" || !Array.isArray(parsed.experience)) {
          return fail("Le modèle n'a pas renvoyé un CV structuré exploitable.");
        }
        if(cached?.operationKey!==generationKey || !cached.output) writeJson(generationFile,{operationKey:generationKey,profileId,jobId:job.id,inputVersionId:inputVersion.id,output,metrics:generationMetrics,createdAt:new Date().toISOString()});

        const payload=sanitizePayload(parsed);
        const documentText=JSON.stringify({...payload,change_notes:undefined});
        if(contradictsDocumentLanguage(documentText,material,inputVersion.sources.cv.text)) return fail("CV language mismatch; the previous PDF is preserved.");
        const draftId=randomUUID(),revision=1;
        emit({t:"progress",label:"Mise en page du brouillon et contrôle ATS"});
        const rendered=await renderDraftFiles(profileId,job!,inputVersion,payload,material,draftId);
        emit({t:"progress",label:"Comparaison avec le CV actuel pour ce poste"});
        let assessmentMetrics:Record<string,any>={};
        const comparison=prepared ? {assessment:prepared.assessment} : await compareCvPresentation(profileId,job!,inputVersion,payload,locale,revision,{
          onRun:run=>emit({t:"execution",transport:run.transport,sessionId:run.sessionId,runId:run.runId,remoteSessionId:run.remoteSessionId}),
          onMetrics:m=>{assessmentMetrics=m;},
        });
        const changes=cleanArray(payload.change_notes),now=new Date().toISOString();
        const draft:TailoredDraft={matchBasis:prepared?.matchBasis || (job!.v1Match?structuredClone(job!.v1Match as Record<string,any>):undefined),id:draftId,status:"pending",baseVersionId:inputVersion.id,language:material,notesLocale:locale,revision,createdAt:now,updatedAt:now,payload,...rendered,changes:changes.length?changes:job!.cv?.changes??[],baselinePresentationScore:comparison.assessment.baselineScore,assessment:comparison.assessment};
        const latestStore=readStore(profileId),latestJob=latestStore.jobs.find(item=>item.id===body.id);
        if(!latestJob)return fail("La candidature a été supprimée pendant la génération ; le PDF de brouillon est conservé dans output.");
        (latestJob as any).cvDraft=draft;writeStore(profileId,latestStore);
        const sum=(key:string)=>[generationMetrics?.[key],assessmentMetrics?.[key]].reduce((total,value)=>total+(Number.isFinite(Number(value))?Number(value):0),0);
        const estimated=sum("estimatedCostUsd");
        emit({t:"metrics",metrics:{...assessmentMetrics,model:assessmentMetrics.model||generationMetrics.model||FLOW_DEFAULTS.cv.model,reasoning:assessmentMetrics.reasoning||generationMetrics.reasoning||FLOW_DEFAULTS.cv.reasoning,inputTokens:sum("inputTokens"),outputTokens:sum("outputTokens"),cachedInputTokens:sum("cachedInputTokens"),totalTokens:sum("totalTokens"),estimatedCostUsd:estimated||null,actualCostUsd:null,costKind:"api-equivalent-estimate",generationMetrics,assessmentMetrics}});
        emit({t:"done",jobId:latestJob.id,draftId,cvDraft:draft,atsScore:draft.atsScore,keywordCoverage:draft.keywordCoverage,assessment:draft.assessment});
        controller.close();
      } catch (error) {
        fail(error instanceof Error ? error.message : "La génération du CV a échoué.");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
