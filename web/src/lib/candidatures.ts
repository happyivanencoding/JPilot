// Profile-scoped candidature storage and reconciliation, shared by HTTP and background tasks.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as yaml from "js-yaml";
import { readApplications, readReport } from "@/lib/backend/workspace";
import { getProfile, profileFile } from "@/lib/profile-context";
import { atomicWrite } from "@/lib/backend/files.mjs";
import { addOffersToPipeline } from "@/lib/backend/inbox";
import { normalizeUrl } from "@/lib/posting-url.mjs";
import { normalizeOffer, applyJobUpdate } from "@/lib/mobile-domain.mjs";
import { parseReport } from "@/lib/report-metadata.mjs";
import { evaluationAction, evaluationSummary, retirePendingEvaluation } from "@/lib/evaluation-action.mjs";
import { reportTableValue as tableValue, blockBMatches } from "@/lib/report-job-fields.mjs";

type Job = Record<string, any>;
type Store = { candidate: string; updatedAt: string; jobs: Job[] };

export function readCandidatureStore(profileId: string): Store {
  const file = profileFile(profileId, "candidatures");
  if (!fs.existsSync(file)) return { candidate: getProfile(profileId).name, updatedAt: new Date().toISOString(), jobs: [] };
  const store = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(store.jobs)) throw new Error("Le fichier de candidatures est invalide ; aucune donnée n’a été remplacée.");
  return store;
}
export function writeCandidatureStore(profileId: string, store: Store) {
  const file = profileFile(profileId, "candidatures");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  store.updatedAt = new Date().toISOString();
  atomicWrite(file, JSON.stringify(store, null, 2) + "\n");
}
export function updateMobileJob(profileId: string, id: string, change: Record<string, unknown>) {
  const store = readCandidatureStore(profileId);
  const index = store.jobs.findIndex(j => j.id === id);
  if (index < 0) throw new Error("Candidature introuvable.");
  store.jobs[index] = applyJobUpdate(store.jobs[index], change);
  writeCandidatureStore(profileId, store);
  return store.jobs[index];
}

function v1MatchFromRaw(raw:any) {
  const fast=raw?.fastMatch,deep=raw?.deepMatch;
  const current=Number(raw?.matchScore?.baseline ?? deep?.currentScore ?? fast?.score);
  if(!Number.isFinite(current))return null;
  const cvPotential=Math.max(current,Number(deep?.cvPotentialScore ?? current));
  const capabilityPotential=Math.max(cvPotential,Number(deep?.capabilityPotentialScore ?? cvPotential));
  return {currentScore:Math.max(0,Math.min(100,Math.round(current))),displayScore:Math.max(0,Math.min(100,Math.round(current))),cvPotentialScore:Math.max(0,Math.min(100,Math.round(cvPotential))),capabilityPotentialScore:Math.max(0,Math.min(100,Math.round(capabilityPotential))),deepMatch:deep||null,fastMatch:fast||null,source:"v1-student-match"};
}

export async function saveMobileOffer(profileId: string, raw: unknown) {
  const offer = normalizeOffer(raw);
  const v1Match=v1MatchFromRaw(raw);
  let store = readCandidatureStore(profileId);
  const existing = store.jobs.find(j => normalizeUrl(j.url) === normalizeUrl(offer.url));
  if (existing) {
    if(v1Match && !(existing.cvDraft?.status==='pending' && existing.cvDraft?.matchBasis) && !existing.cv?.matchBasis){existing.v1Match={...existing.v1Match,...v1Match,...(existing.cv?.presentationDelta!=null?{displayScore:Math.min(Number(v1Match.cvPotentialScore),Number(v1Match.currentScore)+Math.max(0,Number(existing.cv.presentationDelta)))}:{})};if(!existing.sourceDescription&&offer.description)existing.sourceDescription=offer.description;writeCandidatureStore(profileId,store);}
    return existing;
  }
  // Persist through the shared writer in this runtime root, not another HTTP server.
  const result = await addOffersToPipeline([offer], profileId);
  if (result.error) throw new Error(result.error);
  store = readCandidatureStore(profileId);
  const saved = store.jobs.find(j => normalizeUrl(j.url) === normalizeUrl(offer.url));
  if (saved) {
    if(v1Match){saved.v1Match=v1Match;if(!saved.sourceDescription&&offer.description)saved.sourceDescription=offer.description;writeCandidatureStore(profileId,store);}
    return saved;
  }
  const job: Job = {
    id: "saved-" + randomUUID(), company: offer.company, role: offer.title, url: offer.url,
    location: offer.location, contract: (offer as any).contractType || "À confirmer", score: null, priority: "À évaluer", recommendation: "Évaluation officielle nécessaire",
    status: "À candidater", summary: offer.why, sourceDescription: offer.description, verification: "unconfirmed", discoveredAt: new Date().toISOString(),
    postedAt: offer.postedAt || offer.postedHint || "À confirmer",
    discovery: { source: offer.source, sourceLabel: offer.sourceLabel, direct: offer.direct, remote: offer.remote, searchRelevance: offer.searchRelevance, relevanceTier: offer.relevanceTier, dataQuality: offer.dataQuality, ageDays: offer.ageDays },
    strengths: [], gaps: [], match: [], prepTasks: [], replies: [],
    cv: { file: "", changes: [], keywords: [] }, interview: { process: [], questions: [] },
    followup: { nextAction: "Évaluer la compatibilité avant de candidater", dueDate: "", note: "" },
    ...(v1Match?{v1Match}:{}),
  };
  store.jobs.push(job);
  writeCandidatureStore(profileId, store);
  return job;
}

function slug(value: string) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-").slice(0, 80) || "candidature";
}

function roleKey(value: string) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((token) => !["h", "f", "cdi", "cdd", "hf", "fh"].includes(token))
    .join("-");
}

export function findExistingCandidature(jobs: Job[], url: string, company: string, role: string) {
  const urlKey=normalizeUrl(url);
  if(urlKey) return jobs.find(job=>normalizeUrl(String(job.url ?? ""))===urlKey);
  const key=`${slug(company)}|${roleKey(role)}`;
  return jobs.find(job=>`${slug(String(job.company ?? ""))}|${roleKey(String(job.role ?? ""))}`===key);
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

export function reconcileCandidatures(profileId: string): Store {
  const store = readCandidatureStore(profileId);
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
    const existing = findExistingCandidature(store.jobs, url, app.company, app.role);
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
      if (Number.isFinite(score) && existing.score !== score) { existing.score = score; changed = true; }
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
    writeCandidatureStore(profileId, store);
  }
  return store;
}

