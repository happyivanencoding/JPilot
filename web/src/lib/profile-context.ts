import fs from "node:fs";
import path from "node:path";

export const PROFILE_COOKIE = "career-ops-profile";
export const DEFAULT_PROFILE_ID = "default";

export type CareerProfile = {
  id: string;
  name: string;
  shortName: string;
  cvSourcePath?: string;
  cvMarkdown: string;
  config: string;
  notes: string;
  candidatures: string;
  legacyUntagged?: boolean;
};

type ProfileStore = {
  version: number;
  defaultProfileId: string;
  profiles: CareerProfile[];
};

function root(): string {
  const env = process.env.CAREER_OPS_ROOT?.trim();
  if (env) return env;
  return path.resolve(process.cwd(), "..");
}

function storePath(): string {
  return path.join(root(), "data", "profiles.json");
}

const FALLBACK_STORE: ProfileStore = {
  version: 1,
  defaultProfileId: DEFAULT_PROFILE_ID,
  profiles: [
    {
      id: DEFAULT_PROFILE_ID,
      name: "Default profile",
      shortName: "Default",
      cvMarkdown: "cv.md",
      config: "config/profile.yml",
      notes: "modes/_profile.md",
      candidatures: "data/candidatures.json",
      legacyUntagged: true,
    },
  ],
};

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(value);
}

export function readProfileStore(): ProfileStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), "utf8")) as ProfileStore;
    if (!Array.isArray(parsed?.profiles) || parsed.profiles.length === 0) return FALLBACK_STORE;
    const profiles = parsed.profiles.filter((p) => p && validId(p.id) && typeof p.name === "string");
    if (!profiles.length) return FALLBACK_STORE;
    const defaultProfileId = profiles.some((p) => p.id === parsed.defaultProfileId)
      ? parsed.defaultProfileId
      : profiles[0].id;
    return { version: 1, defaultProfileId, profiles };
  } catch {
    return FALLBACK_STORE;
  }
}

export function listProfiles(): CareerProfile[] {
  return readProfileStore().profiles;
}

export function normalizeProfileId(value?: string | null): string {
  const store = readProfileStore();
  if (value && validId(value) && store.profiles.some((profile) => profile.id === value)) return value;
  return store.defaultProfileId;
}

export function getProfile(value?: string | null): CareerProfile {
  const store = readProfileStore();
  if (value && !store.profiles.some(profile=>profile.id===value)) throw new Error("Profil inconnu.");
  const id = normalizeProfileId(value);
  return store.profiles.find((profile) => profile.id === id) ?? store.profiles[0];
}

export function profileFile(profileId: string | undefined, kind: "cv" | "config" | "notes" | "candidatures"): string {
  const profile = getProfile(profileId);
  const rel = kind === "cv" ? profile.cvMarkdown : kind === "config" ? profile.config : kind === "notes" ? profile.notes : profile.candidatures;
  return path.join(root(), rel);
}

export function profileRelativeFile(profileId: string | undefined, kind: "cv" | "config" | "notes"): string {
  const profile = getProfile(profileId);
  return kind === "cv" ? profile.cvMarkdown : kind === "config" ? profile.config : profile.notes;
}

export function profileTagFromNotes(notes: string): string | null {
  const match = String(notes || "").match(/(?:^|;\s*)profile:\s*([a-z0-9][a-z0-9_-]{0,39})(?=\s*(?:;|$))/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function applicationBelongsToProfile(notes: string, profileId: string): boolean {
  const profile = getProfile(profileId);
  const tagged = profileTagFromNotes(notes);
  if (tagged) return tagged === profile.id;
  return profile.legacyUntagged === true;
}
