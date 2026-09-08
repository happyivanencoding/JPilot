// Isolated benchmark for the compact JobPilot Agent fallback only.
import './register-source-loader.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { buildSearchFallbackPrompt } from '../src/lib/job-search/fallback-prompt.mjs';
import { parseDiscoveredOffers } from '../src/lib/mobile-domain.mjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const outputDir = path.join(projectRoot, '.career-ops-web', 'mobile-qa', 'search-benchmark-20260908');
const isolated = path.join(outputDir, 'isolated-agent-cwd');
fs.mkdirSync(isolated, { recursive: true });
fs.writeFileSync(path.join(isolated, 'AGENTS.md'), '# Synthetic JobPilot search benchmark\nNo candidate data exists here. Public web research only. Never inspect parent directories or submit applications.\n');
const request = {
  query: 'Trouver des postes CDI en recherche quantitative fixed income, quantitative portfolio management ou analyse de risque de marché à Paris. Écarter les stages.',
  targetRoles: ['Fixed Income Quantitative Analyst', 'Quantitative Researcher', 'Quantitative Portfolio Manager'],
  city: 'Paris', country: 'France', contractTypes: ['CDI'], remote: false, knownUrls: [],
};
const started = Date.now();
let text = '', observed = {}, execution = {}, result;
try {
  const { openAgentDockCodex, runAgentDockCodex } = await import('../src/lib/agentdock-acp.ts');
  const { client } = await openAgentDockCodex();
  await runAgentDockCodex({
    client, cwd: isolated, prompt: buildSearchFallbackPrompt(request), model: 'gpt-5.6-luna', reasoning: 'low', mode: 'read-only', timeoutMs: 180_000,
    onText: chunk => { text += chunk; }, onMetrics: value => { observed = { ...observed, ...value }; },
    onRun: run => { execution = { sessionId: run.sessionId, runId: run.runId, remoteSessionId: run.remoteSessionId }; },
  });
  const offers = parseDiscoveredOffers(text);
  result = { status: 'completed', wallMs: Date.now() - started, ...observed, ...execution, returnedCount: offers.length, offers };
} catch (error) {
  result = { status: 'failed', wallMs: Date.now() - started, ...observed, ...execution, returnedCount: 0, error: error instanceof Error ? error.message : String(error), offers: [] };
}
fs.writeFileSync(path.join(outputDir, 'fallback-result.json'), JSON.stringify({ synthetic: true, measuredAt: new Date().toISOString(), ...result }, null, 2) + '\n');
console.log(JSON.stringify({ ...result, offers: result.offers.map(offer => ({ company: offer.company, title: offer.title, location: offer.location, postedHint: offer.postedHint, url: offer.url })) }, null, 2));
