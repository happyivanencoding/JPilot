import { NextRequest } from "next/server";
import { addOffersToPipeline } from "@/lib/backend/inbox";
import type { PipelineOffer } from "@/lib/backend/inbox";
import { activeProfileId } from "@/lib/profile-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Free + reversible: append chosen discovered offers to data/pipeline.md AND
// record them in data/scan-history.tsv, via the core's CANONICAL exported writers
// (no parallel writer). No tokens spent.
export async function POST(req: NextRequest) {
  let offers: PipelineOffer[] = [];
  try {
    const body = (await req.json()) as { offers?: PipelineOffer[] };
    offers = Array.isArray(body.offers) ? body.offers : [];
  } catch {
    return Response.json({ added: 0, error: "bad request" }, { status: 400 });
  }
  if (offers.length === 0) return Response.json({ added: 0 });

  const profileId = await activeProfileId(new URL(req.url).searchParams.get("profileId"));
  const result = await addOffersToPipeline(offers, profileId);
  return Response.json(result, { status: result.error ? 500 : 200 });
}
