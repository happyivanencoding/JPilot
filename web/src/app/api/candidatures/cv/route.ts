import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { activeProfileId } from "@/lib/profile-request";
import { getProfile, profileFile, profileRelativeFile } from "@/lib/profile-context";
import { openAgentDockCodex, runAgentDockCodex } from "@/lib/agentdock-acp";
import { extractJsonObject } from "@/lib/extract-json-object.mjs";
import { atomicWrite } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 420;

const execFileAsync = promisify(execFile);

type CvInfo = {
  language?: string;
  label?: string;
  pdfCompany?: string;
  file?: string;
  pages?: number;
  atsScore?: number;
  keywordCoverage?: number;
  generatedAt?: string;
  changes?: string[];
  keywords?: string[];
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

function readProfileConfig(profileId: string): Record<string, unknown> {
  try {
    const parsed = yaml.load(fs.readFileSync(profileFile(profileId, "config"), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function profileCvOptions(profileId: string) {
  const config = readProfileConfig(profileId);
  const cv = config.cv && typeof config.cv === "object" && !Array.isArray(config.cv) ? (config.cv as Record<string, unknown>) : {};
  const language = config.language && typeof config.language === "object" && !Array.isArray(config.language)
    ? (config.language as Record<string, unknown>)
    : {};
  return {
    template: typeof cv.template === "string" && cv.template.trim() ? cv.template.trim() : "standard",
    preferredPages: typeof cv.preferred_pages === "number" && cv.preferred_pages > 0 ? Math.floor(cv.preferred_pages) : 1,
    language: typeof cv.language === "string" && cv.language.trim()
      ? cv.language.trim()
      : typeof language.output === "string" && language.output.trim()
        ? language.output.trim()
        : "en",
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

function buildPrompt(profileId: string, job: Job) {
  const p = getProfile(profileId);
  const cvOptions = profileCvOptions(profileId);
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

READ THESE CANDIDATE SOURCES FIRST:
- Master CV / evidence base: ${profileRelativeFile(profileId, "cv")}
- Candidate configuration: ${profileRelativeFile(profileId, "config")}
- Candidate positioning and CV selection rules: ${profileRelativeFile(profileId, "notes")}

The Master CV is deliberately comprehensive. It is NOT a request to put every historical experience on the sent CV. Follow the candidate-specific selection and positioning rules in the notes file. Prefer recent, direct evidence; use older or adjacent evidence only when it materially strengthens this job. Never turn an adjacent experience into direct experience, and never invent a missing skill, metric, employer, responsibility or credential.

TARGET JOB ANALYSIS (this is the authoritative job-specific context already prepared by career-ops):
${JSON.stringify(target, null, 2)}

LANGUAGE: every candidate-facing CV field (summary, experience, project, education and skills) MUST be written in ${cvOptions.language}. Only change_notes must be in French for the local candidature cockpit.

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
  "change_notes": ["3-6 concise French notes explaining the adaptation"]
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

export async function GET(req: Request) {
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

export async function POST(req: Request) {
  let body: { id?: string; profileId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.id) return Response.json({ error: "Identifiant de candidature manquant" }, { status: 400 });

  const profileId = await activeProfileId(body.profileId);
  const root = careerOpsRoot();
  let store: Store;
  let job: Job | undefined;
  try {
    store = readStore(profileId);
    job = store.jobs.find((item) => item.id === body.id);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Impossible de lire les candidatures." }, { status: 500 });
  }
  if (!job) return Response.json({ error: "Candidature introuvable" }, { status: 404 });

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
        const prompt = buildPrompt(profileId, job!);
        const connection = await openAgentDockCodex();
        let output = "";
        emit({ t: "progress", label: "Codex adapte le contenu du CV" });
        await runAgentDockCodex({
          client: connection.client,
          prompt,
          cwd: root,
          mode: "read-only",
          model: "gpt-5.6-terra",
          reasoning: "medium",
          timeoutMs: 300_000,
          onText: (text) => { output += text; },
        });
        const parsed = extractJsonObject(output).obj as TailoredPayload | null;
        if (!parsed || typeof parsed.summary !== "string" || !Array.isArray(parsed.experience)) {
          return fail("Codex n'a pas renvoyé un CV structuré exploitable.");
        }

        const cvOptions = profileCvOptions(profileId);
        emit({ t: "progress", label: `Mise en page du CV · ${cvOptions.preferredPages} page${cvOptions.preferredPages > 1 ? "s" : ""}` });
        const profile = getProfile(profileId);
        const config = readProfileConfig(profileId);
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
        const audit = await runNode(path.join(root, "verify-ats.mjs"), [htmlPath, "--keywords", keywords, "--json"], root);
        const ats = JSON.parse(audit.stdout) as { score?: number; keywordCoverage?: { percent?: number } | null };
        const atsScore = typeof ats.score === "number" ? ats.score : 0;
        const keywordCoverage = typeof ats.keywordCoverage?.percent === "number" ? ats.keywordCoverage.percent : 0;

        const relPdf = path.relative(root, pdfPath).replace(/\\/g, "/");
        const changes = cleanArray(parsed.change_notes);
        job!.cv = {
          ...(job!.cv ?? {}),
          language: cvOptions.language,
          label: `CV adapté — ${job!.company}`,
          pdfCompany: job!.company,
          file: relPdf,
          pages: cvOptions.preferredPages,
          atsScore,
          keywordCoverage,
          generatedAt: new Date().toISOString(),
          changes: changes.length ? changes : job!.cv?.changes ?? [],
        };
        if (job!.status === "À candidater") job!.status = "CV prêt";
        if (Array.isArray(job!.prepTasks)) {
          const cvTask = job!.prepTasks.find((task) => /adapter le cv|cv anglais|version ciblée du cv|cv quant/i.test(task.label));
          if (cvTask) cvTask.done = true;
        }
        store.updatedAt = new Date().toISOString();
        atomicWrite(profileFile(profileId, "candidatures"), `${JSON.stringify(store, null, 2)}\n`);
        emit({ t: "done", job, atsScore, keywordCoverage });
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
