import { cookies } from "next/headers";
import { normalizeProfileId, PROFILE_COOKIE } from "@/lib/profile-context";

export async function activeProfileId(explicit?: string | null): Promise<string> {
  if (explicit) return normalizeProfileId(explicit);
  const jar = await cookies();
  return normalizeProfileId(jar.get(PROFILE_COOKIE)?.value);
}
