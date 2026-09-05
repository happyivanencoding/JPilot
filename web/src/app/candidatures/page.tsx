"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  FileText,
  Gauge,
  Loader2,
  MapPin,
  NotebookPen,
  Save,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = ["Vue d'ensemble", "Compatibilité", "CV & candidature", "Entretien", "Relances"] as const;
type Tab = (typeof TABS)[number];

type Gap = { title: string; severity: string; why: string; positioning: string };
type Match = { requirement: string; fit: "Fort" | "Partiel" | "Écart"; evidence: string; action: string };
type PrepTask = { id: string; label: string; done: boolean };
type InterviewQuestion = { question: string; answer: string; proof: string };
type Job = {
  id: string;
  reportNum?: string;
  company: string;
  role: string;
  url: string;
  location: string;
  workMode: string;
  contract: string;
  postedAt: string;
  lastChecked: string;
  score: number;
  priority: string;
  recommendation: string;
  status: string;
  summary: string;
  angle: string;
  strengths: string[];
  gaps: Gap[];
  match: Match[];
  cv: {
    language: string;
    label: string;
    pdfCompany: string;
    file: string;
    pages: number;
    atsScore: number;
    keywordCoverage?: number;
    generatedAt?: string;
    changes: string[];
    keywords: string[];
  };
  interview: {
    processKnown: boolean;
    process: string[];
    caseStudy: string;
    questions: InterviewQuestion[];
  };
  prepTasks: PrepTask[];
  followup: { nextAction: string; dueDate: string; note: string };
};

type Store = { candidate: string; updatedAt: string; jobs: Job[] };

const STATUS_OPTIONS = [
  "À candidater",
  "CV prêt",
  "Candidature envoyée",
  "Réponse reçue",
  "Entretien RH",
  "Entretien métier",
  "Entretien final",
  "Offre reçue",
  "Embauché",
  "En pause",
  "Écartée",
  "Refus",
];

function scoreTone(score: number) {
  if (score >= 4.4) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (score >= 4) return "border-brand/30 bg-brand-soft text-brand-text";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function fitTone(fit: Match["fit"]) {
  if (fit === "Fort") return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (fit === "Partiel") return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  return "bg-red-500/12 text-red-700 dark:text-red-300";
}

function statusTone(status: string) {
  if (status.includes("Offre")) return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (status.includes("Entretien")) return "bg-violet-500/12 text-violet-700 dark:text-violet-300";
  if (status.includes("envoyée")) return "bg-blue-500/12 text-blue-700 dark:text-blue-300";
  if (status.includes("Refus")) return "bg-red-500/12 text-red-700 dark:text-red-300";
  return "bg-brand-soft text-brand-text";
}

function progress(job: Job) {
  const done = job.prepTasks.filter((task) => task.done).length;
  return { done, total: job.prepTasks.length, pct: job.prepTasks.length ? Math.round((done / job.prepTasks.length) * 100) : 0 };
}

function dueLabel(date: string) {
  if (!date) return "Pas de date";
  const due = new Date(`${date}T23:59:59`);
  const today = new Date();
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `En retard de ${Math.abs(days)} j`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} j`;
}

export default function CandidaturesPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("Vue d'ensemble");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingCv, setGeneratingCv] = useState(false);
  const [cvProgress, setCvProgress] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ status: "", nextAction: "", dueDate: "", note: "" });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError("");
    fetch("/api/candidatures", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Impossible de charger le cockpit de candidatures.");
        return data as Store;
      })
      .then((data) => {
        if (!alive) return;
        setStore(data);
        const requested = new URLSearchParams(window.location.search).get("job");
        setSelectedId(requested && data.jobs.some((job) => job.id === requested) ? requested : data.jobs[0]?.id || "");
      })
      .catch((error) => {
        if (!alive) return;
        setLoadError(error instanceof Error ? error.message : "Impossible de charger le cockpit de candidatures.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const jobs = useMemo(() => {
    const all = store?.jobs ?? [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((job) => `${job.company} ${job.role} ${job.status}`.toLowerCase().includes(q)) : all;
  }, [store, query]);

  const selected = store?.jobs.find((job) => job.id === selectedId) ?? store?.jobs[0];

  useEffect(() => {
    if (!selected) return;
    setDraft({
      status: selected.status,
      nextAction: selected.followup.nextAction,
      dueDate: selected.followup.dueDate,
      note: selected.followup.note,
    });
  }, [selected?.id]);

  async function patch(payload: Record<string, unknown>) {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/candidatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      setStore((current) => {
        if (!current) return current;
        return {
          ...current,
          updatedAt: data.updatedAt,
          jobs: current.jobs.map((job) => (job.id === selected.id ? (data.job as Job) : job)),
        };
      });
      setMessage("Enregistré localement.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: PrepTask) {
    await patch({ taskId: task.id, taskDone: !task.done });
  }

  async function generateCv() {
    if (!selected || generatingCv) return;
    setGeneratingCv(true);
    setCvProgress("Préparation du CV adapté…");
    setMessage("");
    try {
      const res = await fetch("/api/candidatures/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Génération du CV impossible.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalJob: Job | null = null;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { t?: string; label?: string; message?: string; job?: Job };
          if (event.t === "progress" && event.label) setCvProgress(event.label);
          if (event.t === "error") throw new Error(event.message || "Génération du CV impossible.");
          if (event.t === "done" && event.job) finalJob = event.job;
        }
        if (done) break;
      }
      if (!finalJob) throw new Error("Le CV a été généré mais le résultat n'a pas été renvoyé au cockpit.");
      setStore((current) => current ? {
        ...current,
        jobs: current.jobs.map((job) => (job.id === finalJob!.id ? finalJob! : job)),
      } : current);
      setMessage(`CV adapté prêt · ATS ${finalJob.cv.atsScore}/100 · mots-clés ${finalJob.cv.keywordCoverage ?? 0}%`);
      setCvProgress("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Génération du CV impossible.");
      setCvProgress("");
    } finally {
      setGeneratingCv(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-muted">
        <Loader2 className="mr-2 size-4 animate-spin" /> Chargement du cockpit…
      </div>
    );
  }

  if (loadError || !store) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto size-5 text-amber-600 dark:text-amber-300" />
          <div className="mt-3 text-sm font-semibold text-foreground">Impossible de charger le cockpit</div>
          <p className="mt-2 text-xs leading-5 text-muted">{loadError || "Le profil actif n'a pas pu être chargé."}</p>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-surface/55 backdrop-blur-xl">
          <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">
              <BriefcaseBusiness className="size-3.5" /> Recherche d'emploi · {store.candidate}
            </div>
            <h1 className="font-display text-3xl tracking-tight text-landing md:text-4xl">Cockpit des candidatures</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Un seul endroit pour décider où candidater, adapter le CV, préparer les entretiens et suivre chaque relance.
            </p>
          </div>
        </div>
        <div className="mx-auto flex max-w-[900px] px-5 py-16 lg:px-8">
          <div className="w-full rounded-3xl border border-border bg-surface p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
              <BriefcaseBusiness className="size-5" />
            </div>
            <h2 className="mt-5 font-display text-2xl text-landing">Aucune candidature pour {store.candidate}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
              Les offres évaluées pour ce profil apparaîtront ici avec leur CV, préparation d'entretien et relances. Les candidatures de l'autre profil restent séparées.
            </p>
            <a
              href="/explore"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-brand-foreground transition hover:bg-brand-200"
            >
              Explorer des offres <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const ready = store.jobs.filter((job) => job.status === "CV prêt").length;
  const interviews = store.jobs.filter((job) => job.status.includes("Entretien")).length;
  const highFit = store.jobs.filter((job) => job.score >= 4.3).length;
  const prep = progress(selected);
  const cvReady = !!selected.cv.file;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-surface/55 backdrop-blur-xl">
        <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">
                <BriefcaseBusiness className="size-3.5" /> Recherche d'emploi · {store.candidate}
              </div>
              <h1 className="font-display text-3xl tracking-tight text-landing md:text-4xl">Cockpit des candidatures</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Un seul endroit pour décider où candidater, adapter le CV, préparer les entretiens et suivre chaque relance.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                [String(highFit), "match ≥ 4,3"],
                [String(ready), "CV prêts"],
                [String(interviews), "en entretien"],
              ].map(([value, label]) => (
                <div key={label} className="min-w-24 rounded-xl border border-border bg-surface px-3 py-2.5 text-center shadow-sm">
                  <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-6 lg:grid-cols-[330px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une candidature…"
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/10"
            />
          </div>

          <div className="space-y-2">
            {jobs.map((job) => {
              const p = progress(job);
              const active = job.id === selected.id;
              return (
                <button
                  key={job.id}
                  onClick={() => {
                    setSelectedId(job.id);
                    setActiveTab("Vue d'ensemble");
                  }}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    active ? "border-brand/40 bg-brand-soft shadow-sm" : "border-border bg-surface hover:border-brand/25 hover:bg-surface-hover",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{job.company}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{job.role}</div>
                    </div>
                    <span className={cn("shrink-0 rounded-lg border px-2 py-1 text-xs font-bold tabular-nums", scoreTone(job.score))}>{job.score}/5</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", statusTone(job.status))}>{job.status}</span>
                    <span className="text-[10px] text-faint">{job.priority}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${p.pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-faint">
                    <span>Préparation {p.done}/{p.total}</span>
                    <span className="text-right">{job.cv.file ? `CV ${job.cv.atsScore}/100` : "CV à générer"} · {dueLabel(job.followup.dueDate)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-text">{selected.priority}</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", statusTone(selected.status))}>{selected.status}</span>
                  <span className="text-xs text-faint">Vérifié le {selected.lastChecked}</span>
                </div>
                <h2 className="mt-3 font-display text-3xl tracking-tight text-landing">{selected.company}</h2>
                <p className="mt-1 text-base font-medium text-foreground">{selected.role}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {selected.location}</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {selected.workMode}</span>
                  <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" /> {selected.contract}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-hover hover:text-foreground"
                >
                  Offre <ExternalLink className="size-3.5" />
                </a>
                {cvReady ? (
                  <>
                    <a
                      href={`/api/candidatures/cv?id=${encodeURIComponent(selected.id)}`}
                      target="_blank"
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-200"
                    >
                      CV adapté <FileText className="size-3.5" />
                    </a>
                    <button
                      onClick={generateCv}
                      disabled={generatingCv}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
                    >
                      {generatingCv ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Régénérer
                    </button>
                  </>
                ) : (
                  <button
                    onClick={generateCv}
                    disabled={generatingCv}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-200 disabled:opacity-60"
                  >
                    {generatingCv ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />} Générer le CV adapté
                  </button>
                )}
              </div>
            </div>
            {generatingCv && cvProgress && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft px-3 py-2 text-xs text-brand-text">
                <Loader2 className="size-3.5 animate-spin" />
                <span>{cvProgress}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto border-b border-border px-3 sm:px-5">
            <div className="flex min-w-max gap-1 py-2">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium transition",
                    activeTab === tab ? "bg-surface-hover text-foreground" : "text-muted hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {activeTab === "Vue d'ensemble" && (
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric icon={Gauge} label="Compatibilité" value={`${selected.score}/5`} detail={selected.recommendation} />
                  <Metric
                    icon={FileText}
                    label="CV adapté"
                    value={cvReady ? (selected.cv.atsScore > 0 ? `${selected.cv.atsScore}/100 ATS` : "PDF prêt") : "À générer"}
                    detail={cvReady ? `${selected.cv.pages || "—"} page · mots-clés ${selected.cv.keywordCoverage ?? 0}% · ${selected.cv.language}` : "Générer une version 1 page ciblée sur ce poste"}
                  />
                  <Metric icon={Clock3} label="Prochaine action" value={dueLabel(selected.followup.dueDate)} detail={selected.followup.nextAction} />
                </div>

                <Card title="Verdict" icon={Sparkles}>
                  <p className="text-sm leading-7 text-muted">{selected.summary}</p>
                </Card>

                <Card title="Angle de candidature" icon={Target} accent>
                  <p className="text-sm leading-7 text-foreground">{selected.angle}</p>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card title="Points à mettre en avant" icon={CheckCircle2}>
                    <ul className="space-y-3">
                      {selected.strengths.map((item) => (
                        <li key={item} className="flex gap-2.5 text-sm leading-6 text-muted">
                          <Check className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> {item}
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="Faiblesses à gérer" icon={AlertTriangle}>
                    <div className="space-y-3">
                      {selected.gaps.map((gap) => (
                        <div key={gap.title} className="rounded-xl border border-border bg-background/50 p-3.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{gap.title}</span>
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{gap.severity}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted">{gap.why}</p>
                          <p className="mt-2 text-xs leading-5 text-foreground"><span className="font-semibold">Positionnement :</span> {gap.positioning}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "Compatibilité" && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-2xl text-landing">Exigences du poste vs profil</h3>
                  <p className="mt-1 text-sm text-muted">On distingue les preuves existantes des compétences à préparer. Aucun écart n'est maquillé en compétence.</p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="hidden grid-cols-[1.1fr_90px_1.4fr_1.2fr] gap-3 border-b border-border bg-background/60 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-faint md:grid">
                    <span>Exigence</span><span>Niveau</span><span>Preuve</span><span>Action</span>
                  </div>
                  <div className="divide-y divide-border">
                    {selected.match.map((item) => (
                      <div key={item.requirement} className="grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_90px_1.4fr_1.2fr]">
                        <div className="text-sm font-medium text-foreground">{item.requirement}</div>
                        <div><span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", fitTone(item.fit))}>{item.fit}</span></div>
                        <div className="text-xs leading-5 text-muted"><span className="md:hidden font-semibold text-foreground">Preuve : </span>{item.evidence}</div>
                        <div className="text-xs leading-5 text-muted"><span className="md:hidden font-semibold text-foreground">Action : </span>{item.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "CV & candidature" && (
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                  <Card title={selected.cv.label} icon={FileText}>
                    <div className="flex flex-wrap gap-2">
                      {selected.cv.keywords.map((keyword) => (
                        <span key={keyword} className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-muted">{keyword}</span>
                      ))}
                    </div>
                    <div className="mt-5 space-y-3">
                      {selected.cv.changes.map((change) => (
                        <div key={change} className="flex gap-2.5 text-sm leading-6 text-muted">
                          <CheckCircle2 className="mt-1 size-4 shrink-0 text-brand-text" /> {change}
                        </div>
                      ))}
                      {!selected.cv.changes.length && (
                        <p className="text-sm leading-6 text-muted">Le CV personnalisé n'a pas encore été généré pour cette offre. Le rapport d'évaluation est prêt et sert de base à l'adaptation.</p>
                      )}
                    </div>
                  </Card>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border bg-background/50 p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">Qualité du CV adapté</div>
                      <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                        {cvReady ? (selected.cv.atsScore > 0 ? <>{selected.cv.atsScore}<span className="text-base text-faint">/100 ATS</span></> : "PDF prêt") : "À générer"}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {cvReady ? `1 page A4 · couverture mots-clés ${selected.cv.keywordCoverage ?? 0}%` : "Version financière 1 page, générée directement pour ce poste"}
                      </div>
                      {cvReady ? (
                        <>
                          <a
                            href={`/api/candidatures/cv?id=${encodeURIComponent(selected.id)}`}
                            target="_blank"
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-brand-foreground hover:bg-brand-200"
                          >
                            Ouvrir le PDF <ArrowUpRight className="size-3.5" />
                          </a>
                          <button
                            onClick={generateCv}
                            disabled={generatingCv}
                            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
                          >
                            {generatingCv ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Régénérer pour ce poste
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={generateCv}
                          disabled={generatingCv}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-brand-foreground hover:bg-brand-200 disabled:opacity-60"
                        >
                          {generatingCv ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Générer le CV adapté
                        </button>
                      )}
                    </div>
                    <div className="rounded-2xl border border-border p-5">
                      <div className="text-xs font-semibold text-foreground">Règle de candidature</div>
                      <p className="mt-2 text-xs leading-5 text-muted">On adapte la formulation et l'ordre des preuves. On n'ajoute jamais une compétence, certification ou responsabilité que {store.candidate} ne peut pas démontrer.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Entretien" && (
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="space-y-4">
                    <Card title="Processus de recrutement" icon={Users}>
                      <div className="space-y-3">
                        {selected.interview.process.map((step, index) => (
                          <div key={step} className="flex gap-3">
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-text">{index + 1}</div>
                            <p className="text-sm leading-6 text-muted">{step}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card title="Cas à préparer" icon={NotebookPen} accent>
                      <p className="text-sm leading-7 text-foreground">{selected.interview.caseStudy}</p>
                    </Card>
                    <Card title={`Plan de préparation · ${prep.done}/${prep.total}`} icon={CheckCircle2}>
                      <div className="space-y-2">
                        {selected.prepTasks.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => toggleTask(task)}
                            disabled={saving}
                            className="flex w-full items-start gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition hover:bg-surface-hover disabled:opacity-60"
                          >
                            <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border", task.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background")}>
                              {task.done && <Check className="size-3.5" />}
                            </span>
                            <span className={cn("text-xs leading-5", task.done ? "text-faint line-through" : "text-muted")}>{task.label}</span>
                          </button>
                        ))}
                      </div>
                    </Card>
                  </div>

                  <Card title="Questions probables et réponse à construire" icon={CircleDot}>
                    <div className="space-y-3">
                      {selected.interview.questions.map((item, index) => (
                        <details key={item.question} className="group rounded-xl border border-border bg-background/40 p-4" open={index === 0}>
                          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-foreground">
                            <span>{item.question}</span>
                            <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint transition group-open:rotate-90" />
                          </summary>
                          <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs leading-5">
                            <div><span className="font-semibold text-foreground">Angle de réponse :</span> <span className="text-muted">{item.answer}</span></div>
                            <div><span className="font-semibold text-foreground">Preuve à mobiliser :</span> <span className="text-muted">{item.proof}</span></div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "Relances" && (
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <Card title="Suivi de la candidature" icon={CalendarDays}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-xs font-medium text-foreground">
                      Statut
                      <select
                        value={draft.status}
                        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand/50"
                      >
                        {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-foreground">
                      Date de prochaine action
                      <input
                        type="date"
                        value={draft.dueDate}
                        onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand/50"
                      />
                    </label>
                  </div>
                  <label className="mt-4 block space-y-1.5 text-xs font-medium text-foreground">
                    Prochaine action
                    <textarea
                      rows={3}
                      value={draft.nextAction}
                      onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))}
                      className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-brand/50"
                    />
                  </label>
                  <label className="mt-4 block space-y-1.5 text-xs font-medium text-foreground">
                    Notes
                    <textarea
                      rows={6}
                      value={draft.note}
                      onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="Compte rendu d'appel, nom du recruteur, prochaines étapes…"
                      className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-brand/50"
                    />
                  </label>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => patch(draft)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-brand-foreground transition hover:bg-brand-200 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Enregistrer
                    </button>
                    {message && <span className="text-xs text-muted">{message}</span>}
                  </div>
                </Card>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-brand/25 bg-brand-soft p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-text">Prochaine échéance</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{dueLabel(draft.dueDate)}</div>
                    <div className="mt-1 text-xs text-muted">{draft.dueDate || "Date non définie"}</div>
                  </div>
                  <div className="rounded-2xl border border-border p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><Target className="size-4 text-brand-text" /> Priorité actuelle</div>
                    <p className="mt-3 text-sm leading-6 text-muted">{selected.followup.nextAction}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-5">
                    <div className="text-xs font-semibold text-foreground">Conseil</div>
                    <p className="mt-2 text-xs leading-5 text-muted">Après chaque appel ou entretien, consigner ici le nom des interlocuteurs, ce qu'ils ont réellement demandé et la prochaine date. Le cockpit devient alors la mémoire unique de la candidature.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Gauge; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-faint"><Icon className="size-3.5 text-brand-text" /> {label}</div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{detail}</div>
    </div>
  );
}

function Card({ title, icon: Icon, accent = false, children }: { title: string; icon: typeof Gauge; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border p-5", accent ? "border-brand/25 bg-brand-soft/60" : "border-border bg-surface")}>
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="size-4 text-brand-text" /> {title}</div>
      {children}
    </div>
  );
}
