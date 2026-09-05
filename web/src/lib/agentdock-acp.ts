import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const STARTUP_ENTROPY = "agentdock.startup.v1";

export type AgentDockCodexInfo = {
  name: string;
  title: string;
  version: string;
};

export type AgentDockCodexRun = {
  sessionId: string;
  runId: string;
  cancel: () => Promise<void>;
};

export type AgentDockCodexModel =
  | "gpt-5.6-sol"
  | "gpt-5.6-terra"
  | "gpt-5.6-luna"
  | "gpt-5.5"
  | "gpt-5.4"
  | "gpt-5.4-mini"
  | "gpt-5.3-codex-spark";

export type AgentDockCodexReasoning = "low" | "medium" | "high" | "xhigh" | "max";
export type AgentDockCodexMode = "read-only" | "agent" | "agent-full-access";

export type AgentDockCodexUsage = {
  used?: number;
  size?: number;
};

type RuntimeConfig = {
  local_mcp_url?: string;
};

type RpcPayload = {
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string };
};

type McpClient = {
  url: string;
  token: string;
  sessionId?: string;
  nextId: number;
};

// AgentDock's local Codex ACP currently accepts two prompt turns at once. The
// web can legitimately start more (e.g. scoring several Explorer cards), so
// keep excess turns queued in this one local server process instead of letting
// the third call fail with "ACP concurrent prompt limit reached".
const ACP_PROMPT_LIMIT = 2;
let activeAcpPrompts = 0;
const acpWaiters: Array<() => void> = [];

async function acquireAcpPromptSlot(): Promise<() => void> {
  if (activeAcpPrompts >= ACP_PROMPT_LIMIT) {
    await new Promise<void>((resolve) => acpWaiters.push(resolve));
  }
  activeAcpPrompts += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeAcpPrompts = Math.max(0, activeAcpPrompts - 1);
    const next = acpWaiters.shift();
    if (next) next();
  };
}

function agentDockRuntimeDir(): string {
  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (!localAppData) throw new Error("LOCALAPPDATA is unavailable; cannot locate AgentDock.");
  return path.join(localAppData, "AgentDock");
}

function readRuntime(): { url: string; authPath: string } {
  const runtimeDir = agentDockRuntimeDir();
  const runtimePath = path.join(runtimeDir, "runtime.json");
  let config: RuntimeConfig;
  try {
    config = JSON.parse(fs.readFileSync(runtimePath, "utf8")) as RuntimeConfig;
  } catch {
    throw new Error("AgentDock runtime.json is missing or unreadable.");
  }
  const url = config.local_mcp_url?.trim();
  if (!url) throw new Error("AgentDock local MCP URL is not configured.");
  return { url, authPath: path.join(runtimeDir, "auth-token.dpapi") };
}

function decryptLocalToken(authPath: string): string {
  if (process.platform !== "win32") {
    throw new Error("This AgentDock local bridge currently expects the Windows DPAPI runtime.");
  }

  const script = [
    "Add-Type -AssemblyName System.Security",
    "$enc=[IO.File]::ReadAllText($env:AGENTDOCK_AUTH_PATH,[Text.Encoding]::UTF8).Trim()",
    `$plain=[System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($enc),[Text.Encoding]::UTF8.GetBytes('${STARTUP_ENTROPY}'),[System.Security.Cryptography.DataProtectionScope]::CurrentUser)`,
    "[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))",
  ].join("; ");

  try {
    return execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5_000,
      env: { ...process.env, AGENTDOCK_AUTH_PATH: authPath },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error("Could not unlock the local AgentDock authentication token.");
  }
}

function parseRpcText(text: string): RpcPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("event:")) return JSON.parse(trimmed) as RpcPayload;

  const dataLines = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  if (!dataLines.length) return null;
  return JSON.parse(dataLines[dataLines.length - 1]) as RpcPayload;
}

async function rpc(client: McpClient, method: string, params: Record<string, unknown>, notification = false) {
  const body = notification
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id: ++client.nextId, method, params };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${client.token}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  if (client.sessionId) headers["Mcp-Session-Id"] = client.sessionId;

  const response = await fetch(client.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const newSessionId = response.headers.get("Mcp-Session-Id");
  if (newSessionId) client.sessionId = newSessionId;
  const text = await response.text();
  if (!response.ok) throw new Error(`AgentDock MCP returned HTTP ${response.status}.`);
  if (notification) return null;

  const payload = parseRpcText(text);
  if (payload?.error) throw new Error(payload.error.message || `AgentDock RPC error ${payload.error.code ?? "unknown"}.`);
  return payload?.result ?? null;
}

async function callTool(client: McpClient, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await rpc(client, "tools/call", { name, arguments: args });
  if (!result) return {};

  const structured = result.structuredContent;
  if (structured && typeof structured === "object" && !Array.isArray(structured)) {
    return structured as Record<string, unknown>;
  }

  const content = Array.isArray(result.content) ? result.content : [];
  const textPart = content.find((part) => part && typeof part === "object" && (part as { type?: string }).type === "text") as
    | { text?: string }
    | undefined;
  if (!textPart?.text) return {};
  try {
    const parsed = JSON.parse(textPart.text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function openAgentDockCodex(): Promise<{ client: McpClient; agent: AgentDockCodexInfo }> {
  const { url, authPath } = readRuntime();
  const token = decryptLocalToken(authPath);
  if (!token) throw new Error("AgentDock authentication token is empty.");

  const client: McpClient = { url, token, nextId: 0 };
  await rpc(client, "initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "career-ops-web", version: "1" },
  });
  await rpc(client, "notifications/initialized", {}, true);

  const info = await callTool(client, "acp_session", { action: "info" });
  const rawAgent = info.agent && typeof info.agent === "object" ? (info.agent as Record<string, unknown>) : {};
  const agent: AgentDockCodexInfo = {
    name: typeof rawAgent.name === "string" ? rawAgent.name : "",
    title: typeof rawAgent.title === "string" ? rawAgent.title : "",
    version: typeof rawAgent.version === "string" ? rawAgent.version : "",
  };
  if (agent.title !== "Codex" || !agent.name.includes("codex")) {
    throw new Error(`AgentDock ACP is configured for '${agent.title || agent.name || "unknown"}', not Codex.`);
  }
  return { client, agent };
}

export async function runAgentDockCodex({
  client,
  prompt,
  cwd,
  onText,
  onEvent,
  onUsage,
  onRun,
  isCancelled,
  timeoutMs = 480_000,
  model = "gpt-5.6-sol",
  reasoning = "medium",
  mode = "read-only",
}: {
  client: McpClient;
  prompt: string;
  cwd: string;
  onText: (text: string) => void;
  onEvent?: (event: Record<string, unknown>) => void;
  onUsage?: (usage: AgentDockCodexUsage) => void;
  onRun?: (run: AgentDockCodexRun) => void;
  isCancelled?: () => boolean;
  timeoutMs?: number;
  model?: AgentDockCodexModel;
  reasoning?: AgentDockCodexReasoning;
  mode?: AgentDockCodexMode;
}): Promise<{ status: string; textEmitted: boolean }> {
  const releaseSlot = await acquireAcpPromptSlot();
  if (isCancelled?.()) {
    releaseSlot();
    return { status: "cancelled", textEmitted: false };
  }

  let sessionId = "";
  let runId = "";
  let textEmitted = false;
  const cancel = async () => {
    if (!runId) return;
    try {
      await callTool(client, "acp_prompt", { action: "cancel", run_id: runId, session_id: sessionId });
    } catch {
      /* best effort — the run may already be settled */
    }
  };

  try {
    const created = await callTool(client, "acp_session", { action: "new", cwd });
    const sessionRecord = created.session && typeof created.session === "object" ? (created.session as Record<string, unknown>) : {};
    sessionId =
      (typeof sessionRecord.id === "string" && sessionRecord.id) ||
      (typeof created.session_id === "string" && created.session_id) ||
      "";
    if (!sessionId) throw new Error("AgentDock ACP did not return a session id.");

    await callTool(client, "acp_session", {
      action: "set_config",
      session_id: sessionId,
      config_id: "model",
      config_value: model,
    });
    await callTool(client, "acp_session", {
      action: "set_config",
      session_id: sessionId,
      config_id: "reasoning_effort",
      config_value: reasoning,
    });
    const modeResult = await callTool(client, "acp_session", {
      action: "set_config",
      session_id: sessionId,
      config_id: "mode",
      config_value: mode,
    });
    const modeOptions = Array.isArray(modeResult.config_options) ? modeResult.config_options : [];
    const appliedMode = modeOptions.find((option) => option && typeof option === "object" && (option as Record<string, unknown>).id === "mode") as Record<string, unknown> | undefined;
    if (appliedMode && appliedMode.currentValue !== mode) {
      throw new Error(`AgentDock ACP did not apply requested mode '${mode}'.`);
    }

    const started = await callTool(client, "acp_prompt", { action: "start", session_id: sessionId, text: prompt });
    runId = typeof started.run_id === "string" ? started.run_id : "";
    if (!runId) {
      const detail =
        (typeof started.message === "string" && started.message) ||
        (typeof started.error_code === "string" && started.error_code) ||
        (typeof started.status === "string" && started.status) ||
        "no run id";
      throw new Error(`AgentDock ACP could not start the Codex turn: ${detail}.`);
    }
    onRun?.({ sessionId, runId, cancel });

    let afterSeq = 0;
    let status = typeof started.status === "string" ? started.status : "running";
    const deadline = Date.now() + timeoutMs;

    while ((status === "running" || status === "queued") && Date.now() < deadline) {
      if (isCancelled?.()) {
        await cancel();
        return { status: "cancelled", textEmitted };
      }

      const page = await callTool(client, "acp_prompt", {
        action: "events",
        run_id: runId,
        after_seq: afterSeq,
        limit: 200,
        wait_ms: 25_000,
      });
      if (typeof page.next_seq === "number") afterSeq = page.next_seq;
      if (typeof page.status === "string") status = page.status;

      const events = Array.isArray(page.events) ? page.events : [];
      for (const raw of events) {
        if (!raw || typeof raw !== "object") continue;
        const event = raw as Record<string, unknown>;
        onEvent?.(event);
        if (event.type === "usage_update") {
          const update = event.update && typeof event.update === "object" ? (event.update as Record<string, unknown>) : {};
          onUsage?.({
            used: typeof update.used === "number" ? update.used : undefined,
            size: typeof update.size === "number" ? update.size : undefined,
          });
          continue;
        }
        if (event.type !== "agent_message_chunk") continue;
        const update = event.update && typeof event.update === "object" ? (event.update as Record<string, unknown>) : {};
        const meta = update._meta && typeof update._meta === "object" ? (update._meta as Record<string, unknown>) : {};
        const codex = meta.codex && typeof meta.codex === "object" ? (meta.codex as Record<string, unknown>) : {};
        if (codex.phase !== "final_answer") continue;
        const content = update.content && typeof update.content === "object" ? (update.content as Record<string, unknown>) : {};
        if (content.type !== "text" || typeof content.text !== "string" || !content.text) continue;
        textEmitted = true;
        onText(content.text);
      }
    }

    if (status === "running" || status === "queued") {
      await cancel();
      throw new Error(`AgentDock Codex timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    if (status !== "completed") {
      throw new Error(`AgentDock Codex run ended with status '${status}'.`);
    }
    return { status, textEmitted };
  } finally {
    if (sessionId) {
      try {
        await callTool(client, "acp_session", { action: "close", session_id: sessionId });
      } catch {
        /* the session may already be closed */
      }
    }
    releaseSlot();
  }
}
