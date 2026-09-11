import { JobPilotApp } from "@/components/jobpilot/jobpilot-app";
import { activeProfileId } from "@/lib/profile-request";
export const dynamic = "force-dynamic";
export default async function Page() { return <JobPilotApp profileId={process.env.JOBPILOT_V1_PREVIEW === "1" ? "" : await activeProfileId()} preview={process.env.JOBPILOT_V1_PREVIEW === "1"} />; }
