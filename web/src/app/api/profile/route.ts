import fs from "node:fs";
import * as yaml from "js-yaml";
import { atomicWriteWithBackup } from "@/lib/backend/files.mjs";
import { profileFile } from "@/lib/profile-context";
import { activeProfileId } from "@/lib/profile-request";
import { currentCandidateVersion, historyDirectory } from "@/lib/mobile-history";
import { CONTRACT_TYPES, withProfileLock } from "@/lib/mobile-state.mjs";
import { startMobileTask } from "@/lib/mobile-engine";
import { requestUiLocale } from "@/lib/language-contract.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Settings = Record<string, Record<string, unknown>>;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Map only product-editable preferences; other Candidate evidence remains untouched. */
function preferenceChanges(input: Record<string, unknown>): Settings {
  const changes: Settings = {};
  const set = (group: string, key: string, value: unknown) => {
    changes[group] ??= {};
    changes[group][key] = value;
  };
  for (const [key, target] of [["name", "full_name"], ["email", "email"], ["location", "location"]]) {
    if (typeof input[key] === "string" && input[key]) set("candidate", target, input[key]);
  }
  if (Array.isArray(input.roles) && input.roles.length) {
    if (input.roles.some(role => typeof role !== "string")) throw new Error("Invalid target roles");
    set("target_roles", "primary", input.roles.slice(0, 6));
  }
  if (input.contractTypes !== undefined) {
    if (!Array.isArray(input.contractTypes) || input.contractTypes.some(type => !CONTRACT_TYPES.includes(type))) throw new Error("Types de contrat invalides.");
    set("target_roles", "contract_types", [...new Set(input.contractTypes)]);
  }
  if (input.applicationLanguage !== undefined) {
    if (input.applicationLanguage !== "fr" && input.applicationLanguage !== "en") throw new Error("Invalid application language");
    set("cv", "language", input.applicationLanguage);
  }
  if (input.compMin && input.compMax) set("compensation", "target_range", `${input.compMin}-${input.compMax}`);
  if (input.currency) set("compensation", "currency", input.currency);
  if (input.remote) set("compensation", "location_flexibility", input.remote);
  return changes;
}

export async function POST(request: Request) {
  let changes: Settings;
  try {
    const input: unknown = await request.json();
    if (!object(input)) return Response.json({ error: "bad json" }, { status: 400 });
    changes = preferenceChanges(input);
    if (!Object.keys(changes).length) return Response.json({ error: "nothing to write" }, { status: 400 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "bad json" }, { status: 400 }); }

  const profileId = await activeProfileId(new URL(request.url).searchParams.get("profileId"));
  const file = profileFile(profileId, "config");
  const seeded = !fs.existsSync(file);
  const refreshV1=Boolean(changes.target_roles || changes.candidate?.location || changes.compensation?.location_flexibility);
  try {
    await withProfileLock(historyDirectory(profileId), () => {
      let previous: unknown;
      try { previous = fs.existsSync(file) ? yaml.load(fs.readFileSync(file, "utf8")) : {}; }
      catch { throw new SyntaxError("Profil YAML invalide ; aucune donnée remplacée."); }
      if (!object(previous)) throw new SyntaxError("Profil YAML invalide ; aucune donnée remplacée.");
      const updated = { ...previous };
      for (const [group, values] of Object.entries(changes)) updated[group] = { ...(object(previous[group]) ? previous[group] : {}), ...values };
      currentCandidateVersion(profileId);
      if (JSON.stringify(previous) !== JSON.stringify(updated)) atomicWriteWithBackup(file, yaml.dump(updated, { lineWidth: 100, noRefs: true }));
      currentCandidateVersion(profileId);
    });
    const analysisTask=refreshV1?await startMobileTask(profileId,{kind:"analysis",silent:true,retry:true,source:"v1-auto-after-intent-change",uiLocale:requestUiLocale(request)}):null;
    return Response.json({ ok: true, seeded, analysisTaskId:analysisTask?.id || null, analysisState:analysisTask?.status || null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "write failed" }, { status: error instanceof SyntaxError ? 409 : 500 });
  }
}
