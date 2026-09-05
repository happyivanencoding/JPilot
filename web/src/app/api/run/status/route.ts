import { NextRequest } from "next/server";
import { readApplications, readReport } from "@/lib/career-ops";
import { parseReport, scoreNum } from "@/lib/format";
import { activeProfileId } from "@/lib/profile-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const input = (req.nextUrl.searchParams.get("input") ?? "").trim();
  const profileId = await activeProfileId(req.nextUrl.searchParams.get("profileId"));
  if (!/^https?:\/\//i.test(input)) return Response.json({ done: false }, { status: 400 });

  for (const app of readApplications(profileId)) {
    const report = readReport(app.n);
    if (!report) continue;
    const meta = parseReport(report.content);
    const url = meta.fields.find((field) => field.label === "URL")?.value ?? "";
    if (url !== input) continue;
    return Response.json({
      done: true,
      reportNum: app.n,
      score: scoreNum(app.score),
      summary: app.notes || "Évaluation terminée et enregistrée dans le tracker.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ done: false }, { headers: { "Cache-Control": "no-store" } });
}
