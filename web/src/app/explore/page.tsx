import fs from "node:fs";
import * as yaml from "js-yaml";
import { ExplorerView } from "@/components/explore/explorer-view";
import { seedExploreFilters } from "@/lib/core/portals";
import { pipelineSummary, careerOpsRoot } from "@/lib/career-ops";
import { DEFAULT_FILTERS } from "@/lib/explore";
import { activeProfileId } from "@/lib/profile-request";
import { profileFile } from "@/lib/profile-context";

// Read live data at request time so a bare checkout (or `next build` with no
// CAREER_OPS_ROOT) never fails — discovery seeds are best-effort.
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const profileId = await activeProfileId();
  let seed: { filters: typeof DEFAULT_FILTERS; seededFrom: string[] } = { filters: DEFAULT_FILTERS, seededFrom: [] };
  let profileLocation = "Paris, France";
  try {
    seed = seedExploreFilters(profileId);
  } catch {
    /* bare checkout → defaults */
  }
  try {
    const parsed = yaml.load(fs.readFileSync(profileFile(profileId, "config"), "utf8"));
    const location = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).location
      : null;
    if (location && typeof location === "object" && !Array.isArray(location)) {
      const record = location as Record<string, unknown>;
      const city = typeof record.city === "string" ? record.city.trim() : "";
      const country = typeof record.country === "string" ? record.country.trim() : "";
      profileLocation = [city, country].filter(Boolean).join(", ") || profileLocation;
    }
  } catch {
    /* keep the neutral local default */
  }
  let rootExists = false;
  try {
    rootExists = fs.existsSync(careerOpsRoot());
  } catch {
    /* ignore */
  }
  const { inbox, applications } = pipelineSummary(profileId);
  return (
    <ExplorerView seed={seed} inboxSnapshot={inbox} appsSnapshot={applications} rootExists={rootExists} profileLocation={profileLocation} />
  );
}
