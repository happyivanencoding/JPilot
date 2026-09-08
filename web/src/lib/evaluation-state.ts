import fs from "node:fs";
import { readApplications, readReport } from "@/lib/career-ops";
import { profileFile } from "@/lib/profile-context";
import { parseReport, scoreNum } from "@/lib/format";
import { normalizeUrl } from "@/lib/core/url-key.mjs";
import { persistedJobEvaluation } from "@/lib/mobile-state.mjs";

/** One authority: profile-filtered tracker/reports, then existing curated candidature analysis. */
export function findPersistedEvaluation(profileId: string, input: string): Record<string, any> | null {
  const key = normalizeUrl(input);
  if (!key) return null;
  let jobs: Array<Record<string, any>> = [];
  const file = profileFile(profileId, "candidatures");
  if (fs.existsSync(file)) jobs = JSON.parse(fs.readFileSync(file, "utf8")).jobs || [];
  const job = jobs.find(j => normalizeUrl(j.url) === key);
  for (const app of [...readApplications(profileId)].sort((a,b) => Number(b.n)-Number(a.n))) {
    const report = readReport(app.n);
    if (!report) continue;
    const meta = parseReport(report.content);
    if (normalizeUrl(meta.fields.find(f => f.label === "URL")?.value || "") !== key) continue;
    const score = scoreNum(app.score);
    if (score === null || !Number.isFinite(score)) continue;
    return { done: true, reportNum: app.n, score, jobId: job?.id || null,
      summary: app.notes || "Évaluation enregistrée dans le tracker.", source: "official-report" };
  }
  if (persistedJobEvaluation(job)) return { done: true, reportNum: job!.reportNum || null,
    score: job!.score, jobId: job!.id, summary: job!.summary, source: "canonical-candidature" };
  return null;
}
