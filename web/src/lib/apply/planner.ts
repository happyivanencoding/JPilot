import { openAgentDockCodex, runAgentDockCodex } from "@/lib/agentdock-acp";

/**
 * planner.ts - spawn the read-only planner CLI and collect what it wrote.
 *
 * Moved out of api/apply/prefill/route.ts unchanged. The route is a streaming
 * NDJSON handler wrapped around ~50 lines that are not about streaming at all:
 * choosing the CLI's argv, scaling the kill timer to the form size, and draining
 * stdout/stderr with a heartbeat. Those are planner concerns, and a second
 * caller cannot reuse them while they sit inside a ReadableStream's start().
 *
 * Everything here is a relocation. The argv, the Claude carve-out and its
 * reasoning, the timeout formula, the heartbeat interval, and the resolve-on-
 * error behaviour are byte-for-byte what the route did.
 */

/**
 * One form control, as much of it as the planner needs. Structurally satisfied
 * by ApplyField; kept separate so this module does not import extract.ts and
 * with it playwright-core.
 */
export type PlannerField = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
};

/**
 * A finished planner run. `code: null` with `signal: null` means the spawn
 * itself failed; the caller decides whether that is fatal, which is why this
 * resolves rather than rejecting.
 */
export type PlannerRun = { buf: string; code: number | null; signal: NodeJS.Signals | null };

export function runPlanner(opts: {
  prompt: string;
  fieldCount: number;
  cwd: string;
  /** Request start, so elapsed times in the log stay relative to the same t0 the caller reports. */
  t0: number;
  log: (m: string) => void;
}): Promise<PlannerRun> {
  const { prompt, fieldCount, cwd, t0, log } = opts;
  // Scale the timeout with form size (big forms = more drafting). Cap < maxDuration.
  const killMs = Math.min(300_000, 150_000 + fieldCount * 6_000);
  log(`AgentDock ACP planner (timeout ${Math.round(killMs / 1000)}s)…`);

  return (async (): Promise<PlannerRun> => {
    let buf = "";
    let firstByteAt = 0;
    const hb = setInterval(() => {
      log(`…running ${Math.round((Date.now() - t0) / 1000)}s · ${buf.length} chars received`);
    }, 4000);
    try {
      const { client } = await openAgentDockCodex();
      await runAgentDockCodex({
        client,
        prompt,
        cwd,
        mode: "read-only",
        model: "gpt-5.6-luna",
        reasoning: "medium",
        timeoutMs: killMs,
        onText: (text) => {
          if (!firstByteAt) {
            firstByteAt = Date.now();
            log(`first output at ${Math.round((firstByteAt - t0) / 1000)}s`);
          }
          buf += text;
        },
      });
      return { buf, code: 0, signal: null };
    } catch (error) {
      log(`AgentDock planner error: ${error instanceof Error ? error.message : String(error)}`);
      return { buf, code: 1, signal: null };
    } finally {
      clearInterval(hb);
    }
  })();
}
