"use client";

import { Compass, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { CostBadge } from "@/components/cost/cost-badge";
import type { ExploreMode } from "@/lib/explore";

// Cost honesty rendered at the point of choice: free deterministic Scan versus
// token-spending AgentDock ACP / Codex search.
export function ExploreModeToggle({ mode, onChange }: { mode: ExploreMode; onChange: (m: ExploreMode) => void }) {
  return (
    <div className="flex w-full rounded-xl border border-border bg-surface/40 p-1 sm:inline-flex sm:w-auto">
      <button
        type="button"
        onClick={() => onChange("scan")}
        aria-pressed={mode === "scan"}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition-colors sm:flex-none sm:gap-2 sm:px-3 max-sm:min-h-[44px]",
          mode === "scan" ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground",
        )}
      >
        <Compass className="size-4" />
        <span className="font-medium">Scan</span>
        <span className="hidden sm:inline-flex">
          <CostBadge kind="free-network" size="xs" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("ai")}
        aria-pressed={mode === "ai"}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition-colors sm:flex-none sm:gap-2 sm:px-3 max-sm:min-h-[44px]",
          mode === "ai" ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground",
        )}
      >
        <Sparkles className="size-4" />
        <span className="font-medium">Recherche IA</span>
        <span className="hidden sm:inline-flex">
          <CostBadge kind="spend" size="xs" />
        </span>
        <span className="hidden text-[10px] text-faint lg:inline">Codex via AgentDock</span>
      </button>
    </div>
  );
}
