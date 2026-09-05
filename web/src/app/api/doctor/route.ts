import { doctorState } from "@/lib/career-ops";
import { activeProfileId } from "@/lib/profile-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The web has a selected candidate profile while the core CLI still has a single
// legacy user-layer. Use the same web doctorState as the home page so onboarding
// reflects the active candidate instead of whichever legacy files sit at root.
export async function GET() {
  const profileId = await activeProfileId();
  const state = doctorState(profileId);
  return Response.json({
    available: true,
    onboardingNeeded: state.onboardingNeeded,
    missing: state.missing,
    warnings: [],
  });
}
