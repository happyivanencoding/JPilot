import { Suspense } from "react";
import { pipelineSummary } from "@/lib/career-ops";
import { PipelineView } from "@/components/pipeline-view";
import { activeProfileId } from "@/lib/profile-request";

export const dynamic = "force-dynamic"; // always read fresh local files

export default async function PipelinePage() {
  const profileId = await activeProfileId();
  const { inbox, applications } = pipelineSummary(profileId);
  return (
    <Suspense>
      <PipelineView applications={applications} inbox={inbox} />
    </Suspense>
  );
}
