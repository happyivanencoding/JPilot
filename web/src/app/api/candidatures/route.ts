import fs from "node:fs";
import * as yaml from "js-yaml";
import { readApplications, readReport } from "@/lib/career-ops";
import { parseReport } from "@/lib/format";
import { atomicWrite } from "@/lib/core/safe-write";
import { profileFile } from "@/lib/profile-context";
import { activeProfileId } from "@/lib/profile-request";
import {evaluationAction,evaluationSummary,retirePendingEvaluation} from "@/lib/evaluation-action.mjs";
import {reportTableValue as tableValue,blockBMatches} from "@/lib/report-job-fields.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrepTask = { id: string; label: string; done: boolean };
type Followup = { nextAction: string; dueDate: string; note: string };
type JobRecord = {
  id: string;
  status: string;
  prepTasks: PrepTask[];
  followup: Followup;
  [key: string]: unknown;
};
type Store = { candidate: string; updatedAt: string; jobs: JobRecord[] };

function storePath(profileId: string) {
  return profileFile(profileId, "candidatures");
}

function readStore(profileId: string): Store {
  return JSON.parse(fs.readFileSync(storePath(profileId), "utf8")) as Store;
}

function slug(value: string) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-").slice(0, 80) || "candidature";
}

function roleKey(value: string) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((token) => !["h", "f", "cdi", "cdd", "hf", "fh"].includes(token))
    .join("-");
}

function machineSummary(markdown: string): Record<string, unknown> {
  const match = markdown.match(/##\s+Machine Summary\s*\r?\n+```ya?ml\s*\r?\n([\s\S]*?)\r?\n```/i);
  if (!match) return {};
  try {
    const parsed = yaml.load(match[1]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim()) : [];
}

function syncTrackerJobs(store: Store, profileId: string): Store {
  const knownUrls = new Set(store.jobs.map((job) => String(job.url ?? "")).filter(Boolean));
  const knownKeys = new Set(store.jobs.map((job) => `${slug(String(job.company ?? ""))}|${roleKey(String(job.role ?? ""))}`));
  let changed = false;

  for (const app of readApplications(profileId)) {
    if (!app.company || !app.role || /discard|skip|refus/i.test(app.status)) continue;
    const report = readReport(app.n);
    if (!report) continue;
    const meta = parseReport(report.content);
    const url = meta.fields.find((field) => field.label === "URL")?.value ?? "";
    const key = `${slug(app.company)}|${roleKey(app.role)}`;
    const machine = machineSummary(report.content);
    const score = Number(machine.score ?? parseFloat(app.score)) || 0;
    const existing = store.jobs.find((job) =>
      (url && String(job.url ?? "") === url) ||
      `${slug(String(job.company ?? ""))}|${roleKey(String(job.role ?? ""))}` === key,
    );
    if (existing) {
      const actionPatch=retirePendingEvaluation(existing,machine);
      if(Object.keys(actionPatch).length){Object.assign(existing,actionPatch);changed=true;}
      // A saved discovery card has no evaluation yet. Hydrate its analysis when
      // the official report arrives, without clobbering manually curated cards.
      const needsAnalysis = (String(existing.id).startsWith("saved-") && !existing.reportNum)
        || (existing.analysisSource === "official-report" && existing.reportNum !== app.n);
      if (needsAnalysis) {
        const strengths = list(machine.top_strengths);
        const softGaps = list(machine.soft_gaps);
        const hardStops = list(machine.hard_stops);
        existing.strengths = strengths;
        existing.gaps = [...hardStops, ...softGaps].map((title, index) => ({ title,
          severity: index < hardStops.length ? "Point bloquant à vérifier" : "Écart à préparer",
          why: "Évaluation officielle career-ops.",
          positioning: "Décrire le niveau réel et l’expérience adjacente, sans inventer de compétence." }));
        existing.match = blockBMatches(report.content);
        existing.summary = evaluationSummary(app.notes);
        existing.angle = strengths.length ? `Mettre en avant : ${strengths.slice(0, 2).join(" ; ")}.` : "Consulter les preuves du rapport officiel.";
        existing.analysisSource = "official-report";
        existing.verification = meta.fields.find((field) => field.label === "Verification")?.value || "unconfirmed";
        const previousCv = existing.cv && typeof existing.cv === "object" ? existing.cv as Record<string, unknown> : {};
        existing.cv = { ...previousCv, keywords: list(machine.keywords) };
        existing.interview = { processKnown: false, process: ["Processus réel à confirmer avec le recruteur."],
          questions: softGaps.slice(0, 5).map((gap) => ({ question: `Comment répondez-vous à cet écart : ${gap} ?`,
            answer: "Préparer un exemple documenté et une réponse honnête.", proof: "CV du profil sélectionné." })) };
        changed = true;
      }
      const priority = score >= 4.4 ? "Priorité 1" : score >= 4 ? "Priorité 2" : "Priorité 3";
      if (existing.reportNum !== app.n) { existing.reportNum = app.n; changed = true; }
      if (score > 0 && existing.score !== score) { existing.score = score; changed = true; }
      if (existing.priority !== priority) { existing.priority = priority; changed = true; }
      if (existing.lastChecked !== app.date) { existing.lastChecked = app.date; changed = true; }
      if (!existing.url && url) { existing.url = url; changed = true; }
      if (url) knownUrls.add(url);
      knownKeys.add(key);
      continue;
    }

    const strengths = list(machine.top_strengths);
    const softGaps = list(machine.soft_gaps);
    const hardStops = list(machine.hard_stops);
    const gaps = [...hardStops, ...softGaps].slice(0, 6).map((gap, index) => ({
      title: gap,
      severity: index < hardStops.length ? "Point bloquant à vérifier" : "Écart à préparer",
      why: "Signal relevé dans l'évaluation officielle career-ops.",
      positioning: "Ne pas inventer d'expérience. Expliquer le niveau réel, puis relier l'expérience adjacente au besoin du poste.",
    }));
    const posted = app.notes.match(/(?:^|;\s*)posted:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? "À confirmer";
    const hasPdf = /✅|yes|ready/i.test(app.pdf);
    const {recommendation,nextAction}=evaluationAction(machine);

    store.jobs.push({
      id: `${slug(app.company)}-${slug(app.role)}`,
      reportNum: app.n,
      company: app.company,
      role: app.role,
      url,
      location: tableValue(report.content, "Lieu", "Location", "地点", "工作地点") || "À confirmer",
      workMode: tableValue(report.content, "Télétravail", "Remote", "Work mode", "远程办公", "工作方式") || "À confirmer",
      contract: tableValue(report.content, "Contrat", "Contract", "合同", "合同类型") || tableValue(report.content, "Employment classification") || "À confirmer",
      postedAt: posted,
      lastChecked: app.date,
      score,
      priority: score >= 4.4 ? "Priorité 1" : score >= 4 ? "Priorité 2" : "Priorité 3",
      recommendation,
      status: hasPdf ? "CV prêt" : app.status === "Applied" ? "Candidature envoyée" : "À candidater",
      summary: evaluationSummary(app.notes) || `Évaluation career-ops : ${score}/5.`,
      angle: strengths.length ? `Construire la candidature autour de : ${strengths.slice(0, 2).join(" ; ")}.` : "S'appuyer sur les points forts documentés dans le rapport d'évaluation.",
      strengths,
      gaps,
      match: blockBMatches(report.content),
      cv: {
        language: "À adapter",
        label: `CV ${app.company} — ${app.role}`,
        pdfCompany: app.company,
        file: "",
        pages: 0,
        atsScore: 0,
        changes: [],
        keywords: list(machine.keywords),
      },
      interview: {
        processKnown: false,
        process: ["Processus de recrutement à confirmer avec le recruteur."],
        caseStudy: strengths[0] ? `Préparer un cas détaillé autour de ce point fort : ${strengths[0]}` : "Préparer un cas concret directement lié au cœur du poste.",
        questions: softGaps.slice(0, 4).map((gap) => ({
          question: `Comment répondez-vous au point suivant : ${gap} ?`,
          answer: "Répondre factuellement, sans transformer une expérience adjacente en expérience directe.",
          proof: "S'appuyer uniquement sur le CV et les expériences documentées.",
        })),
      },
      prepTasks: [
        { id: `${app.n}-pitch`, label: "Préparer un pitch de 90 secondes ciblé sur ce poste", done: false },
        ...softGaps.slice(0, 4).map((gap, index) => ({ id: `${app.n}-gap-${index + 1}`, label: `Préparer l'écart : ${gap}`, done: false })),
      ],
      followup: { nextAction, dueDate: "", note: `Importé automatiquement depuis le rapport #${app.n}.` },
    });
    if (url) knownUrls.add(url);
    knownKeys.add(key);
    changed = true;
  }

  if (changed) {
    store.updatedAt = new Date().toISOString();
    atomicWrite(storePath(profileId), `${JSON.stringify(store, null, 2)}\n`);
  }
  return store;
}

export async function GET(req: Request) {
  const explicit = new URL(req.url).searchParams.get("profileId");
  const profileId = await activeProfileId(explicit);
  try {
    return Response.json(syncTrackerJobs(readStore(profileId), profileId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Impossible de lire les candidatures." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: {
    profileId?: string;
    id?: string;
    status?: string;
    nextAction?: string;
    dueDate?: string;
    note?: string;
    taskId?: string;
    taskDone?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!body.id) return Response.json({ error: "Identifiant de candidature manquant" }, { status: 400 });
  const profileId = await activeProfileId(body.profileId);

  try {
    const store = readStore(profileId);
    const job = store.jobs.find((item) => item.id === body.id);
    if (!job) return Response.json({ error: "Candidature introuvable" }, { status: 404 });

    if (typeof body.status === "string") job.status = body.status;
    if (typeof body.nextAction === "string") job.followup.nextAction = body.nextAction;
    if (typeof body.dueDate === "string") job.followup.dueDate = body.dueDate;
    if (typeof body.note === "string") job.followup.note = body.note;
    if (body.taskId && typeof body.taskDone === "boolean") {
      const task = job.prepTasks.find((item) => item.id === body.taskId);
      if (task) task.done = body.taskDone;
    }

    store.updatedAt = new Date().toISOString();
    atomicWrite(storePath(profileId), `${JSON.stringify(store, null, 2)}\n`);
    return Response.json({ ok: true, job, updatedAt: store.updatedAt });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Impossible d'enregistrer la candidature." },
      { status: 500 },
    );
  }
}
