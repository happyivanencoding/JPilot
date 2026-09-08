import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { agentDockToolResult, readAgentDockRpcResponse } from "./agentdock-result.mjs";
import { readCodexUsage, readCodexFinalAnswer, apiEquivalent } from "./ai-metrics.mjs";
import {productSessionWorkspace} from "./product-session-workspace.mjs";

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
  remoteSessionId?: string;
  cancel: () => Promise<void>;
};

export type AgentDockCodexModel =
  | "gpt-6-astra"
  | "gpt-5.6-sol"
  | "gpt-5.6-terra"
  | "gpt-5.6-luna"
  | "gpt-5.5"
  | "gpt-5.4"
  | "gpt-5.4-mini"
  | "gpt-5.3-codex-spark";

export type AgentDockCodexReasoning = "low" | "medium" | "high" | "xhigh" | "max";
export type AgentDockCodexMode = "read-only";

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

type WarmAcpSession = {
  client: McpClient;
  sessionId: string;
  remoteSessionId: string;
  createdAt: number;
};

// JobPilot deliberately runs one ACP prompt at a time. AgentDock/Codex can
// accept more globally, but concurrent JobPilot turns made session/new and
// model startup contend for minutes. Queue later mobile tasks instead.
const ACP_PROMPT_LIMIT = 1;
// Next can bundle this module once per route. Keep one queue per server process,
// not one independent limit in every route bundle.
const acpHost = globalThis as typeof globalThis & {
  careerOpsAcpQueue?: { active: number; waiters: Array<() => void> };
  careerOpsAcpRuntime?: {
    warm: WarmAcpSession[];
    createTail: Promise<void>;
    prewarm?: Promise<void>;
  };
};
const acpQueue = acpHost.careerOpsAcpQueue ??= { active: 0, waiters: [] };
const acpRuntime = acpHost.careerOpsAcpRuntime ??= { warm: [], createTail: Promise.resolve() };
const WARM_SESSION_MAX_AGE_MS = 8 * 60 * 60_000;

async function acquireAcpPromptSlot(): Promise<() => void> {
  if (acpQueue.active >= ACP_PROMPT_LIMIT) await new Promise<void>((resolve) => acpQueue.waiters.push(resolve));
  else acpQueue.active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = acpQueue.waiters.shift();
    if (next) next(); // Transfer the reserved slot directly to the waiting turn.
    else acpQueue.active = Math.max(0, acpQueue.active - 1);
  };
}

async function serializeSessionCreation<T>(fn: () => Promise<T>): Promise<T> {
  const previous = acpRuntime.createTail;
  let release!: () => void;
  acpRuntime.createTail = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => {});
  try { return await fn(); }
  finally { release(); }
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

  const operation=method==='tools/call'?`${String(params.name)}/${String((params.arguments as any)?.action || "")}`:method;
  const response = await fetch(client.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    // Session creation can include a cold Codex process startup; it is not a
    // normal short RPC. Keep ordinary calls bounded separately.
    // Real contention on this machine has produced 241–282s session creation.
    // Keep the request alive long enough to receive and close that session instead
    // of aborting at 150s and leaving an orphan AgentDock session behind.
    signal: AbortSignal.timeout(operation === "acp_session/new" ? 360000 : 45000),
  }).catch(error=>{throw new Error(`AgentDock ${operation}: ${error instanceof Error?error.message:String(error)}`);});

  const newSessionId = response.headers.get("Mcp-Session-Id");
  if (newSessionId) client.sessionId = newSessionId;
  if (!response.ok) throw new Error(`AgentDock MCP returned HTTP ${response.status}.`);
  if (notification) {await response.body?.cancel();return null;}

  const payload = await readAgentDockRpcResponse(response,body.id).catch(error=>{throw new Error(`AgentDock ${operation} response: ${error instanceof Error?error.message:String(error)}`);});
  if (payload?.error) throw new Error(payload.error.message || `AgentDock RPC error ${payload.error.code ?? "unknown"}.`);
  return payload?.result ?? null;
}

async function callTool(client: McpClient, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await rpc(client, "tools/call", { name, arguments: args });
  return agentDockToolResult(result) as Record<string, unknown>;
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

function sessionRecord(created: Record<string, unknown>, client: McpClient): WarmAcpSession {
  const session = created.session && typeof created.session === "object" ? created.session as Record<string, unknown> : {};
  const sessionId = String(session.id || created.session_id || "");
  if (!sessionId) throw new Error("AgentDock ACP did not return a session id.");
  return { client, sessionId, remoteSessionId: String(session.remote_session_id || ""), createdAt: Date.now() };
}

async function createAcpSession(client: McpClient, cwd: string): Promise<WarmAcpSession> {
  const created = await serializeSessionCreation(() => callTool(client, "acp_session", {
    action: "new",
    cwd: productSessionWorkspace(cwd),
    additional_directories: [],
  }));
  return sessionRecord(created, client);
}

function pruneWarmSessions() {
  const cutoff = Date.now() - WARM_SESSION_MAX_AGE_MS;
  const stale = acpRuntime.warm.filter((session) => session.createdAt < cutoff);
  acpRuntime.warm = acpRuntime.warm.filter((session) => session.createdAt >= cutoff);
  for (const session of stale) {
    void callTool(session.client, "acp_session", { action: "close", session_id: session.sessionId }).catch(() => {});
  }
}

function takeWarmSession(): WarmAcpSession | null {
  pruneWarmSessions();
  return acpRuntime.warm.shift() || null;
}

/**
 * Prepare one clean JobPilot ACP session without starting a model turn.
 * Mobile snapshot reads call this in the background so the next AI tap usually
 * consumes an already-created session instead of paying a cold session/new.
 */
export async function prewarmAgentDockCodex(cwd: string): Promise<void> {
  pruneWarmSessions();
  if (acpRuntime.warm.length || acpQueue.active > 0) return;
  if (acpRuntime.prewarm) return acpRuntime.prewarm;
  acpRuntime.prewarm = (async () => {
    const { client } = await openAgentDockCodex();
    const session = await createAcpSession(client, cwd);
    if (!acpRuntime.warm.length) acpRuntime.warm.push(session);
    else await callTool(client, "acp_session", { action: "close", session_id: session.sessionId }).catch(() => {});
  })().finally(() => { acpRuntime.prewarm = undefined; });
  return acpRuntime.prewarm;
}

/** Close only a caller-specified ACP session; used to clean known JobPilot orphans. */
export async function closeAgentDockSession(sessionId: string) {
  if (!/^acps_[a-f0-9]+$/.test(sessionId)) throw new Error("Invalid ACP session identifier.");
  const { client } = await openAgentDockCodex();
  await callTool(client, "acp_session", { action: "close", session_id: sessionId });
}

/** Observe an existing run only: never creates a session or starts a paid prompt. */
export async function observeAgentDockRun(runId: string) {
  if(!/^acpr_[a-f0-9]+$/.test(runId)) throw new Error("Invalid ACP run identifier.");
  const {client}=await openAgentDockCodex();
  let cursor=0,text="",truncated=false;
  let page: Record<string, any>={};
  for(let count=0;count<100;count++) {
    page=await callTool(client,"acp_prompt",{action:"events",run_id:runId,after_seq:cursor,limit:200,wait_ms:0});
    truncated ||= page.truncated === true;
    for(const event of Array.isArray(page.events)?page.events:[]) {
      if(event.type === "agent_message_chunk" && event.update?._meta?.codex?.phase === "final_answer" && event.update?.content?.type === "text") text+=event.update.content.text || "";
    }
    if(!page.has_more) return {status:String(page.status || "unknown"),text,completeHistory:!truncated,startedAt:page.started_at,endedAt:page.ended_at,error:page.message};
    cursor=Number(page.next_seq || cursor);
  }
  throw new Error("ACP event history exceeds the recovery bound; no new agent started.");
}

export async function inspectAgentDockModels(cwd: string) {
  fs.mkdirSync(cwd, { recursive: true });
  const { client, agent } = await openAgentDockCodex();
  const tools = await rpc(client, "tools/list", {});
  const created = await createAcpSession(client, cwd);
  try {
    return { agent, capabilities: { session: { id: created.sessionId, remote_session_id: created.remoteSessionId } }, tools: Array.isArray(tools?.tools) ? tools.tools.filter((t: any) => /^acp_/.test(t.name)) : [] };
  } finally {
    await callTool(client, "acp_session", { action: "close", session_id: created.sessionId });
  }
}

export async function runAgentDockCodex({
  client,
  prompt,
  cwd,
  onText,
  onEvent,
  onUsage,
  onMetrics,
  onFinalText,
  onRun,
  isCancelled,
  timeoutMs = 480_000,
  model = "gpt-5.6-luna",
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
  onMetrics?: (metrics: Record<string, any>) => void;
  onFinalText?: (text: string) => void;
  isCancelled?: () => boolean;
  timeoutMs?: number;
  model?: AgentDockCodexModel;
  reasoning?: AgentDockCodexReasoning;
  mode?: AgentDockCodexMode;
}): Promise<{ status: string; textEmitted: boolean }> {
  if (mode !== "read-only") throw new Error(`JobPilot ACP is transport-only; mode '${mode}' is not permitted.`);
  const requestedAt = Date.now();
  const metrics: Record<string, any> = { model, reasoning, transportOnly: true, queueMs: null, setupMs: null, agentMs: null,
    inputTokens: null, outputTokens: null, cachedInputTokens: null, reasoningTokens: null, totalTokens: null,
    actualCostUsd: null, estimatedCostUsd: null, tokenSource: "unavailable" };
  const releaseSlot = await acquireAcpPromptSlot();
  metrics.queueMs = Date.now() - requestedAt;
  const setupAt = Date.now();
  onMetrics?.({ ...metrics });
  if (isCancelled?.()) {
    releaseSlot();
    return { status: "cancelled", textEmitted: false };
  }

  let sessionId = "";
  let remoteSessionId = "";
  let runStartedAt = 0;
  let runEndedAt = 0;
  let runId = "";
  let textEmitted = false;
  let activeClient = client;
  const cancel = async () => {
    if (!runId) return;
    try {
      await callTool(activeClient, "acp_prompt", { action: "cancel", run_id: runId, session_id: sessionId });
    } catch {
      /* best effort — the run may already be settled */
    }
  };

  try {
    metrics.setupPhase="acquiring-session";onMetrics?.({...metrics});
    let prepared = takeWarmSession();
    if (!prepared && acpRuntime.prewarm) {
      await acpRuntime.prewarm.catch(() => {});
      prepared = takeWarmSession();
    }
    if (prepared) {
      activeClient = prepared.client;
      sessionId = prepared.sessionId;
      remoteSessionId = prepared.remoteSessionId;
      metrics.sessionSource = "prewarmed";
    } else {
      const created = await createAcpSession(client, cwd);
      activeClient = created.client;
      sessionId = created.sessionId;
      remoteSessionId = created.remoteSessionId;
      metrics.sessionSource = "fresh";
    }
    metrics.setupPhase="configuring-session";metrics.setupSessionId=sessionId;onMetrics?.({...metrics});

    const appliedModelResult = await callTool(activeClient, "acp_session", {
      action: "set_config",
      session_id: sessionId,
      config_id: "model",
      config_value: model,
    });
    const appliedReasoningResult = await callTool(activeClient, "acp_session", {
      action: "set_config",
      session_id: sessionId,
      config_id: "reasoning_effort",
      config_value: reasoning,
    });
    for (const [result, key, expected] of [[appliedModelResult, "model", model], [appliedReasoningResult, "reasoning_effort", reasoning]] as const) {
      const option = (result.config_options as Array<Record<string, unknown>> | undefined)?.find(o => o.id === key);
      if (!option || option.currentValue !== expected) throw new Error(`AgentDock did not apply ${key}=${expected}; refusing a mislabeled run.`);
    }
    const modeResult = await callTool(activeClient, "acp_session", {
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

    metrics.setupMs = Date.now() - setupAt;
    const externalQueueAt = Date.now();
    let started: Record<string, unknown>;
    for (;;) {
      try {
        started = await callTool(activeClient, "acp_prompt", { action: "start", session_id: sessionId, text: `JOBPILOT MODEL TRANSPORT ONLY. You have no authorized terminal, filesystem, web, browser, plugin, skill, sub-agent, image or other tool work to perform. Do not attempt tool calls, permission requests, repository reads, or environment inspection. Use only the data inside this prompt and return only the requested result.\n\n${prompt}` });
        if (!started.run_id && /concurrent|limit|busy/i.test(String(started.message || started.error_code))) throw new Error(String(started.message || started.error_code));
        break;
      } catch (error) {
        if (!/concurrent prompt limit|ACP.*busy/i.test(String(error)) || Date.now()-externalQueueAt > 600_000) throw error;
        if (isCancelled?.()) throw new Error("Operation cancelled while queued.");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    metrics.queueMs += Date.now() - externalQueueAt;
    metrics.setupPhase="ready";
    runStartedAt = Date.parse(String(started.started_at || "")) || Date.now();
    runId = typeof started.run_id === "string" ? started.run_id : "";
    if (!runId) {
      const detail =
        (typeof started.message === "string" && started.message) ||
        (typeof started.error_code === "string" && started.error_code) ||
        (typeof started.status === "string" && started.status) ||
        "no run id";
      throw new Error(`AgentDock ACP could not start the Codex turn: ${detail}.`);
    }
    onRun?.({ sessionId, runId, remoteSessionId, cancel });
    onMetrics?.({ ...metrics, startedAt: new Date(runStartedAt).toISOString() });

    let afterSeq = 0;
    let status = typeof started.status === "string" ? started.status : "running";
    const deadline = Date.now() + timeoutMs;

    let hasMore = true;
    while ((status === "running" || status === "queued" || hasMore) && Date.now() < deadline) {
      if (isCancelled?.()) {
        await cancel();
        return { status: "cancelled", textEmitted };
      }

      const page = await callTool(activeClient, "acp_prompt", {
        action: "events",
        run_id: runId,
        after_seq: afterSeq,
        limit: 200,
        wait_ms: 25_000,
      });
      if (typeof page.next_seq === "number") afterSeq = page.next_seq;
      if (typeof page.status === "string") status = page.status;
      hasMore = page.has_more === true;
      if(page.truncated)metrics.eventHistoryTruncated=true;
      if (page.ended_at) runEndedAt = Date.parse(String(page.ended_at)) || 0;

      const events = Array.isArray(page.events) ? page.events : [];
      for (const raw of events) {
        if (!raw || typeof raw !== "object") continue;
        const event = raw as Record<string, unknown>;
        onEvent?.(event);
        if (event.type === "usage_update") {
          const update = event.update && typeof event.update === "object" ? (event.update as Record<string, unknown>) : {};
          if (typeof update.used === "number") metrics.contextUsed = Math.max(metrics.contextUsed || 0, update.used);
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
    const finalText=readCodexFinalAnswer(remoteSessionId,new Date(runStartedAt || requestedAt).toISOString());
    if(finalText){if(!textEmitted){onText(finalText);textEmitted=true;}onFinalText?.(finalText);metrics.resultSource="exact-codex-session-final";}
    return { status, textEmitted };
  } finally {
    if (sessionId) {
      try {
        await callTool(activeClient, "acp_session", { action: "close", session_id: sessionId });
      } catch {
        /* the session may already be closed */
      }
    }
    if (runStartedAt) metrics.agentMs = Math.max(0, (runEndedAt || Date.now()) - runStartedAt);
    const usage = readCodexUsage(remoteSessionId, new Date(runStartedAt || requestedAt).toISOString());
    if (usage) Object.assign(metrics, usage);
    Object.assign(metrics, apiEquivalent(model, usage));
    metrics.wallMs = Date.now() - requestedAt;
    onMetrics?.({ ...metrics });
    releaseSlot();
    // Refill only after the current prompt has released its session. This avoids
    // competing session/new calls while a JobPilot model turn is still running.
    void prewarmAgentDockCodex(cwd).catch(() => {});
  }
}
