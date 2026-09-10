import { cookies, headers } from "next/headers";
import { normalizeProfileId, listProfiles, PROFILE_COOKIE } from "@/lib/profile-context";

export async function allowedProfileIds(): Promise<string[] | null> {
  let requestHeaders;
  try { requestHeaders=await headers(); } catch { return null; }
  const raw=requestHeaders.get("x-jobpilot-profiles");
  if(!raw)return null;
  const known=new Set(listProfiles().map(profile=>profile.id));
  return [...new Set(raw.split(",").map(value=>value.trim()).filter(value=>known.has(value)))];
}

export async function activeProfileId(explicit?: string | null): Promise<string> {
  const allowed=await allowedProfileIds();
  if (explicit) {
    if (!listProfiles().some(p => p.id === explicit) || allowed && !allowed.includes(explicit)) throw new Error("Profil inconnu.");
    return explicit;
  }
  const jar = await cookies();
  const selected=normalizeProfileId(jar.get(PROFILE_COOKIE)?.value);
  if(!allowed || allowed.includes(selected))return selected;
  if(allowed.length)return allowed[0];
  throw new Error("Aucun profil autorisé.");
}
