import fs from "node:fs";
import path from "node:path";
import { atomicWrite } from "@/lib/backend/files.mjs";
import { workspaceRoot } from "@/lib/backend/workspace";
import { normalizeUrl } from "@/lib/posting-url.mjs";

function cacheFile() {
  return path.join(workspaceRoot(), ".career-ops-web", "job-intelligence", "v1.json");
}
function readCache(): Record<string, any> {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile(), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error: any) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}
const clean = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function readJobIntelligence(url: string) {
  const key = normalizeUrl(url);
  return key ? readCache()[key] || null : null;
}

export function writeJobIntelligence(url: string, deepMatch: Record<string, any>) {
  const key = normalizeUrl(url);
  if (!key) return null;
  const entry = {
    url: key,
    roleSummary: clean(deepMatch?.roleSummary, 1800),
    responsibilities: Array.isArray(deepMatch?.responsibilities) ? deepMatch.responsibilities.map((x: unknown) => clean(x, 700)).filter(Boolean).slice(0, 6) : [],
    requirements: Array.isArray(deepMatch?.requirements) ? deepMatch.requirements.map((x: any) => ({ title: clean(x?.title, 220), kind: x?.kind === "must" ? "must" : "nice", why: clean(x?.why, 900) })).filter((x: any) => x.title).slice(0, 8) : [],
    tools: Array.isArray(deepMatch?.tools) ? deepMatch.tools.map((x: unknown) => clean(x, 120)).filter(Boolean).slice(0, 12) : [],
    updatedAt: new Date().toISOString(),
  };
  const file = cacheFile();
  const cache = readCache();
  cache[key] = entry;
  atomicWrite(file, JSON.stringify(cache, null, 2) + "\n");
  return entry;
}
