"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { scoreTone } from "@/lib/format";
import { useProfile } from "@/components/profile/profile-provider";

export type JobStep = { kind: "tool" | "status"; label: string; ts: number };
export type JobResult = { score: number | null; summary: string; tone: "good" | "warn" | "bad" | "muted" };

export type Job = {
  id: string;
  title: string;
  subtitle?: string;
  page?: string; // route the job was launched from / refers to
  input?: string; // the URL/posting it processed (links inbox rows to their worker)
  kind?: string;
  batchId?: string; // groups jobs fired together (e.g. "evaluate all Anthropic")
  status: "running" | "done" | "error";
  steps: JobStep[];
  text: string;
  result?: JobResult;
  cost?: { tokens: number; usd?: number }; // per-run token cost (Claude result event) — local only
  startedAt: number;
  endedAt?: number;
};

type StartOpts = { title: string; subtitle?: string; kind: string; input: string; page?: string; batchId?: string };

type Ctx = {
  jobs: Job[];
  startJob: (opts: StartOpts) => string | null;
  removeJob: (id: string) => void;
  clearFinished: () => void;
};

const JobsContext = createContext<Ctx | null>(null);
export function useJobs() {
  const c = useContext(JobsContext);
  if (!c) throw new Error("useJobs must be used within <JobsProvider>");
  return c;
}

function parseVerdict(text: string): JobResult {
  const m = text.match(/VERDICT:\s*([\d.]+)\s*\/\s*5\s*[—:|-]+\s*(.+)/i);
  if (m) {
    const score = parseFloat(m[1]);
    return { score, summary: m[2].trim().replace(/\s+/g, " ").slice(0, 90), tone: scoreTone(`${score}`) };
  }
  const s = text.match(/\b([0-5](?:\.\d)?)\s*\/\s*5\b/);
  if (s) {
    const score = parseFloat(s[1]);
    return { score, summary: "", tone: scoreTone(`${score}`) };
  }
  return { score: null, summary: "", tone: "muted" };
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const { profileId, profile } = useProfile();
  const jobsKey = `career-ops:jobs:${profileId}`;
  const [jobs, setJobs] = useState<Job[]>([]);
  const seq = useRef(0);
  const loaded = useRef(false);

  // restore history
  useEffect(() => {
    let cancelled = false;
    const recover = async (job: Job) => {
      if (!job.input) return;
      for (;;) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/run/status?input=${encodeURIComponent(job.input)}&profileId=${encodeURIComponent(profileId)}`, { cache: "no-store" });
          const data = await res.json().catch(() => ({}));
          if (data.done) {
            const score = typeof data.score === "number" ? data.score : null;
            setJobs((current) => current.map((item) => item.id === job.id ? {
              ...item,
              status: "done",
              endedAt: Date.now(),
              result: { score, summary: String(data.summary || "").slice(0, 90), tone: scoreTone(score == null ? "" : `${score}`) },
              steps: [...(item.steps || []), { kind: "status", label: `Terminé en arrière-plan · rapport #${data.reportNum || "—"}`, ts: Date.now() }],
            } : item));
            return;
          }
        } catch {
          // The local server may still be restarting. Keep the worker pending;
          // the next poll is the useful check, not a synthetic connection error.
        }

        // /api/run gives evaluate at most 780s. Add a small reconciliation
        // margin, then stop claiming the detached run is still alive forever.
        if (Date.now() - job.startedAt > 14 * 60_000) {
          setJobs((current) => current.map((item) => item.id === job.id ? {
            ...item,
            status: "error",
            endedAt: Date.now(),
            steps: [...(item.steps || []), { kind: "status", label: "Aucun rapport final trouvé après l'évaluation en arrière-plan.", ts: Date.now() }],
          } : item));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
    };

    try {
      const raw = localStorage.getItem(jobsKey) ?? (profile.legacyUntagged ? localStorage.getItem("career-ops:jobs") : null);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) {
        // Before the ACP migration, failed workers could be permanently stored
        // with Claude/CLI login errors. They can never become useful history now
        // that the web no longer invokes those CLIs, so drop only those exact
        // stale failures on restore (the red cards shown in the old Explorer UI).
        const legacyCliAuth = /not logged in|please run \/login|no cli configured|sign your cli|the cli (?:exited|produced no output)/i;
        const restored = arr.filter((j: Job) => {
          if (j.status !== "error") return true;
          const labels = (j.steps || []).map((s) => s.label).join(" ");
          return !legacyCliAuth.test(`${j.text || ""} ${labels}`);
        });
        const recoverable = restored.filter((j: Job) => {
          if (j.kind !== "evaluate" || !j.input) return false;
          const labels = (j.steps || []).map((s) => s.label).join(" ");
          const diagnostic = `${labels} ${j.text || ""}`;
          return j.status === "running" || /Interrupted \(page reloaded\)|AgentDock Codex produced no output|ended without a final answer|Connection error/i.test(diagnostic);
        });
        const recoverIds = new Set(recoverable.map((j) => j.id));
        setJobs(restored.map((j: Job) => recoverIds.has(j.id) ? {
          ...j,
          status: "running",
          endedAt: undefined,
          steps: [...(j.steps || []), { kind: "status", label: "Évaluation poursuivie en arrière-plan · reconnexion…", ts: Date.now() }],
        } : j.status === "running" ? {
          ...j,
          status: "error",
          steps: [...(j.steps || []), { kind: "status", label: "Interrupted (page reloaded)", ts: Date.now() }],
        } : j));
        for (const job of recoverable) void recover(job);
      }
    } catch {
      /* ignore */
    }
    loaded.current = true;
    return () => { cancelled = true; };
  }, [jobsKey, profileId]);

  // persist
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(jobsKey, JSON.stringify(jobs.slice(0, 40)));
    } catch {
      /* quota */
    }
  }, [jobs, jobsKey]);

  const patch = useCallback((id: string, fn: (j: Job) => Job) => {
    setJobs((js) => js.map((j) => (j.id === id ? fn(j) : j)));
  }, []);

  const startJob = useCallback(
    (opts: StartOpts): string | null => {
      const id = `job-${Date.now()}-${seq.current++}`;
      const job: Job = {
        id,
        title: opts.title,
        subtitle: opts.subtitle,
        page: opts.page,
        input: opts.input,
        kind: opts.kind,
        batchId: opts.batchId,
        status: "running",
        steps: [{ kind: "status", label: "Starting…", ts: Date.now() }],
        text: "",
        startedAt: Date.now(),
      };
      setJobs((js) => [job, ...js]);

      (async () => {
        let text = "";
        let verdictLine = ""; // latched separately so the 8000-char tail can't drop it
        let doneTokens = 0; // per-run token cost, forwarded on the done event (#6)
        let doneCostUsd: number | null = null;
        const steps: JobStep[] = [];
        const finish = (status: "done" | "error", lastLabel?: string) => {
          const result = status === "done" ? parseVerdict(verdictLine || text) : undefined;
          const cost = status === "done" && doneTokens > 0 ? { tokens: doneTokens, usd: doneCostUsd ?? undefined } : undefined;
          patch(id, (j) => ({
            ...j,
            status,
            result,
            cost,
            endedAt: Date.now(),
            steps: lastLabel ? [...j.steps, { kind: "status", label: lastLabel, ts: Date.now() }] : j.steps,
          }));
          // persist a readable log file so the CLI/assistant can read past runs
          if (status === "done") {
            fetch("/api/runs/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, title: opts.title, subtitle: opts.subtitle, page: opts.page, input: opts.input, profileId, result, cost, steps, output: text }),
            }).catch(() => {});
            // Tell server-snapshot surfaces (Today, pipeline) to refetch — the
            // worker just wrote a real tracker row / report they don't yet see.
            if (typeof window !== "undefined" && (opts.kind === "evaluate" || opts.kind === "pdf")) {
              window.dispatchEvent(new CustomEvent("co-job-done", { detail: { kind: opts.kind, input: opts.input } }));
            }
          }
        };

        try {
          const res = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: opts.kind, input: opts.input, profileId }),
          });
          if (!res.ok || !res.body) {
            const e = await res.json().catch(() => ({}));
            finish("error", e.error || "Failed to start");
            return;
          }
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line) continue;
              try {
                const ev = JSON.parse(line);
                if (ev.type === "tool") {
                  steps.push({ kind: "tool", label: ev.name, ts: Date.now() });
                  patch(id, (j) => ({ ...j, steps: [...j.steps, { kind: "tool", label: ev.name, ts: Date.now() }] }));
                } else if (ev.type === "status") {
                  steps.push({ kind: "status", label: ev.label, ts: Date.now() });
                  patch(id, (j) => ({ ...j, steps: [...j.steps, { kind: "status", label: ev.label, ts: Date.now() }] }));
                } else if (ev.type === "text") {
                  const full = text + ev.text;
                  const vm = full.match(/VERDICT:[^\n]*/i);
                  if (vm) verdictLine = vm[0];
                  text = full.slice(-8000);
                  patch(id, (j) => ({ ...j, text }));
                } else if (ev.type === "done") {
                  // finish happens on stream-close; capture the per-run cost it carries
                  if (typeof ev.tokens === "number") doneTokens = ev.tokens;
                  if (typeof ev.costUsd === "number") doneCostUsd = ev.costUsd;
                } else if (ev.type === "error") {
                  finish("error", ev.msg || "Error");
                  return;
                }
              } catch {
                /* skip */
              }
            }
          }
          finish("done", "Done");
        } catch {
          finish("error", "Connection error");
        }
      })();

      return id;
    },
    [patch, profileId],
  );

  const removeJob = useCallback((id: string) => setJobs((js) => js.filter((j) => j.id !== id)), []);
  const clearFinished = useCallback(() => setJobs((js) => js.filter((j) => j.status === "running")), []);

  return <JobsContext.Provider value={{ jobs, startJob, removeJob, clearFinished }}>{children}</JobsContext.Provider>;
}
