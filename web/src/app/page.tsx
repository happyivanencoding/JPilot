import { JobPilotApp } from "@/components/jobpilot/jobpilot-app";
import { activeProfileId } from "@/lib/profile-request";
export const dynamic = "force-dynamic";
export default async function Page() { return <JobPilotApp profileId={await activeProfileId()} />; }
