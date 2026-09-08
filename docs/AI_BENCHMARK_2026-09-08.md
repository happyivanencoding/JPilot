# JobPilot AI benchmark — 2026-09-08

## Production direct-OpenAI validation

After the transport-only ACP work, production was switched to the explicit `web/src/lib/model-transport.ts` adapter with `JOBPILOT_MODEL_TRANSPORT=direct-openai`. The API key stays in a local private file referenced from ignored `web/.env.local`; no key or machine-specific path is committed.

The switch was triggered by a concrete production failure rather than a synthetic benchmark: AgentDock itself remained healthy, but repeated `acp_session/new` calls were observed taking minutes or never returning while direct Luna had already benchmarked near 10 seconds. The selected direct transport now avoids ACP session creation entirely; `/api/internal/prewarm` only validates the local direct configuration and returned in about 0.16s wall / 1ms server work after deployment.

An end-to-end production formal-evaluation retry then completed in **16.5s** from task creation to terminal state, with about **14.4s** model time, `gpt-5.6-luna / low`, **6,114 input + 1,191 output = 7,305 total tokens**, and an API-equivalent estimate of **$0.002652**. Deterministic report and candidature persistence completed normally. Candidate identity and private evidence are intentionally omitted from this public benchmark note.

This live result also exposed and fixed two lifecycle bugs: frozen Candidate evidence paths were relative to the repository root but were being read from the Web service cwd, causing false `CV manquant`; and pre-run restart recovery could leave tasks in `reconciling` forever when no model `runId` had ever been acknowledged. Both now have bounded terminal behavior.

## Later continuation — product validation, not a rerun of this matrix

The original matrix below is preserved unchanged. The 0.3 continuation ran only necessary real operations on the synthetic personas. It obtained three whole-page/longitudinal analyses, one bounded Marketing search and one new formal evaluation. Full queue/setup/agent/wall, input/output/cache/reasoning and estimated-cost measurements are in `ANDROID_0_3_RELEASE.md`. A new formal report now succeeded, but required 755.455s wall and approximately $1.44542 API equivalent; this does not establish an optimized evaluation model winner. Actual subscription cost remains unavailable. Failed session initialization attempts are retained, and output recovery/re-ranking/draft rendering did not call another model. Do not automatically rerun this historical benchmark.

Post-0.3.1 product decision: a second successful real `Sol/medium` formal evaluation (Synthetic Marketing Profile → DIGIACADEMY, report #9) still required **556.615 s wall / 554.819 s agent time**, consumed **1,360,303 input + 11,953 output tokens** (1,147,392 cached input), and carried a **$1.54966 API-equivalent estimate**. Together with the earlier 755.455 s Sol run, this is enough product evidence that Sol/medium is too slow for the mobile evaluation default, even though it is not a comparative formal-evaluation benchmark. The default has therefore moved to **gpt-5.6-luna / medium** for future evaluations. Existing reports are reused, not regenerated. No additional formal-evaluation benchmark was run just to prove speed; the next genuine user evaluation should provide the first production Luna timing.

This is a bounded, single-fixture experiment, not a statistically reliable latency ranking. It uses fictional Candidate evidence in isolated roots. No real Candidate CV, report or application was used as model benchmark input or changed by the experiments.

## Direct API A/B — DeepSeek V4 Flash vs GPT-5.6 Luna

A bounded direct-API experiment was added after the ACP benchmarks to isolate model latency from AgentDock/Codex setup, repository reads, web/tool calls and tracker persistence. It used the existing fictional `Camille TEST` fixture only; no real Candidate data was sent. Both providers received the same compact evidence and the same TOBAM-like evaluation requirements, returned JSON, and were run three times for CV analysis and three times for formal-fit evaluation. Keys were read only from user-provided local files and were never persisted in benchmark output or Git.

Fast reasoning configuration: `gpt-5.6-luna / low` vs `deepseek-v4-flash / low thinking`. Pricing was checked against official provider docs on 2026-09-08. DeepSeek calls occurred during off-peak hours. A secondary three-run DeepSeek non-thinking diagnostic was run because low-thinking latency was unexpectedly high.

| Flow / model | Runs | Median wall | Avg wall | Avg input | Avg cached input | Avg output | Avg reasoning | Avg estimated cost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Analysis — GPT-5.6 Luna low | 3 | 8.585s | 9.087s | 391 | 0 | 864 | 54 | $0.001115 |
| Analysis — DeepSeek V4 Flash low-thinking | 3 | 15.870s | 15.281s | 459 | 384 | 2,063 | 1,423 | $0.001381 |
| Evaluation — GPT-5.6 Luna low | 3 | 9.999s | 9.742s | 702 | 0 | 1,059 | 80 | $0.001412 |
| Evaluation — DeepSeek V4 Flash low-thinking | 3 | 17.914s | 14.961s | 807 | 768 | 1,957 | 1,512 | $0.001306 |
| Evaluation — DeepSeek V4 Flash non-thinking | 3 | 5.174s | 5.005s | 807 | 768 | 744 | 0 | $0.000505 |

Quality finding: Luna was materially more consistent and evidence-disciplined. All three Luna evaluations returned 2.5/5 + `conditional` and respected the documented/non-documented boundary. DeepSeek low-thinking returned 2.0/2.0/1.5 with recommendation drift and several evidence extrapolations (for example treating globally-listed SQL as work-task evidence or partially crediting production-ready code without production evidence). DeepSeek non-thinking was fast and cheap but unsuitable for formal scoring in this sample: scores varied 1.0→2.5→4.0, one of three outputs was invalid JSON, output-language instructions were not reliably followed, and B2 English was sometimes treated as satisfying fluent English.

**Product decision from this bounded test:** the main latency problem is the ACP/Codex agent workflow rather than Luna inference. If JobPilot introduces a dedicated direct-model evaluation path, start with GPT-5.6 Luna low as the quality/stability default. DeepSeek V4 Flash non-thinking may still be useful for lower-risk extraction/translation/classification behind schema validation and fallback, but this sample does not justify using it as the authoritative formal evaluator. Do not change production routing solely from this benchmark; validate the dedicated direct path end-to-end first.

Private raw evidence: `.career-ops-web/mobile-qa/direct-api-ab-20260908/results.json` and `deepseek-nonthinking.json`. The complete experiment cost estimate was about **$0.017154** (primary A/B $0.015638 + non-thinking diagnostic $0.001516). This is an API-pricing estimate, not an invoice.

## ACP transport-only migration — 2026-09-08

The direct-API experiment above identified the agent workflow as the dominant latency source. JobPilot now keeps AgentDock/ACP as the model transport but no longer gives product inference a coding-agent workspace. The ACP session starts in an isolated `%LOCALAPPDATA%/JobPilot/acp-transport` directory, mounts no Career-Ops `additional_directories`, accepts only the ACP `read-only` mode, and disables shell/unified-exec, browser/computer-use, apps/plugins, skills, hooks, multi-agent, image/view and permission-request features. Product prompts explicitly forbid tool/permission/environment work. A transport benchmark recorded **zero tool events in all three runs**.

Backend responsibilities were moved out of the model turn. Formal evaluation receives embedded CV/config/notes + saved/backend-retrieved JD data and returns one JSON object; Node reserves the report number, writes the report/TSV and merges the tracker. CV tailoring now embeds the frozen Candidate version instead of handing the model source paths. CV upload is extracted locally before inference. Assistant prompts embed their selected-profile evidence. Structured job providers are the search network layer; the former ACP web-search fallback and legacy Explore web-agent path are removed. Portal repair is explicitly rejected as a product-model task rather than granting terminal/filesystem access.

### Same compact evaluation prompt: ACP transport-only vs direct Luna

The transport test reused the exact fictional `Camille TEST` + TOBAM-like compact evaluation prompt from the direct Luna A/B. Three ACP runs used `gpt-5.6-luna / low`. Session prewarm is listed separately because the product normally starts it from snapshot reads before the user taps an AI action.

| Run | Prewarm | Click-to-result wall | ACP setup | Agent | Input | Output | Reasoning | API-equivalent | Score / decision | Tool events |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 1 | 6.436s | 23.537s | 0.074s | 21.899s | 16,382 | 930 | 74 | $0.004392 | 2.5 / conditional | 0 |
| 2 | 0.412s | 22.624s | 0.020s | 21.257s | 16,380 | 984 | 35 | $0.004457 | 3.0 / conditional | 0 |
| 3 | 0.405s | 22.508s | 0.020s | 20.428s | 16,388 | 892 | 37 | $0.004348 | 2.5 / conditional | 0 |
| **Median / avg** | **0.412s median** | **22.624s median / 22.890s avg** | **0.020s median** | **21.195s avg** | **16,383 avg** | **935 avg** | — | **$0.004399 avg** | 2.5 / 3.0 / 2.5, all conditional | **0** |

For the same compact prompt, direct Luna remained faster and cheaper: 9.999s median, 702 input tokens and ~$0.001412/run. ACP transport-only is therefore still about **2.26× slower by median wall**, **23.3× larger in input tokens** and **3.12× the API-equivalent cost** because Codex ACP still injects its own base runtime/system context. This is the remaining transport tax, not JobPilot repository/tool work. A model-visible prompt-input probe reduced non-task bootstrap text from about **56.2k characters** in the old project-attached session to about **13.5k characters** in the isolated/tool-disabled runtime, a **~75.9% reduction**.

Against the older Luna/low ACP CV-analysis screening row (not an apples-to-apples prompt), the new transport benchmark cuts average input about **57%** (38,336 → 16,383), API-equivalent cost about **51%** ($0.00892 → $0.00440) and median wall about **21%** (28.69s → 22.62s). The much larger historical formal-evaluation comparison is intentionally labelled non-controlled: the successful Sol/medium product run at 556.615s / ~1.37M session tokens / ~$1.55 also changed model and prompt architecture. The isolated new formal E2E finished in **22.298s**, used **16,652 input + 1,017 output**, cost **~$0.00455**, generated a parser-compatible report and merged the tracker. That is roughly 25× faster and 98.7% fewer total session tokens, but the gain cannot be attributed to transport isolation alone.

### Quality result and deliberate trade-off

Fit quality remained usable in this bounded fixture. Direct Luna returned 2.5/2.5/2.5 `conditional`; ACP transport-only returned 2.5/3.0/2.5, also all `conditional`. All three transport runs consistently marked Java/Git/production-ready code/AI as missing and large-data/portfolio-management/relevant-experience/B2 English as partial. No run promoted a globally-listed skill into unsupported work evidence. The 0.5 score variance is real and should not be hidden; direct API was more score-stable on this sample.

The new formal report is intentionally **less agentic**, not secretly equivalent to the old deep-research report. The model no longer independently researches compensation, culture, legitimacy, reporting lines or company risk. If backend data does not contain those fields, the report records them as `not_evaluated` / `Proceed with Caution` instead of inventing them. Future enrichment must be fetched deterministically by JobPilot and supplied as model input; it must not re-enable ACP web/terminal/filesystem tools. Search has the analogous trade-off: if structured providers are unavailable, JobPilot now reports that limitation rather than launching an ACP web-search fallback.

Private evidence: `.career-ops-web/mobile-qa/transport-only-20260908/results.json` and `e2e.json`. The integrated E2E used only an isolated fictional Candidate root.
## Accounting

Measurements come from actual ACP run timestamps and the exact newly-created Codex session's cumulative token counters. Repeated cumulative usage events are not added together. Context occupancy is not token consumption. Tokens include the entire agent session and tool interactions, not only the visible CV prompt. Queue, setup, agent execution, pipeline wall time and local rendering are distinct. Missing counters remain unknown.

There is no accurately attributable per-task subscription bill: actualCostUsd remains null. All dollar values below are **API-equivalent estimates**, not payments. Pricing reference: [OpenAI Standard API pricing](https://developers.openai.com/api/docs/pricing), checked 2026-09-08. Excludes tool fees, tax, regional uplifts and cache-write fees. It assumes short-context Standard pricing; it is not an invoice.

| Model | Input / 1M | Cached input / 1M | Output / 1M |
|---|---:|---:|---:|
| gpt-5.6-luna | $0.2 | $0.02 | $1.2 |
| gpt-5.6-terra | $2 | $0.2 | $12 |
| gpt-5.6-sol | $4 | $0.4 | $20 |
| gpt-6-astra | $10 | $1 | $50 |

## CV-analysis screening: actual model/reasoning matrix

The installed ACP adapter advertised Luna, Terra, Sol and Astra and low/medium/high reasoning. Each successful run verified the applied configuration. Astra/high was attempted but failed during connection/setup, without a usable run result; this does not establish that the combination is unsupported.

| Model | Reasoning | Status | Queue s | Agent s | Wall s | Input | Output | Cached input | Reasoning tokens | API equivalent |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| gpt-5.6-luna | low | completed | 0.03 | 27.19 | 28.69 | 38336 | 1040 | 0 | 55 | $0.00892 |
| gpt-5.6-luna | medium | completed | 0.01 | 26.67 | 28.20 | 38344 | 1179 | 0 | 241 | $0.00908 |
| gpt-5.6-luna | high | completed | 0.01 | 48.82 | 49.92 | 38338 | 2261 | 0 | 1291 | $0.01038 |
| gpt-5.6-terra | low | completed | 0.01 | 25.28 | 26.34 | 40416 | 1165 | 0 | 47 | $0.09481 |
| gpt-5.6-terra | medium | completed | 0.01 | 29.91 | 30.89 | 40414 | 1409 | 14080 | 516 | $0.07239 |
| gpt-5.6-terra | high | completed | 0.01 | 27.38 | 28.82 | 40412 | 1254 | 0 | 294 | $0.09587 |
| gpt-5.6-sol | low | completed | 0.01 | 64.88 | 65.97 | 40414 | 1683 | 0 | 323 | $0.19532 |
| gpt-5.6-sol | medium | completed | 0.04 | 88.24 | 89.26 | 40412 | 2336 | 14720 | 691 | $0.15538 |
| gpt-5.6-sol | high | completed | 0.01 | 228.70 | 229.67 | 40420 | 3046 | 0 | 1511 | $0.22260 |
| gpt-6-astra | low | completed | 0.02 | 44.47 | 45.73 | 37170 | 1301 | 0 | 0 | $0.43675 |
| gpt-6-astra | medium | completed | 0.01 | 42.02 | 43.10 | 37166 | 1266 | 0 | 0 | $0.43496 |
| gpt-6-astra | high | failed | 0.00 | — | 304.82 | — | — | — | — | — |

All 11 completed screening runs produced parseable structured output with exact source spans. That is not the same as evidence fidelity: Terra/low attached a globally listed SQL skill to an employment activity without supporting evidence. It must not be selected merely because it was fast. Luna/medium supplied useful expression/action separation at substantially lower equivalent cost. High reasoning did not consistently improve latency or usefulness. Accepted-expression rewrites are deliberately deterministic and do not require another agent.

## Full-flow attempts and failures

Rows retain original failures. A successful local render recovery does not rewrite a failed first attempt into an entirely successful first run. The search measurements concern the original ACP-only search prompt; they do **not** benchmark the parallel structured-search-first implementation added later to the workspace.

| Case | Status | Agent s | Wall s | Input | Output | Cached input | Reasoning tokens | API equivalent |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| career--gpt-5.6-luna--medium | failed | 306.08 | 427.44 | — | — | — | — | — |
| career--gpt-5.6-luna--medium--transport-fix | completed | 28.03 | 43.87 | 37740 | 984 | 0 | 83 | $0.00873 |
| career--gpt-6-astra--low | failed | — | 45.64 | — | — | — | — | — |
| career--gpt-6-astra--low--transport-fix | completed | 66.96 | 76.28 | 44270 | 993 | 0 | 39 | $0.49235 |
| continuity--gpt-5.6-luna--medium | failed | — | 45.36 | — | — | — | — | — |
| continuity--gpt-5.6-luna--medium--transport-fix | failed | — | 47.81 | — | — | — | — | — |
| continuity--gpt-6-astra--low | failed | — | 45.36 | — | — | — | — | — |
| continuity--gpt-6-astra--low--transport-fix | failed | — | 45.69 | — | — | — | — | — |
| cv--gpt-5.6-luna--medium | failed | 40.09 | 41.69 | 128387 | 1454 | 106752 | 588 | $0.00821 |
| cv--gpt-5.6-terra--medium | failed | 59.60 | 61.03 | 212233 | 1998 | 179968 | 508 | $0.12450 |
| cv--gpt-6-astra--low | failed | 26.70 | 28.30 | 75092 | 495 | 52224 | 34 | $0.30565 |
| evaluate--gpt-5.6-luna--medium | failed | 784.09 | 785.32 | 75087 | 498 | 47616 | 176 | $0.00704 |
| evaluate--gpt-5.6-sol--medium | failed | 814.66 | 901.35 | 37781 | 326 | 14720 | 184 | $0.10465 |
| evaluate--gpt-6-astra--low | failed | 791.48 | 913.31 | 195483 | 525 | 145024 | 0 | $0.67586 |
| search--gpt-5.6-luna--low | completed | 53.17 | 54.60 | 298316 | 1483 | 233216 | 408 | $0.01946 |
| search--gpt-6-astra--low | completed | 56.29 | 57.99 | 327442 | 806 | 273536 | 56 | $0.85290 |

### Tailored CV: zero-AI rendering recovery

The three CV agents produced saved structured content. The first rendering attempts failed because the isolated fixture lacked the tracked tracker-aliases.json asset. Recovery used those saved payloads; it did not regenerate CV content. A further real checker bug counted a literal `<img>` inside CSS/comments as a content image; verify-ats.mjs now ignores comments/style/script when counting rendered images. Native master-CV preview is a separate Markdown-to-PDF renderer. Neither a preview nor the heuristic ATS score certifies acceptance by every ATS.

| Case | Recovery | Extra AI calls | Render wall s | Pages | Recorded ATS score |
|---|---|---:|---:|---:|---:|
| cv--gpt-5.6-luna--medium | completed | 0 | 2.55 | 1 | 77 |
| cv--gpt-5.6-terra--medium | completed | 0 | 0.77 | 1 | 82 |
| cv--gpt-6-astra--low | completed | 0 | 0.77 | 1 | 82 |

Do not rank models by these ATS scores: the first successful recovery and later recoveries straddled the checker correction. Inspect content and layout, not a misleading score comparison. The medium Terra CV retained contribution-level wording and did not justify a costlier Astra default.

### Formal evaluation and continuity limits

The historical matrix's formal-evaluation experiments did not finish with usable persisted reports: there were execution/setup timeouts. Later product runs did finish successfully with Sol/medium, including reports #8 and #9, but both took roughly 9–13 minutes and more than one million session tokens. Sol/medium was never a demonstrated benchmark winner and is no longer the product default.

Career advice completed on Luna/medium and Astra/low after a transport change; the lower-cost model provided adequate evidence-grounded positioning for the fixture. Updated-CV continuity prompts include the previous CV, previous analysis and accepted/resolved edits, and version-state tests pass. The live-model continuity attempts still failed during ACP setup. Therefore the treatment of all historical conclusions by the new model has not been established by a successful continuity run.

The adapter now handles a matching SSE JSON-RPC response without waiting for connection closure, skips unrelated notifications, and bounds individual network requests. A non-closing-SSE regression passes. This is a real transport fix, but it did not eliminate all observed ACP setup failures; do not claim it cured the full evaluation chain.

## Default decisions

| Flow | Default | Reason |
|---|---|---|
| search | gpt-5.6-luna / low | Keep Luna/low for AI supplementation; do not attribute the old search sample to the new structured-search implementation. |
| analysis | gpt-5.6-luna / medium | Adequate expression/action separation at low equivalent cost; unchanged inputs reuse persisted output. |
| evaluate | gpt-5.6-luna / medium | Replaces Sol/medium after two successful real Sol evaluations still took ~9–13 minutes. Luna/medium was already materially faster than Sol/medium on the bounded screening matrix while preserving useful evidence-grounded output; formal-evaluation speed will be measured on the next genuine run rather than by repeating an expensive benchmark. |
| cv | gpt-5.6-terra / medium | Retain Terra/medium for evidence-preserving structured CV generation; cache output before rendering so a renderer failure never requires another paid generation. |
| plan | gpt-5.6-luna / medium | Retain existing setting; interview planning was not separately model-benchmarked. |
| practice | gpt-5.6-luna / medium | Retain existing setting; practice feedback was not separately model-benchmarked. |
| compare | gpt-5.6-luna / medium | Retain existing setting; offer comparison was not separately model-benchmarked. |
| coach | gpt-5.6-luna / medium | Luna/medium career-advice fixture completed with grounded, actionable content at much lower cost than Astra. |
| Apply accepted CV expression suggestions | Local deterministic edit + PDF render | Zero extra AI calls; original evidence span must match uniquely, new numbers need evidence, and the human approves a separate draft. |

ETA uses only comparable successful production runs by flow/model/reasoning, excluding reused results. At least three comparable observations are required for a numeric range. These synthetic benchmark runs are not injected into production ETA history.

## Evidence and reproduction

Private raw records: `.career-ops-web/mobile-qa/benchmark-20260908/screening.json`, `cases/*/result.json`, capability snapshots, and per-profile task metrics. Source runners: `web/scripts/benchmark-jobpilot.mjs`, `benchmark-jobpilot-flows.mjs`, `recover-benchmark-cv.mjs`. Do not blindly rerun expensive benchmarks: inspect unfinished run IDs, cached output and previous artifacts first. This aggregate document contains no real Candidate text or private run/session identifiers.
