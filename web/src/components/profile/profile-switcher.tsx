"use client";

import { ChevronDown, UserRound } from "lucide-react";
import { useProfile } from "@/components/profile/profile-provider";

export function ProfileSwitcher() {
  const { profileId, profile, profiles, switching, switchProfile } = useProfile();

  return (
    <div className="mb-5 px-1">
      <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
        Profil
      </div>
      <div className="relative">
        <div className="pointer-events-none flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface/70 px-3 shadow-sm backdrop-blur-xl transition-colors">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-hover text-brand-text">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{profile.shortName}</div>
            <div className="truncate text-[11px] text-faint">{switching ? "Changement…" : "Espace candidatures"}</div>
          </div>
          <ChevronDown className="size-4 shrink-0 text-faint" />
        </div>
        <select
          aria-label="Changer de profil candidat"
          value={profileId}
          disabled={switching}
          onChange={(event) => void switchProfile(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
        >
          {profiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
