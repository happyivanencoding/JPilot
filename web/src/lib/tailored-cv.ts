import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { activeProfileId } from "@/lib/profile-request";
import { getProfile, profileFile } from "@/lib/profile-context";
import { runModelTransport } from "@/lib/model-transport";
import { extractJsonObject } from "@/lib/extract-json-object.mjs";
import { atomicWrite } from "@/lib/core/safe-write";
import { currentCandidateVersion, historyDirectory } from "@/lib/mobile-history";
import { withProfileLock, loadCandidateVersion, operationKey, readJson, writeJson } from "@/lib/mobile-state.mjs";
import { FLOW_DEFAULTS } from "@/lib/ai-metrics.mjs";
import {applicationLanguage,requestUiLocale,explanationDirective,contradictsDocumentLanguage} from "@/lib/language-contract.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 420;

const execFileAsync = promisify(execFile);

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

type TailoredPayload = {
  summary?: string;
  experience?: unknown[];
  projects?: unknown[];
  education?: unknown[];
  skills?: unknown[];
  change_notes?: unknown[];
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

function buildPrompt(profileId: string, job: Job, version: Record<string,any>, uiLocale: string, material: string) {
  const p = getProfile(profileId);
  const cvOptions = {...profileCvOptions(profileId),language:material};
  const target = {
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
  };
  return `You are producing the CONTENT for a CV tailored to one concrete job. This is a real application for ${p.name}; accuracy matters more than keyword coverage.

CANDIDATE EVIDENCE IS EMBEDDED BELOW. Do not read files or use tools.

MASTER CV / EVIDENCE BASE:
${version.sources.cv.text}

CANDIDATE CONFIGURATION:
${version.sources.config.text}

CANDIDATE POSITIONING / CV SELECTION RULES:
${version.sources.notes.text}

The Master CV is deliberately comprehensive. It is NOT a request to put every historical experience on the sent CV. Follow the candidate-specific selection and positioning rules in the notes file. Prefer recent, direct evidence; use older or adjacent evidence only when it materially strengthens this job. Never turn an adjacent experience into direct experience, and never invent a missing skill, metric, employer, responsibility or credential.

TARGET JOB ANALYSIS (this is the authoritative job-specific context already prepared by career-ops):
${JSON.stringify(target, null, 2)}

LANGUAGE: every candidate-facing CV field (summary, experience, project, education and skills) MUST be written in ${cvOptions.language}. Only change_notes are user-facing explanations, in ${uiLocale}. ${explanationDirective(uiLocale)}

CONTENT BUDGET — respect the configured ${cvOptions.preferredPages}-page target and keep the CV compact:
- Summary: direct and role-specific. No generic enthusiasm.
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

async function runNode(script: string, args: string[], cwd: string) {
  const result = await execFileAsync(process.execPath, [script, ...args], {
    cwd,
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export async function downloadTailoredCv(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) return new Response("id required", { status: 400 });
  const profileId = await activeProfileId(url.searchParams.get("profileId"));
  try {
    const job = readStore(profileId).jobs.find((item) => item.id === id);
    const rel = job?.cv?.file;
    if (!rel) return new Response("no tailored CV for this candidature", { status: 404 });
    const abs = path.resolve(careerOpsRoot(), rel);
    const outputRoot = path.resolve(careerOpsRoot(), "output") + path.sep;
    if (!abs.startsWith(outputRoot)) return new Response("invalid CV path", { status: 400 });
    const bytes = fs.readFileSync(abs);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.basename(abs)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "could not read tailored CV", { status: 500 });
  }
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
  const root = careerOpsRoot();
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
  const locale=requestUiLocale(req,body.uiLocale);
  const material=["fr","en"].includes(String(body.applicationLanguage)) ? String(body.applicationLanguage) : profileCvOptions(profileId).language;
  const generationKey=operationKey("cv",{jobId:job.id,applicationLanguage:material},inputVersion,[job]);
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
        if(cached?.operationKey===generationKey && cached.output) {
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

        const cvOptions = {...profileCvOptions(profileId),language:material};
        const documentText=JSON.stringify({...parsed,change_notes:undefined});
        if(contradictsDocumentLanguage(documentText,material,inputVersion.sources.cv.text)) return fail("CV language mismatch; the previous PDF is preserved.");
        emit({ t: "progress", label: `Mise en page du CV · ${cvOptions.preferredPages} page${cvOptions.preferredPages > 1 ? "s" : ""}` });
        const profile = getProfile(profileId);
        const config = readProfileConfig(profileId,inputVersion.sources.config.text);
        const candidateConfig = config.candidate && typeof config.candidate === "object" && !Array.isArray(config.candidate)
          ? (config.candidate as Record<string, unknown>)
          : {};
        const linkedinUrl = typeof candidateConfig.linkedin === "string"
          ? candidateConfig.linkedin.trim()
          : typeof candidateConfig.linkedin_url === "string"
            ? candidateConfig.linkedin_url.trim()
            : "";
        const candidate = {
          name: typeof candidateConfig.full_name === "string" ? candidateConfig.full_name : profile.name,
          phone: typeof candidateConfig.phone === "string" ? candidateConfig.phone : "",
          email: typeof candidateConfig.email === "string" ? candidateConfig.email : "",
          linkedin: { url: linkedinUrl, display: linkedinUrl.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/$/, "") },
          location: typeof candidateConfig.location === "string" ? candidateConfig.location : "",
          photo: "",
        };
        const renderPayload = {
          lang: cvOptions.language,
          page_format: "a4",
          candidate,
          sections: {
            summary: "Professional Summary",
            competencies: "Core Competencies",
            experience: "Professional Experience",
            projects: "Selected Projects",
            education: "Education",
            certifications: "Certifications",
            awards: "Awards & Honors",
            interests: "Interests",
            skills: "Skills",
          },
          summary: parsed.summary,
          competencies: [],
          experience: Array.isArray(parsed.experience) ? parsed.experience : [],
          projects: Array.isArray(parsed.projects) ? parsed.projects : [],
          education: Array.isArray(parsed.education) ? parsed.education : [],
          certifications: [],
          awards: [],
          interests: [],
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        };

        const dir = path.join(root, ".career-ops-web", "candidature-cv");
        const outputDir = path.join(root, "output");
        fs.mkdirSync(dir, { recursive: true });
        fs.mkdirSync(outputDir, { recursive: true });
        const stem = `cv-${slug(candidate.name, "candidate")}-${slug(job!.company, "company")}-${slug(job!.role, "role")}-${todayLocal()}`;
        const jsonPath = path.join(dir, `${stem}.json`);
        const htmlPath = path.join(outputDir, `${stem}.html`);
        const pdfPath = path.join(outputDir, `${stem}.pdf`);
        fs.writeFileSync(jsonPath, `${JSON.stringify(renderPayload, null, 2)}\n`, "utf8");

        const customTemplatePath = path.join(root, "templates", cvOptions.template, "cv-template.html");
        const templatePath = cvOptions.template !== "standard" && fs.existsSync(customTemplatePath)
          ? customTemplatePath
          : path.join(root, "templates", "cv-template.html");
        await runNode(path.join(root, "build-cv-html.mjs"), [jsonPath, htmlPath, templatePath], root);
        await runNode(path.join(root, "generate-pdf.mjs"), [
          htmlPath,
          pdfPath,
          "--format=a4",
          "--allow-reorder",
          `--max-pages=${cvOptions.preferredPages}`,
          "--strict-pages",
        ], root);

        emit({ t: "progress", label: "Contrôle ATS et mots-clés" });
        const keywords = cleanArray(job!.cv?.keywords).join(",");
        const auditArgs=[htmlPath];
        if(keywords) auditArgs.push("--keywords",keywords);
        auditArgs.push("--json");
        const audit = await runNode(path.join(root, "verify-ats.mjs"), auditArgs, root);
        const ats = JSON.parse(audit.stdout) as { score?: number; keywordCoverage?: { percent?: number } | null };
        const atsScore = typeof ats.score === "number" ? ats.score : 0;
        const keywordCoverage = keywords && typeof ats.keywordCoverage?.percent === "number" ? ats.keywordCoverage.percent : null;

        const relPdf = path.relative(root, pdfPath).replace(/\\/g, "/");
        const changes = cleanArray(parsed.change_notes);
        job!.cv = {
          ...(job!.cv ?? {}),
          language: cvOptions.language,
          notesLocale: locale,
          label: `CV adapté — ${job!.company}`,
          pdfCompany: job!.company,
          file: relPdf,
          pages: cvOptions.preferredPages,
          atsScore,
          keywordCoverage,
          generatedAt: new Date().toISOString(),
          inputVersionId: inputVersion.id,
          changes: changes.length ? changes : job!.cv?.changes ?? [],
        };
        if (job!.status === "À candidater") job!.status = "CV prêt";
        if (Array.isArray(job!.prepTasks)) {
          const cvTask = job!.prepTasks.find((task) => /adapter le cv|cv anglais|version ciblée du cv|cv quant/i.test(task.label));
          if (cvTask) cvTask.done = true;
        }
        // A CV turn can take several minutes. Merge into a fresh snapshot so a
        // status/reply/plan saved meanwhile on the phone is never overwritten.
        const latestStore = readStore(profileId);
        const latestJob = latestStore.jobs.find((item) => item.id === body.id);
        if (!latestJob) return fail("La candidature a été supprimée pendant la génération ; le PDF est conservé dans output.");
        latestJob.cv = job!.cv;
        const latestCvTask = latestJob.prepTasks?.find((task) => /adapter le cv|cv anglais|version ciblée du cv|cv quant/i.test(task.label));
        if (latestCvTask) latestCvTask.done = true;
        if (latestJob.status === "À candidater") latestJob.status = "CV prêt";
        latestStore.updatedAt = new Date().toISOString();
        atomicWrite(profileFile(profileId, "candidatures"), `${JSON.stringify(latestStore, null, 2)}\n`);
        emit({ t: "done", job: latestJob, atsScore, keywordCoverage });
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
