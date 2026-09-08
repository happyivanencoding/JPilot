// Inspect capabilities through the installed, authenticated project adapter.
// Credentials and the MCP client are deliberately never serialized.
import fs from 'node:fs';
import path from 'node:path';
import { inspectAgentDockModels } from '../src/lib/agentdock-acp.ts';
const destination = path.resolve(process.argv[2] || '../.career-ops-web/mobile-qa/model-capabilities.json');
const result = await inspectAgentDockModels(path.dirname(destination));
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
