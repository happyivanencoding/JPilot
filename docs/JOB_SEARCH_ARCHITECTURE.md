# JobPilot search architecture

## 0.3.1 soft-ranking update — current authority

The current discovery rule is **contract-first, otherwise soft ranking**. This supersedes the earlier 0.3 section immediately below where it says seniority, pure sales or non-target geography are excluded.

- If a provider explicitly identifies a contract that is not among the selected contract types, the row is removed. If contract type is unknown, the row may remain with `contract to confirm`; `FULLTIME` is still not evidence of CDI.
- Job family, seniority/required experience, language and geography no longer independently delete a potentially usable job. They reduce rank and create visible risk fields (`roleFit`, `seniorityFit`, `languageFit`, `locationFit`).
- Ranking tiers are `strong` → `adjacent` → bounded `closest`. `closest` is normally hidden while a useful strong/adjacent pool exists and becomes the last-resort pool when the market would otherwise look empty.
- Senior/confirmé/expérimenté/responsable titles and explicit 2+ years-of-experience requirements can remain as `closest`; the UI states the seniority mismatch. A contract lasting two years is not treated as two years of work experience.
- Geography is prioritized, not locked: Paris/Île-de-France → other France → other Europe / European remote → outside Europe fallback. European cross-border results remain ordinary opportunities with mobility/administrative uncertainty. Visible US-state/USA evidence overrides contradictory provider country metadata for ranking.
- Flexible-European searches keep the JSearch budget at three requests: two retain the target-country constraint and one existing probe becomes Europe-wide. No fourth request or higher nominal JSearch request cost was added.

The former Synthetic Marketing Profile zero-result run was a post-filter failure, not provider failure: 33 raw rows were fetched, but 24 rows with unknown contracts were discarded before ranking. The current real phone path (`search-v5-soft-ranking`) returned **6 CDI roles: 3 strong + 3 adjacent, no Agent fallback**, in about **6.9 s** from 180 structured raw rows. The touched search/persistence regressions are **44 pass / 0 fail**. CDI/CDD/Stage/Alternance behavior has also been exercised against live France Travail/JSearch responses; raw/result counts are market-time samples, not stable product guarantees.

## 0.3 continuation: multi-persona constraints and actual coverage

Structured providers and AI fallback now pass through the same `rankSearchResults` projection. `candidate-constraints.mjs` applies junior/graduate seniority, confirmed CDI where configured, Paris/Île-de-France without nationwide relocation, explicit language requirements and future availability. Marketing/Brand/CRM/Insights and relevant French titles are supported instead of forcing every persona through Quant-specific tokens. A genuine CRM/data marketing consultant may be adjacent; pure sales and senior requirements are not promoted into the junior list.

French B1 is a real language constraint: explicit professional/native-French or local copywriting requirements are downranked and tagged, while explicit international/English working evidence can remain. Missing language requirements are unknown, not fluent-by-default. Targeting contains no name, nationality, school or CV body. Provider and partial metrics persist even if the supplement fails; restart recovery also applies the same constraints.

The actual synthetic Marketing search yielded **0 strong / 1 adjacent**: a Paris CDI digital/data marketing consultant role with a significant French requirement. FT and JSearch were unconfigured, tracked ATS disabled; structured API calls were zero. One real AI web supplement found the page. Publication date was not confirmed. This is a useful failure/strategy sample, not proof of good recall or installed provider credentials. Its saved result was re-ranked locally without another provider/AI call. See `ANDROID_0_3_RELEASE.md` for the complete persona, actual metrics and limitations; retain the earlier provider design below.

Updated: 2026-09-08 (Europe/Paris).

## Product boundary

Job discovery is now a JobPilot-owned product layer under `web/src/lib/job-search/`. Android and future clients should depend on this layer rather than on the original upstream project's scanner/prompt internals. Existing career-ops scanners remain useful transitional sources, but they are no longer the interface new mobile search work should target.

This is the first deliberate separation point from the upstream MIT project, not a claim that the repository is already independent. Existing upstream code remains under its MIT copyright/license obligations. New commercial-product code should keep moving behind JobPilot-owned interfaces so upstream replacement can happen incrementally without rewriting the Android client.

## Search pipeline

```text
Android search request
  -> profile target brief (roles / city / country / contract / remote only)
  -> structured provider fan-out
       - France Travail (production provider; credentials required)
       - JSearch / OpenWeb Ninja (production provider; API key required)
       - optional legacy tracked-ATS adapter during migration
       - development-only benchmark sources when explicitly enabled
  -> URL + company/title/location deduplication
  -> already-known URL removal
  -> deterministic location and known-contract filtering
  -> deterministic search relevance + metadata quality + freshness ranking
  -> result cards (still unconfirmed and UNRATED for candidate fit)
  -> optional compact AgentDock/Codex web fallback only when structured production sources are unavailable or return zero
```

Search relevance is **not** candidate compatibility. Formal fit scores still come only from a persisted career-ops evaluation/report. Search must never manufacture a fit score simply because a title matches keywords.

Discovery is deliberately a **ranking system, not an exact-match gate**. Exact/strong roles are shown first, genuinely adjacent roles second, and a bounded `closest` pool is available only when the stronger pool would otherwise be empty. For a flexible candidate, even a different role family, higher-seniority job or different geography can therefore survive as a clearly labelled fallback rather than being silently erased. Explicit contract mismatch remains the main hard targeting gate. Strong results always rank before adjacent/closest; dated structured rows older than 120 days are still removed by the current freshness window. Unknown contract/location/language remains uncertainty, not proof of a match.

The structured provider request does not contain the CV body, candidate notes, reports, or history. It receives only a bounded targeting brief. The compact Agent fallback is deliberately given the same bounded brief and known URLs; unlike the former search prompt it is explicitly forbidden from reading the CV or candidate files.

## Providers

### France Travail

Server-side environment variables:

- `JOBPILOT_FRANCE_TRAVAIL_CLIENT_ID`
- `JOBPILOT_FRANCE_TRAVAIL_CLIENT_SECRET`

The implementation uses client-credentials OAuth, caches the token, requests up to three targeted result sets in parallel, and maps structured creation date / contract / location / employer / source URL metadata. It does not guess an INSEE commune code from a city string; location is post-filtered until JobPilot owns a deterministic geocoder.

### JSearch / OpenWeb Ninja

Server-side environment variable:

- `JOBPILOT_JSEARCH_API_KEY` (or existing `OPENWEBNINJA_API_KEY`)
- optional accounting override: `JOBPILOT_JSEARCH_COST_PER_REQUEST_USD` (default `0.005`)

Up to three query variants are requested in parallel, one page each, constrained to recent postings. For profiles using flexible European geography, two probes retain the target country and the third existing probe is Europe-wide; total request count remains three. `FULLTIME` is not converted to `CDI`: working time is not proof of contract duration. An explicit `INTERN` signal may be mapped to Stage.

### Transitional tracked-ATS adapter

`JOBPILOT_SEARCH_ENABLE_TRACKED_ATS=1` enables a temporary adapter around the inherited public ATS provider catalogue and the current `portals.yml`. It is **disabled by default** in the mobile product. The adapter is useful while JobPilot is separating from upstream because it can fetch Greenhouse/Lever/Ashby/etc. without LLM tokens, but a cold scan currently walks about 94 boards and is much slower than a purpose-built search API. Its interface is already behind `web/src/lib/job-search/`, so removing the inherited provider implementation later does not require changing Android.

### Development source policy

`JOBPILOT_SEARCH_ENABLE_DEV_SOURCE=1` may enable a development-only source for private benchmarks. It must not be enabled in a commercial deployment unless that source's commercial data-use terms have been separately approved. The current Arbeitnow adapter exists only to measure provider speed/coverage and is disabled by default.

## Fallback policy

`JOBPILOT_SEARCH_AGENT_FALLBACK` controls the Agent fallback:

- `empty` (default): fallback when no production provider succeeded or structured results are zero;
- `unavailable`: fallback only when no production provider succeeded;
- `sparse`: fallback when fewer than five structured offers survive;
- `never`: disable Agent search completely.

A successful structured search with at least one result therefore has zero search-Agent tokens by default.

## Search metrics persisted per task

`result.searchMetrics` records:

- wall-clock search time;
- raw provider result count;
- deduplicated count and duplicate rate;
- already-known URLs removed;
- location / known-contract / relevance rows removed;
- returned offer count plus `strong` / `adjacent` counts;
- date coverage;
- freshness among dated rows (`<=3d`, `<=7d`) and stale rows removed by the current age window;
- direct-application-link rate;
- known-contract rate;
- average deterministic search relevance;
- average metadata-quality score;
- per-provider status, latency, raw count, API calls and estimated API cost;
- whether Agent fallback ran, its returned count, wall time and measured token usage when available;
- final source distribution.

Saved candidature cards retain discovery provenance (`source`, `sourceLabel`, `direct`, `remote`, `searchRelevance`, `dataQuality`, `ageDays`). This enables later analysis of which provider actually leads to saved applications, interviews and offers rather than optimizing only for raw result volume.

## 2026-09-08 benchmark

Synthetic query: Paris CDI roles around fixed-income quantitative research / quantitative portfolio management / market risk. No real candidate CV was sent to a benchmark provider or Agent.

Historical Agent-first baseline already present in the project:

- GPT-5.6 Luna / low;
- 54.6 s wall time;
- 298,316 input tokens (233,216 cached), 1,483 output tokens;
- API-equivalent model-cost estimate recorded by JobPilot: about **$0.0195**;
- 3 returned roles;
- 3/3 broad role relevance and 2/3 strong quantitative relevance under the benchmark's deterministic labels;
- 67% had a parseable posting date;
- the two dated rows were approximately 88 and 39 days old on 2026-09-08, so dated-row `<=7d` and `<=30d` freshness were both 0%;
- 2/3 URLs were direct employer/ATS URLs; one was an aggregator URL.

Compact Agent fallback after removing full CV/history from the search prompt and bounding the web work:

- GPT-5.6 Luna / low;
- **45.1 s** wall time;
- **163,653 input tokens** (109,824 cached), 1,214 output tokens;
- API-equivalent estimate about **$0.0144**;
- 3 returned roles, all clearly quantitative / fixed-income adjacent in title (Amundi Quantitative AI Portfolio Engineer Fixed Income, BNP Paribas Analyste Quantitatif, Crédit Agricole CIB Quantitative Analyst FI NL);
- all three pages were reported active by the fallback search; posting/update dates were still uneven, so liveness is not treated as freshness.

This is roughly a 45% reduction in input tokens and 17% reduction in wall time versus the old Agent-first search, but ~45 seconds is still too slow and too transport-dependent to be the commercial primary search path.

Transitional inherited tracked-ATS adapter (explicitly enabled only for benchmark):

- about 8.3k raw jobs from 94 attempted public ATS boards, 84 boards succeeded;
- latest cold run: about **40.5 s** total; same-process warm run: about **7.3 s** after the board-fetch cache, because thousands of rows still need deterministic filtering;
- zero LLM tokens and zero paid API cost;
- final ranked output: 3 `adjacent` Paris finance roles, 0 `strong` Quant roles; all three had dates, 67% were <=7 days old, and all three used direct ATS links;
- this confirms that the inherited `portals.yml` universe is not a good primary source for Paris Quant even though its provider code is useful during migration. It therefore remains disabled by default.

### Credentialed production rerun (2026-09-08)

France Travail and JSearch were subsequently registered and run against the same synthetic Paris CDI Quant request, with no CV or candidate facts supplied. This is a real provider measurement, not a fixture:

- **3.66 s** wall time, **84** raw rows, **82** after deduplication and **7 strong** final results; no Agent fallback and therefore zero search-Agent tokens.
- France Travail returned **54** rows in **573 ms**; JSearch returned **30** rows in **3.60 s**. The JSearch estimate is **$0.015** for three requests (the free-plan quota may make the immediate billed cost lower).
- Every final row had a parseable date, but **0%** of dated rows were within seven days. The product exposes that result directly instead of treating an accessible aggregator page as a fresh vacancy.
- Average deterministic search relevance was **74/100** and metadata quality **75/100**. These are ranking/data-completeness signals, not candidate fit scores or a claim that a posting is still open.

The rerun also caught and fixed two production adapter issues: JSearch v2 returns `data.jobs` rather than the legacy flat `data` array, and a slow query no longer discards a provider's other successful responses. France Travail queries now probe French market terms (`quant`, `risque de marché`, `obligataire`) before the shared deterministic filters apply. The mobile UI already exposes provider status, latency, result count, freshness and estimated API cost.

Private raw benchmark artifact: `.career-ops-web/mobile-qa/search-benchmark-20260908/result.json` (ignored; do not commit).

## Commercial deployment rules

- API credentials stay server-side. Never embed France Travail/JSearch credentials in the APK.
- Provider data-use/redistribution terms are a release dependency, not an implementation detail. A development adapter is not automatically an approved commercial provider.
- Preserve original MIT copyright/license notices for upstream code still copied or distributed; gradual replacement does not retroactively remove that obligation.
- Do not optimize on raw result count. Optimize first for relevant, live, appropriately contracted roles, then downstream save/evaluation/application/interview outcomes.
