import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { careerOpsRoot } from "@/lib/career-ops";
import { openAgentDockCodex, runAgentDockCodex, type AgentDockCodexRun } from "@/lib/agentdock-acp";

// Parse a CV (pasted text or an uploaded PDF) into clean cv.md markdown by running
// the USER'S OWN CLI headless — the web never ships a heavyweight parser, and the
// real CV NEVER leaves the machine (local-first, PII-safe). This route is a
// PROPOSER: it produces candidate markdown only; the actual write to cv.md happens
// via the existing POST /api/cv after the user confirms (propose-then-confirm).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Prefer the CANONICAL core mode (single source of truth — CLI + web parse CVs
// identically); fall back to the inline prompt until modes/cv-ingest.md lands
// (exactly how the explore route handles a missing discover.md).
function readCanonicalMode(): string | null {
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), "modes", "cv-ingest.md"), "utf8");
  } catch {
    return null;
  }
}

function ingestPrompt(source: string): string {
  const mode = readCanonicalMode();
  if (mode) {
    return `${mode}\n\n--- HEADLESS OUTPUT CONTRACT (the career-ops WEB is parsing your stream) ---\nFollow the mode above exactly. You are a PROPOSER running headless: emit ONLY the markdown between <<cv:start>> and <<cv:end>> (own lines, never in a code fence), then one <<cv:seed>>{...} line; or <<cv:error>>{"reason":"unreadable"} if you can't read it. Narrate one short line before <<cv:start>>.\n\n${source}`;
  }
  // Fallback mirrors the canonical examples/cv-example.md format (the SSOT the
  // project ships) so a web-parsed CV is the same shape as a hand-written one.
  return `You convert a person's CV into clean cv.md markdown that EXACTLY mirrors career-ops's reference format.

FORMAT (match exactly; omit a section if the source lacks it; INVENT NOTHING):
\`# CV -- {Full Name}\`
then bold contact lines directly under the title (no "Contact" section):
\`**Location:** …\` / \`**Email:** …\` / \`**LinkedIn:** …\` / \`**Portfolio:** …\` / \`**GitHub:** …\`
\`## Professional Summary\` — a 2-4 line summary, only from facts present.
\`## Work Experience\` — each role as: \`### {Company} -- {Location}\`, then \`**{Job Title}**\` on its own line, then \`{Start}-{End or Present}\` on its own line, then bullet points (preserve EVERY quantified achievement verbatim).
\`## Projects\` — flat bullets: \`- **{Name}** ({type}) -- {what + hero metric}\`.
\`## Education\` — flat bullets: \`- {Degree}, {Institution} ({year})\`.
\`## Skills\` — grouped bullets: \`- **{Category}:** {comma list}\`.
Use \`--\` (double hyphen), NEVER an em dash (ATS rule). Preserve every company/title/date/metric. Clean, don't rewrite — it's THEIR CV.

OUTPUT PROTOCOL:
- You are a PROPOSER: do NOT write any file. Emit ONLY the markdown wrapped EXACTLY between a line \`<<cv:start>>\` and a line \`<<cv:end>>\` (each on its own line, never inside a code fence).
- After \`<<cv:end>>\`, emit ONE more line: \`<<cv:seed>>{"title":"<their current/target role>","roles":["<3-5 role keywords>"],"location":"<their location or 'Remote'>"}\`
- If the source is unreadable or empty, emit ONLY: \`<<cv:error>>{"reason":"unreadable"}\` and stop.
- Narrate one short line BEFORE \`<<cv:start>>\` (e.g. "Reading your CV…").

${source}`;
}

const TEXT_SRC = (t: string) => `SOURCE (the user's CV, pasted as text — convert it):\n"""\n${t.slice(0, 24000)}\n"""`;
const exec=promisify(execFile);

export async function POST(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  let promptSource = "";
  let tempFile: string | null = null;

  try {
    if (ctype.includes("application/json")) {
      const body = (await req.json()) as { text?: string };
      const text = (body.text || "").trim();
      if (!text) return Response.json({ error: "empty cv text" }, { status: 400 });
      promptSource = TEXT_SRC(text);
    } else if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });
      const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".pdf").toLowerCase();
      const scratchRoot = path.join(careerOpsRoot(), ".career-ops-web");
      fs.mkdirSync(scratchRoot, { recursive: true });
      const dir = fs.mkdtempSync(path.join(scratchRoot, "cv-ingest-"));
      tempFile = path.join(dir, `cv${ext}`); // outside the repo, basename-only
      fs.writeFileSync(tempFile, Buffer.from(await file.arrayBuffer()), { mode: 0o600 }); // PII → owner-only
      const extracted=await exec(process.env.JOBPILOT_PYTHON||"python",[path.join(careerOpsRoot(),"web","scripts","extract-mobile-cv.py"),tempFile],{timeout:45_000,windowsHide:true,encoding:"utf8",maxBuffer:1024*1024,env:{...process.env,PYTHONIOENCODING:"utf-8"}});
      const text=String(extracted.stdout||"").trim();
      if(!text) throw new Error("Aucun texte extrait du CV.");
      promptSource = TEXT_SRC(text);
    } else {
      return Response.json({ error: "unsupported content-type" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const prompt = ingestPrompt(promptSource);
  let connection: Awaited<ReturnType<typeof openAgentDockCodex>>;
  try {
    connection = await openAgentDockCodex();
  } catch (e) {
    if (tempFile) cleanupTemp(tempFile);
    return Response.json({ error: `AgentDock ACP / Codex indisponible : ${e instanceof Error ? e.message : "connexion impossible"}` }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let cancelled = false;
  let activeRun: AgentDockCodexRun | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let emitted = false;
      const safeClose = () => {
        if (!closed) {
          closed = true;
          if (tempFile) cleanupTemp(tempFile);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      // Every write goes through here: guarded on `closed` AND try/catch'd, so a
      // lost race with cancel()/close can never throw out of an EventEmitter cb.
      const safeEnqueue = (s: string): boolean => {
        if (closed || !s) return false;
        try {
          controller.enqueue(encoder.encode(s));
          return true;
        } catch {
          closed = true; // controller already closed underneath us — stop, never crash
          return false;
        }
      };
      const emit = (s: string) => {
        if (safeEnqueue(s)) emitted = true;
      };

      void runAgentDockCodex({
        client: connection.client,
        prompt,
        cwd: careerOpsRoot(),
        mode: "read-only",
        model: "gpt-5.6-luna",
        reasoning: "medium",
        timeoutMs: 240_000,
        onText: emit,
        onRun: (run) => { activeRun = run; },
        isCancelled: () => cancelled,
      })
        .then(() => {
          if (!emitted && !cancelled) safeEnqueue("<<cv:error>>{\"reason\":\"no-output\"}");
          safeClose();
        })
        .catch((error) => {
          if (!cancelled) safeEnqueue(`<<cv:error>>{\"reason\":${JSON.stringify(error instanceof Error ? error.message : "agentdock-error")}}`);
          safeClose();
        });
    },
    cancel() {
      cancelled = true;
      closed = true;
      if (activeRun) void activeRun.cancel();
      if (tempFile) cleanupTemp(tempFile);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "X-Career-Ops-AI": "agentdock-acp-codex" },
  });
}

function cleanupTemp(file: string) {
  try {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}
