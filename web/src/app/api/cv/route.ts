import { NextResponse } from "next/server";
import fs from "node:fs";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { profileFile } from "@/lib/profile-context";
import { activeProfileId } from "@/lib/profile-request";

const MAX_CV_BYTES = 200_000;

export async function GET() {
  const profileId = await activeProfileId();
  const file = profileFile(profileId, "cv");
  try {
    return NextResponse.json({ content: fs.readFileSync(file, "utf8"), exists: true });
  } catch {
    return NextResponse.json({ content: "", exists: false });
  }
}

export async function POST(req: Request) {
  const profileId = await activeProfileId();
  const file = profileFile(profileId, "cv");
  let body: { content?: string };
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
    const bak = atomicWriteWithBackup(file, body.content);
    return NextResponse.json({ ok: true, backedUp: !!bak });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
