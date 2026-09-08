// Explicit, bounded real ACP benchmark. Never imports or writes production Candidate data.
import fs from 'node:fs';
import path from 'node:path';
import { openAgentDockCodex, runAgentDockCodex } from '../src/lib/agentdock-acp.ts';
import { cvAnalysisPrompt } from '../src/lib/cv-analysis-prompt.mjs';
import { extractJsonObject } from '../src/lib/extract-json-object.mjs';
import { writeJson } from '../src/lib/mobile-state.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const directory = path.join(root, '.career-ops-web/mobile-qa/benchmark-20260908');
fs.mkdirSync(directory, { recursive: true });
const cv = `# Camille TEST — candidat fictif de benchmark\n\n## Profil\nAnalyste junior souhaitant évoluer vers la recherche quantitative obligataire à Paris.\n\n## Expérience\n### Analyste junior — Gestion Démo — 2024–2026\n- Nettoyage de séries financières en Python et préparation de tableaux de risque sous Excel.\n- Contribution à des études de facteurs obligataires ; résultats discutés avec le gérant.\n- Documentation des contrôles de qualité des données.\n\n## Formation\nMaster Finance — Université Démo — 2022–2024.\n\n## Compétences\nPython, pandas, SQL, Excel. Français natif, anglais B2.\n`;
const candidate = { id: 'fixture-only', cvVersion: 1, sources: {
  cv: { text: cv }, config: { text: 'target_roles: Fixed Income Quantitative Analyst\ncontract_types: [CDI]\nlocation: Paris' },
  notes: { text: 'Candidat synthétique. Aucun Bloomberg, Rust, certification CFA, gestion discrétionnaire, P&L personnel, ML déployé ou responsabilité de manager. Ne pas transformer une contribution en ownership. Pas de chiffres de performance documentés.' },
} };
const models = ['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6-sol','gpt-6-astra'];
const cases = models.flatMap(model => ['low','medium','high'].map(reasoning => ({ flow: 'analysis', model, reasoning, prompt: cvAnalysisPrompt({candidate,language:'fr'}) })));
const limit = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || cases.length);
const file = path.join(directory, 'screening.json');
const records = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : [];
let cursor = 0;
async function worker() {
  while (cursor < Math.min(limit,cases.length)) {
    const item = cases[cursor++];
    const id = [item.flow,item.model,item.reasoning].join('--');
    if (records.some(r => r.id === id && r.status === 'completed')) continue;
    if (records.some(r => r.id === id && r.status === 'running')) throw new Error(`Reconcile unfinished benchmark ${id} before retrying.`);
    const record = { id, flow:item.flow, model:item.model, reasoning:item.reasoning, status:'running', startedAt:new Date().toISOString(), metrics:{}, output:'' };
    records.push(record); writeJson(file,records);
    const start = Date.now();
    try {
      const {client} = await openAgentDockCodex();
      await runAgentDockCodex({client,prompt:item.prompt,cwd:directory,model:item.model,reasoning:item.reasoning,mode:'read-only',timeoutMs:240000,
        onRun: run => { record.sessionId=run.sessionId; record.runId=run.runId; record.remoteSessionId=run.remoteSessionId; writeJson(file,records); console.log(JSON.stringify({id,sessionId:run.sessionId,runId:run.runId})); },
        onText: text => {record.output+=text;},
        onMetrics: metrics => {record.metrics=metrics;writeJson(file,records);},
        onEvent: event => { if (/usage|token/i.test(String(event.type))) fs.appendFileSync(path.join(directory,id+'.usage.jsonl'),JSON.stringify(event)+'\n'); },
      });
      const obj=extractJsonObject(record.output).obj;
      record.quality={ validJson:!!obj, separatedIssues:Array.isArray(obj?.expressionIssues)&&Array.isArray(obj?.actionIssues),
        exactBefore:(obj?.expressionIssues||[]).filter(i=>i.before).every(i=>cv.split(i.before).length===2),
        actionableCount:(obj?.expressionIssues||[]).filter(i=>i.before&&cv.split(i.before).length===2).length,
        manualEvidenceReview:'pending' };
      record.status='completed';
    } catch(e) {record.status='failed';record.error=String(e);}
    record.finishedAt=new Date().toISOString();record.metrics.wallMs=Date.now()-start;
    writeJson(file,records);console.log(JSON.stringify({...record,output:undefined}));
  }
}
await Promise.all([worker(),worker()]);
console.log('Benchmark evidence: '+file);
