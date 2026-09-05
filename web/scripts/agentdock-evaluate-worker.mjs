import process from "node:process";

function write(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function eventLabel(event) {
  const type = typeof event?.type === "string" ? event.type : "";
  const update = event?.update && typeof event.update === "object" ? event.update : {};
  const title =
    (typeof update.title === "string" && update.title) ||
    (typeof update.name === "string" && update.name) ||
    (typeof update.tool_name === "string" && update.tool_name) ||
    "";
  if (/tool/i.test(type) && title) return { tool: title };
  if (/plan|status|thought|reason/i.test(type) && title) return { status: title };
  return null;
}

async function readStdin() {
  let text = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

const [, , cwd = "", timeoutRaw = "780000"] = process.argv;
const timeoutMs = Number(timeoutRaw) || 780_000;
const prompt = await readStdin();
if (!cwd || !prompt) {
  write({ error: "Detached AgentDock evaluate worker is missing cwd or prompt." });
  process.exit(2);
}

try {
  const mod = await import(new URL("../src/lib/agentdock-acp.ts", import.meta.url));
  const queueDeadline = Date.now() + 10 * 60_000;
  for (;;) {
    try {
      const { client, agent } = await mod.openAgentDockCodex();
      write({ status: `AgentDock ACP · ${agent.title} ${agent.version} · gpt-5.6-sol` });
      let lastUsed = 0;
      const result = await mod.runAgentDockCodex({
        client,
        prompt,
        cwd,
        mode: "agent-full-access",
        model: "gpt-5.6-sol",
        reasoning: "medium",
        timeoutMs,
        onText: (text) => write({ text }),
        onUsage: (usage) => {
          if (typeof usage.used === "number") lastUsed = usage.used;
        },
        onEvent: (event) => {
          const label = eventLabel(event);
          if (label) write(label);
        },
      });
      if (!result.textEmitted) {
        throw new Error("AgentDock Codex ended without a final answer — the turn was interrupted or blocked by an interactive tool approval.");
      }
      if (lastUsed > 0) write({ tokens: lastUsed });
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/(?:concurrent prompt limit reached|could not start the Codex turn:\s*no run id)/i.test(message) && Date.now() < queueDeadline) {
        write({ status: "AgentDock ACP occupé · mise en file d'attente…" });
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        continue;
      }
      throw error;
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  write({ error: message });
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
