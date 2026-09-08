import { downloadTailoredCv } from "@/lib/tailored-cv";
import { activeProfileId } from "@/lib/profile-request";
import { startMobileTask } from "@/lib/mobile-engine";
import { taskEventResponse } from "@/lib/mobile-task-stream";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 420;
export async function GET(req: Request) { return downloadTailoredCv(req); }
export async function POST(req: Request) {
  try {
    const body=await req.json();const profileId=await activeProfileId(body.profileId);
    return taskEventResponse(profileId,await startMobileTask(profileId,{kind:"cv",jobId:body.id}));
  } catch(error) { return Response.json({error:error instanceof Error?error.message:String(error)},{status:400}); }
}
