import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { DEFAULT_FILTERS, cleanChips, type ExploreFilters } from "@/lib/explore";
import { profileTargetKeywords } from "@/lib/profile-keywords.mjs";
import { profileFile } from "@/lib/profile-context";

/**
 * ACL for portals.yml — the core's scan-filter config (a CONTRACT entry-point,
 * see reference_web_core_sync_protocol). The Explorer NEVER mutates the user's
 * real portals.yml: it writes an EPHEMERAL filter file and points the scanner at
 * it via CAREER_OPS_PORTALS, so an ad-hoc search can't clobber the curated config.
 * We also read the real portals.yml + config/profile.yml (tolerantly) only to
 * SEED sensible defaults for the first search.
 *
 * Filter semantics mirror scan.mjs::buildTitleFilter / buildLocationFilter:
 *   title positive → substring match (empty = everything matches)
 *   title negative → substring reject
 *   location block_hard > always_allow > block > allow (case-insensitive substring);
 *   block_hard is the one tier always_allow cannot override (scan.mjs, #2956)
 */
type FilterLists = Pick<ExploreFilters, "positive" | "negative" | "allow" | "block" | "alwaysAllow" | "blockHard">;

function listFrom(v: unknown): string[] {
  return cleanChips(v);
}

// serializePortals lives in portals-serialize.mjs (pure, no TS deps) so the web
// `node --test` suite can load it — the block_hard round-trip (#3102) is exactly
// a "don't silently drop a tier" property that has to be asserted, not eyeballed.
export { serializePortals } from "./portals-serialize.mjs";
import { serializePortals } from "./portals-serialize.mjs";

/** Write the ephemeral filter file to a temp path; caller cleans it up. */
export function writeTempPortals(f: FilterLists): string {
  const file = path.join(os.tmpdir(), `career-ops-explore-${randomUUID()}.yml`);
  fs.writeFileSync(file, serializePortals(f), "utf8");
  return file;
}

export function cleanupTempPortals(file: string): void {
  try {
    if (file.startsWith(os.tmpdir()) && file.includes("career-ops-explore-")) fs.unlinkSync(file);
  } catch {
    /* best-effort */
  }
}

function loadYamlFile(file: string): Record<string, unknown> | null {
  try {
    const doc = yaml.load(fs.readFileSync(file, "utf8"));
    return doc && typeof doc === "object" ? (doc as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function loadYaml(rel: string): Record<string, unknown> | null {
  return loadYamlFile(path.join(careerOpsRoot(), rel));
}

/**
 * Tolerantly seed first-search defaults from the active candidate profile plus
 * shared scanner configuration. `target_roles` is candidate-specific and MUST
 * win over the shared portals.yml title positives; otherwise switching Profile
 * silently keeps searching for the previous candidate's market. portals.yml
 * still supplies shared negative/location filters and is the fallback source of
 * positive keywords only when the active profile has no target roles.
 */
export function seedExploreFilters(profileId?: string): { filters: ExploreFilters; seededFrom: string[] } {
  const filters: ExploreFilters = { ...DEFAULT_FILTERS, ats: [...DEFAULT_FILTERS.ats] };
  const seededFrom: string[] = [];

  const fromRoles = listFrom(profileTargetKeywords(loadYamlFile(profileFile(profileId, "config"))));
  if (fromRoles.length) {
    filters.positive = fromRoles;
    seededFrom.push("profile.yml");
  }

  const portals = loadYaml("portals.yml");
  if (portals) {
    const tf = (portals.title_filter ?? {}) as Record<string, unknown>;
    const lf = (portals.location_filter ?? {}) as Record<string, unknown>;
    if (filters.positive.length === 0) {
      filters.positive = listFrom(tf.positive);
      filters.negative = listFrom(tf.negative);
    }
    filters.allow = listFrom(lf.allow);
    filters.block = listFrom(lf.block);
    filters.alwaysAllow = listFrom(lf.always_allow);
    filters.blockHard = listFrom(lf.block_hard);
    if (
      (fromRoles.length === 0 && filters.positive.length > 0) ||
      filters.allow.length ||
      filters.block.length ||
      filters.blockHard.length
    ) {
      seededFrom.push("portals.yml");
    }
  }

  return { filters, seededFrom };
}

export { listFrom as normalizeKeywords };
