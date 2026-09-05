import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readMemory } from "@/lib/career-ops";
import { getSession } from "@/lib/apply/session";
import { buildAnswerPrompt } from "@/lib/apply/answer-prompt.mjs";
import { runPlanner } from "@/lib/apply/planner";
import { extractJsonObject } from "@/lib/extract-json-object.mjs";
import { getProfile, profileRelativeFile } from "@/lib/profile-context";
import { activeProfileId } from "@/lib/profile-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 320;

// AI pre-fill (STREAMING NDJSON). The user's BYO CLI (read-only PLANNER — no
// browser access) drafts an answer per field from cv.md / profile / the job's
// report. We stream a live diagnostic log of every step (spawn, heartbeats,
// exit code/signal, parse outcome) so a stuck/empty prefill is observable on the
// page AND written to <root>/.career-ops-web/apply-prefill.log for debugging.
export async function POST(req: Request) {
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { sessionId } = body;
  const profileId = await activeProfileId();
  const profile = getProfile(profileId);
  const t0 = Date.now();
  const encoder = new TextEncoder();
  const logPath = path.join(careerOpsRoot(), ".career-ops-web", "apply-prefill.log");
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
  } catch {
    /* ignore */
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* client gone */
        }
      };
      const log = (m: string) => {
        const el = Date.now() - t0;
        emit({ t: "log", m, el });
        try {
          fs.appendFileSync(logPath, `${new Date(t0 + el).toISOString()} [+${(el / 1000).toFixed(1)}s] ${m}\n`);
        } catch {
          /* ignore */
        }
      };
      const fail = (m: string, raw?: string) => {
        log(`ERROR: ${m}`);
        emit({ t: "error", m, raw });
        controller.close();
      };
      try {
        fs.appendFileSync(logPath, `\n===== prefill ${new Date(t0).toISOString()} session=${sessionId} runtime=agentdock-acp-codex =====\n`);
      } catch {
        /* ignore */
      }

      const s = sessionId ? getSession(sessionId) : undefined;
      if (!s) return fail("apply session not found (it may have expired)");

      const mem = readMemory(profileId).trim();
      const prompt = buildAnswerPrompt({
        title: s.title,
        fields: s.fields,
        memory: mem,
        profile: {
          name: profile.name,
          cvPath: profileRelativeFile(profileId, "cv"),
          configPath: profileRelativeFile(profileId, "config"),
          notesPath: profileRelativeFile(profileId, "notes"),
        },
      });

      log(`Form: "${s.title}" · ${s.fields.length} fields · prompt ${prompt.length} chars · memory ${mem.length} chars`);
      log("Planner: AgentDock ACP → Codex");

      const result = await runPlanner({
        prompt,
        fieldCount: s.fields.length,
        cwd: careerOpsRoot(),
        t0,
        log,
      });

      log(`Planner exited code=${result.code} signal=${result.signal} · ${result.buf.length} chars total`);
      log(`output head: ${result.buf.slice(0, 100).replace(/\s+/g, " ") || "(empty)"}`);
      log(`output tail: ${result.buf.slice(-100).replace(/\s+/g, " ") || "(empty)"}`);

      if (!result.buf.trim()) {
        return fail(result.signal ? "planner was killed before producing any output (try again / smaller form)" : "planner produced no output (check the CLI works in this folder)");
      }

      const { obj, truncated } = extractJsonObject(result.buf);
      if (!obj) {
        return fail(
          result.signal ? "planner was killed mid-answer (form too large/slow) — couldn't recover any fields" : "couldn't parse the planner's answer as JSON",
          result.buf.slice(-300),
        );
      }
      const count = Object.keys(obj).length;
      log(`Parsed ${count} answers${truncated ? " (RECOVERED from truncated output — some fields may be missing)" : ""}`);
      emit({ t: "done", answers: obj, truncated, count });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
