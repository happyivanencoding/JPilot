import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  openAgentDockCodex,
  runAgentDockCodex,
  type AgentDockCodexMode,
  type AgentDockCodexModel,
  type AgentDockCodexReasoning,
  type AgentDockCodexRun,
} from "@/lib/agentdock-acp";

export type AcpWorkerEvent = {
  text?: string;
  tool?: string;
  status?: string;
  tokens?: number;
  costUsd?: number;
  error?: string;
  metrics?: Record<string, any>;
  execution?: {sessionId?:string;runId?:string;remoteSessionId?:string;workerPid?:number};
};

export function parseAcpWorkerEvent(line: string): AcpWorkerEvent | null {
  try {
    const value = JSON.parse(line) as AcpWorkerEvent;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function labelFromEvent(event: Record<string, unknown>): { tool?: string; status?: string } | null {
  const type = typeof event.type === "string" ? event.type : "";
  const update = event.update && typeof event.update === "object" ? (event.update as Record<string, unknown>) : {};
  const title =
    (typeof update.title === "string" && update.title) ||
    (typeof update.name === "string" && update.name) ||
    (typeof update.tool_name === "string" && update.tool_name) ||
    "";

  if (/tool/i.test(type) && title) return { tool: title };
  if (/plan|status|thought|reason/i.test(type) && title) return { status: title };
  return null;
}

export function startAgentDockWorker({
  prompt,
  cwd,
  mode,
  model,
  reasoning,
  timeoutMs,
}: {
  prompt: string;
  cwd: string;
  mode: AgentDockCodexMode;
  model: AgentDockCodexModel;
  reasoning: AgentDockCodexReasoning;
  timeoutMs: number;
}) {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let activeRun: AgentDockCodexRun | null = null;
  let cancelled = false;

  const write = (event: AcpWorkerEvent) => stdout.write(`${JSON.stringify(event)}\n`);

  queueMicrotask(() => {
    void (async () => {
      try {
        const { client, agent } = await openAgentDockCodex();
        write({ status: `AgentDock ACP · ${agent.title} ${agent.version} · ${model}` });
        const result = await runAgentDockCodex({
          client,
          prompt,
          cwd,
          mode,
          model,
          reasoning,
          timeoutMs,
          isCancelled: () => cancelled,
          onRun: (run) => {
            activeRun = run;
            write({execution:{sessionId:run.sessionId,runId:run.runId,remoteSessionId:run.remoteSessionId}});
          },
          onText: (text) => write({ text }),
          onMetrics: (metrics) => write({metrics,...(typeof metrics.totalTokens === "number" ? {tokens:metrics.totalTokens} : {})}),
          onEvent: (event) => {
            const label = labelFromEvent(event);
            if (label) write(label);
          },
        });
        if (!result.textEmitted) {
          throw new Error("AgentDock Codex ended without a final answer — the turn was interrupted or blocked by an interactive tool approval.");
        }
        stdout.end();
        stderr.end();
        emitter.emit("close", 0, null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        write({ error: message });
        stderr.write(`${message}\n`);
        stdout.end();
        stderr.end();
        emitter.emit("close", 1, null);
      }
    })();
  });

  return {
    stdout,
    stderr,
    kill: (_signal?: string) => {
      cancelled = true;
      if (activeRun) void activeRun.cancel();
      return true;
    },
    on: (event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
      return emitter;
    },
  };
}
