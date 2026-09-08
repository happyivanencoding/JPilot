import { careerOpsRoot } from "@/lib/career-ops";
import { prewarmAgentDockCodex } from "@/lib/agentdock-acp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 380;

function loopbackOnly(req: Request) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const cloudflare = req.headers.get("cf-connecting-ip") || req.headers.get("cf-ray");
  return !cloudflare && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
}

export async function GET(req: Request) {
  if (!loopbackOnly(req)) return Response.json({ error: "loopback only" }, { status: 403 });
  const started = Date.now();
  try {
    await prewarmAgentDockCodex(careerOpsRoot());
    return Response.json({ ready: true, wallMs: Date.now() - started });
  } catch (error) {
    return Response.json({ ready: false, wallMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
