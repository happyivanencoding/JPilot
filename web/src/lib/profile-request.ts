import { cookies } from "next/headers";
import { normalizeProfileId, listProfiles, PROFILE_COOKIE } from "@/lib/profile-context";

export async function activeProfileId(explicit?: string | null): Promise<string> {
  if (explicit) {
    if (!listProfiles().some(p => p.id === explicit)) throw new Error("Profil inconnu.");
    return explicit;
  }
  const jar = await cookies();
  return normalizeProfileId(jar.get(PROFILE_COOKIE)?.value);
}
