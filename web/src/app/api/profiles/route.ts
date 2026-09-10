import { NextResponse } from "next/server";
import { activeProfileId, allowedProfileIds } from "@/lib/profile-request";
import { listProfiles, PROFILE_COOKIE } from "@/lib/profile-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const active = await activeProfileId();
  const allowed=await allowedProfileIds();
  const profiles=listProfiles().filter(profile=>!allowed || allowed.includes(profile.id));
  return NextResponse.json({
    activeProfileId: active,
    profiles: profiles.map(({ id, name, shortName, legacyUntagged }) => ({ id, name, shortName, legacyUntagged })),
  });
}

export async function POST(req: Request) {
  let body: { profileId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const allowed=await allowedProfileIds();
  const profile = listProfiles().find((item) => item.id === body.profileId && (!allowed || allowed.includes(item.id)));
  if (!profile) return NextResponse.json({ error: "Profil inconnu" }, { status: 404 });

  const response = NextResponse.json({ ok: true, activeProfileId: profile.id });
  response.cookies.set(PROFILE_COOKIE, profile.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
