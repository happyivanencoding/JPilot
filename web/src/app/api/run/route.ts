import { executeCoreRun } from "@/lib/core-run";
import { activeProfileId } from "@/lib/profile-request";
import { startMobileTask } from "@/lib/mobile-engine";
import { taskEventResponse } from "@/lib/mobile-task-stream";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;
export async function POST(req: Request) {
  let body: any;
  try { body = await req.clone().json(); } catch { return Response.json({error:"JSON invalide"},{status:400}); }
  if ((body.kind || "evaluate") !== "evaluate") return executeCoreRun(req);
  try {
    const profileId = await activeProfileId(body.profileId);
    const task = await startMobileTask(profileId,{kind:"evaluate",url:body.input});
    return taskEventResponse(profileId,task);
  } catch(error) { return Response.json({error:error instanceof Error?error.message:String(error)},{status:400}); }
}
