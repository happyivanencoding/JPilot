import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// The evaluator loads this TS file with native Node, not through Next's alias resolver.
test('ACP helper remains importable by the detached native Node worker', () => {
  const output = execFileSync(process.execPath, ['--no-warnings','--experimental-strip-types','--input-type=module','-e',
    "const m=await import('./src/lib/agentdock-acp.ts'); if(typeof m.openAgentDockCodex!=='function'||typeof m.runAgentDockCodex!=='function')process.exit(1);console.log('ready')"],
    { cwd: process.cwd(), timeout: 15000, windowsHide: true, encoding: 'utf8' });
  assert.match(output,/ready/);
});
