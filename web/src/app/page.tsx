import { JobPilotApp } from "@/components/jobpilot/jobpilot-app";
import { AccessGate } from "@/components/jobpilot/access-gate";
import { activeProfileId } from "@/lib/profile-request";
export const dynamic = "force-dynamic";
export default async function Page() { return <AccessGate><JobPilotApp profileId={await activeProfileId()} /></AccessGate>; }
