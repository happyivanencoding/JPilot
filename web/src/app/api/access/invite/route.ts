import { NextResponse } from "next/server";

// The preview accepts JPILOT10 when no server-side list is configured. In production,
// set JOBPILOT_INVITE_CODES to a comma-separated, expiring/rotated list or replace
// this adapter with the product's invitation database.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const configured = (process.env.JOBPILOT_INVITE_CODES || "JPILOT10").split(",").map(value => value.trim().toUpperCase()).filter(Boolean);
  if (!code || !configured.includes(code)) return NextResponse.json({ ok: false, error: "邀请码无效或已失效，请联系邀请你的团队。" }, { status: 400 });
  return NextResponse.json({ ok: true, preview: !process.env.JOBPILOT_INVITE_CODES });
}
