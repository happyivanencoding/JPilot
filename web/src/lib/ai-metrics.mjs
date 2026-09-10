import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Snapshot of official API Standard pricing, checked 2026-09-08.
// These are NOT subscription charges. Cache-write/tool fees, tax and regional uplifts are not included.
export const PRICE_SOURCE = 'https://developers.openai.com/api/docs/pricing';
export const PRICE_DATE = '2026-09-08';
export const API_RATES = {
  'gpt-5.6-luna': [0.20,0.02,1.20],
  'gpt-5.6-terra': [2.00,0.20,12.00],
  'gpt-5.6-sol': [4.00,0.40,20.00],
  'gpt-6-astra': [10.00,1.00,50.00],
};
export function apiEquivalent(model, usage) {
  const rates = API_RATES[model];
  if (!rates || !Number.isFinite(usage?.inputTokens) || !Number.isFinite(usage?.outputTokens)) return { actualCostUsd: null, estimatedCostUsd: null, costKind: 'unavailable' };
  const cache = Math.min(usage.inputTokens, Number(usage.cachedInputTokens || 0));
  const estimate = ((usage.inputTokens-cache)*rates[0] + cache*rates[1] + usage.outputTokens*rates[2])/1e6;
  return { actualCostUsd: null, estimatedCostUsd: estimate, costKind: 'api-equivalent-estimate', pricingDate: PRICE_DATE, pricingSource: PRICE_SOURCE,
    costAssumptions: 'API Standard, short-context pricing; subscription billing is not attributable per task. Excludes tool/cache-write fees, tax and regional uplifts.' };
}
export function usageFromRollout(text, remoteSessionId) {
  let total = null, validSession = false;
  for (const line of text.split('\n')) {
    let record; try { record = JSON.parse(line); } catch { continue; }
    if (record.type === 'session_meta') validSession ||= record.payload?.id === remoteSessionId;
    if (record.type === 'event_msg' && record.payload?.type === 'token_count' && record.payload?.info?.total_token_usage) {
      const candidate = record.payload.info.total_token_usage;
      // Cumulative snapshots are never summed: repeated token_count events are common.
      if (!total || candidate.total_tokens >= total.total_tokens) total = candidate;
    }
  }
  if (!validSession || !total || !Number.isFinite(total.input_tokens) || !Number.isFinite(total.output_tokens)) return null;
  return { inputTokens: total.input_tokens, outputTokens: total.output_tokens,
    cachedInputTokens: Number.isFinite(total.cached_input_tokens) ? total.cached_input_tokens : null,
    reasoningTokens: Number.isFinite(total.reasoning_output_tokens) ? total.reasoning_output_tokens : null,
    totalTokens: total.total_tokens ?? total.input_tokens + total.output_tokens,
    tokenSource: 'codex-new-session-cumulative',
  };
}
export function readCodexUsage(remoteSessionId, startedAt, home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {
  if (!/^[a-f0-9-]{36}$/.test(String(remoteSessionId))) return null;
  // Only this task's new session, never scan or expose other conversations.
  const dates = new Set([String(startedAt).slice(0,10), new Date().toISOString().slice(0,10)]);
  for (const date of dates) {
    const folder = path.join(home, 'sessions', ...date.split('-'));
    let files; try { files = fs.readdirSync(folder); } catch { continue; }
    for (const file of files.filter(f => f.endsWith(`${remoteSessionId}.jsonl`))) {
      const usage = usageFromRollout(fs.readFileSync(path.join(folder, file), 'utf8'), remoteSessionId);
      if (usage) return usage;
    }
  }
  return null;
}

/** Exact completed task session only. ACP's bounded event history is not the full result authority. */
export function finalAnswerFromRollout(text, remoteSessionId) {
  let identity=false;const answers=[];
  for(const line of text.split('\n')) {
    let r;try{r=JSON.parse(line);}catch{continue;}
    if(r.type==='session_meta')identity ||= r.payload?.id===remoteSessionId;
    const p=r.payload;
    if(r.type==='response_item' && p?.type==='message' && p.role==='assistant' && p.phase==='final_answer') {
      const answer=(p.content || []).filter(c=>c.type==='output_text'||c.type==='text').map(c=>c.text || '').join('');
      if(answer)answers.push(answer);
    }
  }
  return identity && answers.length ? answers.at(-1) : null;
}
export function readCodexFinalAnswer(remoteSessionId, startedAt, home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {
  if(!/^[a-f0-9-]{36}$/.test(String(remoteSessionId)))return null;
  for(const date of new Set([String(startedAt).slice(0,10),new Date().toISOString().slice(0,10)])) {
    const folder=path.join(home,'sessions',...date.split('-'));let names;
    try{names=fs.readdirSync(folder);}catch{continue;}
    for(const name of names.filter(f=>f.endsWith(`${remoteSessionId}.jsonl`))) {
      const text=finalAnswerFromRollout(fs.readFileSync(path.join(folder,name),'utf8'),remoteSessionId);
      if(text)return text;
    }
  }
  return null;
}
export function historicalEstimate(tasks, kind, model, reasoning) {
  const samples = tasks.filter(t => t.kind === kind && t.status === 'completed' && !t.reusedResult
    && t.metrics?.model === model && t.metrics?.reasoning === reasoning && t.metrics?.wallMs > 0)
    .slice(0,30).map(t => t.metrics.wallMs).sort((a,b) => a-b);
  if (samples.length < 3) return { samples: samples.length, label: 'Habituellement quelques minutes', minSeconds: null, maxSeconds: null };
  const percentile = p => samples[Math.min(samples.length-1, Math.floor((samples.length-1)*p))];
  const minSeconds = Math.max(15,Math.floor(percentile(.2)/15000)*15);
  const maxSeconds = Math.max(minSeconds+15,Math.ceil(percentile(.85)/15000)*15);
  return { samples: samples.length, minSeconds, maxSeconds,
    label: `Habituellement ${Math.max(1,Math.floor(minSeconds/60))}–${Math.max(1,Math.ceil(maxSeconds/60))} min` };
}
// Conservative product baselines from the latest verified direct-model flows.
// They are only used until a profile has >=3 comparable successful production
// runs. The UI labels them as estimates and never presents them as real model
// completion percentages.
export const FLOW_BASELINE_SECONDS = {
  search: [5,20],
  analysis: [20,45],
  deep_match: [8,25],
  evaluate: [10,30],
  cv: [15,45],
  cv_review: [8,25],
  plan: [20,45],
  practice: [10,30],
  compare: [15,35],
  coach: [15,35],
};
export function flowEstimate(tasks, kind, model, reasoning) {
  const historical = historicalEstimate(tasks,kind,model,reasoning);
  if (historical.minSeconds) return {...historical,targetSeconds:historical.maxSeconds,source:'production-history'};
  const baseline = FLOW_BASELINE_SECONDS[kind];
  if (!baseline) return {...historical,targetSeconds:null,source:'unavailable'};
  return {...historical,minSeconds:baseline[0],maxSeconds:baseline[1],targetSeconds:baseline[1],source:'verified-baseline'};
}
// Retained baselines until isolated benchmarks justify changing an individual flow.
export const FLOW_DEFAULTS = {
  search: { model: 'gpt-5.6-luna', reasoning: 'low' },
  analysis: { model: 'gpt-5.6-luna', reasoning: 'low' },
  deep_match: { model: 'gpt-5.6-luna', reasoning: 'low' },
  evaluate: { model: 'gpt-5.6-luna', reasoning: 'low' },
  cv: { model: 'gpt-5.6-luna', reasoning: 'low' },
  cv_review: { model: 'gpt-5.6-luna', reasoning: 'low' },
  plan: { model: 'gpt-5.6-luna', reasoning: 'low' },
  practice: { model: 'gpt-5.6-luna', reasoning: 'low' },
  compare: { model: 'gpt-5.6-luna', reasoning: 'low' },
  coach: { model: 'gpt-5.6-luna', reasoning: 'low' },
};
