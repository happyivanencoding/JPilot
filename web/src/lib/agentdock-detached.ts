import { spawn } from "node:child_process";
import path from "node:path";

export function startDetachedEvaluateWorker({
  prompt,
  cwd,
  timeoutMs,
  model = "gpt-5.6-luna",
  reasoning = "low",
}: {
  prompt: string;
  cwd: string;
  timeoutMs: number;
  model?: string;
  reasoning?: string;
}) {
  const script = path.join(process.cwd(), "scripts", "agentdock-evaluate-worker.mjs");
  const child = spawn(process.execPath, ["--no-warnings", "--experimental-strip-types", script, cwd, String(timeoutMs),model,reasoning], {
    cwd,
    env: process.env,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(prompt);
  return child;
}
