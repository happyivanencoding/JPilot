import { NextRequest } from "next/server";
import { findPersistedEvaluation } from "@/lib/evaluation-state";
import { listMobileTasks } from "@/lib/mobile-engine";
import { normalizeUrl } from "@/lib/posting-url.mjs";
import { activeProfileId } from "@/lib/profile-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const input = (req.nextUrl.searchParams.get("input") ?? "").trim();
  const profileId = await activeProfileId(req.nextUrl.searchParams.get("profileId"));
  if (!/^https?:\/\//i.test(input)) return Response.json({ done: false }, { status: 400 });

  const result=findPersistedEvaluation(profileId,input);
  if(result) return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  const task=listMobileTasks(profileId).find(t=>t.kind === "evaluate" && normalizeUrl(String(t.input.url)) === normalizeUrl(input) && ["queued","running","reconciling"].includes(t.status));
  return Response.json({done:false,taskId:task?.id || null,status:task?.status || "discovered"},{headers:{"Cache-Control":"no-store"}});
}
