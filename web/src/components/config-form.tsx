"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CadenceSettings } from "@/components/followups/cadence-settings";

const STORAGE_KEY = "career-ops:config";

export function ConfigForm() {
  const [logos, setLogos] = useState(true);
  const [saved, setSaved] = useState(false);

  // Load saved prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (typeof v.logos === "boolean") setLogos(v.logos);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ logos }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Réglages</h1>
      <p className="mt-1 text-sm text-muted">
        career-ops utilise AgentDock ACP et Codex directement sur votre ordinateur.
      </p>

      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Moteur IA
      </label>
      <div className="rounded-2xl border border-brand/30 bg-brand-soft p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
            <Terminal className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">AgentDock ACP → Codex</div>
            <div className="mt-0.5 text-xs text-muted">Moteur unique de toutes les fonctions IA du Web : recherche, évaluation, CV, assistant et candidature.</div>
          </div>
          <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Actif</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Aucun CLI à choisir dans career-ops et aucun login Claude séparé. L'authentification et les modèles sont gérés par AgentDock sur cette machine.
        </p>
      </div>

      {/* Appearance / privacy */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Appearance
      </label>
      <button
        type="button"
        onClick={() => setLogos((v) => !v)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Company logos</span>
          <span className="mt-0.5 block text-xs text-faint">
            Show each company&apos;s real logo. Fetched once through your local server and cached on
            disk — only the employer domain is sent to a third party. Off = colored monograms only.
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            logos ? "bg-brand" : "bg-surface-hover",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
              logos ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </span>
      </button>

      <CadenceSettings />

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 max-sm:min-h-[44px]"
        >
          {saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save config"}
        </button>
        <span className="text-xs text-faint">Local-first · on our roadmap</span>
      </div>
    </div>
  );
}
