import { NextResponse } from "next/server";
import fs from "node:fs";
import { saveCanonicalCv } from "@/lib/mobile-history";
import { profileFile } from "@/lib/profile-context";
import { activeProfileId } from "@/lib/profile-request";
import { startMobileTask } from "@/lib/mobile-engine";
import { requestUiLocale } from "@/lib/language-contract.mjs";

const MAX_CV_BYTES = 200_000;

export async function GET(req: Request) {
  const profileId = await activeProfileId(new URL(req.url).searchParams.get("profileId"));
  const file = profileFile(profileId, "cv");
  try {
    return NextResponse.json({ content: fs.readFileSync(file, "utf8"), exists: true });
  } catch {
    return NextResponse.json({ content: "", exists: false });
  }
}

export async function POST(req: Request) {
  const profileId = await activeProfileId(new URL(req.url).searchParams.get("profileId"));
  const file = profileFile(profileId, "cv");
  let body: { content?: string; expectedVersionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_CV_BYTES) {
    return NextResponse.json({ error: "CV is too large (over 200KB)" }, { status: 413 });
  }
  // DATA_CONTRACT: cv.md is user-layer and gitignored (no git recovery). Never
  // blind-overwrite — snapshot the prior CV to a .bak first, write atomically.
  try {
    const result = await saveCanonicalCv(profileId, body.content, body.expectedVersionId);
    const analysisTask=result.changed?await startMobileTask(profileId,{kind:"analysis",silent:true,source:"v1-auto-after-master-edit",uiLocale:requestUiLocale(req)}):null;
    return NextResponse.json({ ...result, backedUp: result.changed, analysisTaskId:analysisTask?.id || null, analysisState:analysisTask?.status || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "write failed" }, { status: 409 });
  }
}
