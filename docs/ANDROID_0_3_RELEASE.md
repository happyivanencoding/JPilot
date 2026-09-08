# JobPilot Android 0.3.x — continuation release

Date: 2026-09-08 (Europe/Paris). Subordinate to `DEEP_CONTEXT_HANDOFF_FINAL.md`. This continues the existing 0.2 work and persistent task; it is not a restart or a repeat of the model benchmark.

## 0.3.1 / code5 search patch — current state

This section supersedes the older 0.3.0 search conclusions below; those remain as historical evidence. Current Android source/APK and the actual USB-installed Samsung package are **0.3.1 / versionCode 5**. The authenticated public `/api/mobile` backend also reports **0.3.1**.

The Synthetic Marketing Profile failure was not a phone/network/provider outage. The broken native search had **33 raw rows** (France Travail 3 + JSearch 30, 32 after deduplication) but `contract_policy: confirmed_only` removed **24 rows whose contract was merely unknown**, then removed five known non-CDI rows and the remaining low-relevance rows. It returned zero and unnecessarily invoked the Luna fallback for about 35 seconds / 180k input tokens. The corrected product rule is now:

- an **explicitly incompatible contract type** is the hard gate;
- an unknown contract remains visible as `contract to confirm` and is never relabelled CDI/CDD/Stage/Alternance without evidence;
- role family, seniority, French level and geography are ranking/risk signals, not one-condition deletion rules;
- `strong` and `adjacent` are shown first; if neither exists, a bounded `closest` set remains rather than manufacturing an empty market;
- explicit `senior / confirmé / expérimenté / responsable` or **2+ years of experience** can survive as `closest` with a seniority warning; contract duration such as “alternance de 2 ans” is not misread as work experience;
- Paris/Île-de-France ranks first, then the rest of France, then other European countries / European remote work. Other European countries are normal ranked opportunities with mobility/administrative uncertainty; outside-Europe roles can remain only as lower fallback;
- one of the existing three JSearch probes is Europe-wide instead of applying `country=fr` to every request, so European recall broadens without adding API calls or nominal request cost.

Contract parsing was also exercised for **CDI, CDD, Stage and Alternance**, including explicit mismatch, unknown contract, and mixed `Stage / Alternance` postings. The current targeted regression set for the touched search/persistence behavior is **44 pass / 0 fail**. Latest production Web build/typecheck and Android build both pass.

A real native phone search after deployment created a new `search-v5-soft-ranking` task rather than reusing the morning zero-result cache. Final observed result: **6 CDI opportunities = 3 strong + 3 adjacent, 0 closest, no AI fallback**, about **6.9 s** wall time from 180 structured raw rows (France Travail 150, JSearch 30). The retained strong rows were actual Marketing/Communication/Product roles; the earlier false-positive `Chef de rayon produits alimentaires` was fixed and is explicitly regression-tested. Native instrumentation completed **OK (1 test)** on the authenticated public host. Private evidence is under `.career-ops-web/mobile-qa/search-soft-ranking-20260908/` plus the immutable Synthetic Marketing Profile task record.

Provider counts are a time-sensitive market sample, not a promise that every future search returns the same number. The acceptance claim is about the search semantics, provider path and phone behavior, not constant vacancy supply.

Post-0.3.1 model-routing update: formal evaluation no longer defaults to Sol/medium. Synthetic Marketing Profile → DIGIACADEMY report #9 completed successfully at **2.8/5**, but Sol/medium still required **556.615 s wall** and about **1.37M session tokens**; together with the earlier 755.455 s Citi run, this is sufficient product evidence that Sol/medium is too heavy for the normal mobile evaluation path. Future evaluations default to **gpt-5.6-luna / medium**. This was a routing decision based on real product latency plus the existing bounded screening evidence; no duplicate formal-evaluation benchmark was run. Existing reports remain authoritative and are reused. The next genuine evaluation should provide the first production Luna timing.

## Installed and deployed state

The reconnected Samsung device initially had 0.2.0/code2, while source and the local backend were 0.2.1. The existing 0.2.1 baseline was built and installed before the new work. The continuation is **Android 0.3.0 / versionCode 4**, built and installed over the existing app. The backend reports **0.3.0**. Native instrumentation uses the existing authenticated `https://jobs.thegreatnovel.com` session and asserts the public API version; it is not a localhost-only or Compose Preview demonstration. Unauthenticated public requests remain behind the existing login protection.

Source and APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Final build, install/device and deployment evidence is under `.career-ops-web/mobile-qa/continuation-20260908/`. Do not infer future installation state from this document without checking ADB and the actual package version.

The inherited dirty working tree and parallel JobPilot-owned search work were retained. No reset, clean, stash, commit or push was performed. Real Candidate CVs were not changed by model experiments or device draft tests. Synthetic Finance Profile and Synthetic Marketing Profile are explicitly synthetic; Synthetic Finance Profile's canonical presentation CV changed only through the actual tested accept action.

## Previous acceptance gaps now closed

| Flow | Actual result | Evidence boundary |
|---|---|---|
| Current app on USB device | 0.3.0/code4 built and installed | Real Samsung device, not emulator or preview |
| Homepage filters | High match, due follow-up, interview, decide and repeat high-match navigation passed; selected chip and list count agree | Same backend ID sets drive counts and membership |
| Four-profile switching | Correct profile snapshots and isolated task lists passed | Includes two synthetic personas and two existing real profiles |
| Draft reject | Actual PDF current/proposed views opened; reject kept CV bytes and version unchanged | Tested in Synthetic Finance Profile, not merely with a fixture API |
| Draft accept | A new local draft was accepted; CV v1→v2 once; applied issues entered resolution history | Existing real CVs were compared before/after and unchanged |
| Transient success | Both reject and accept notices were absent after the bounded wait following the timer fix | Configured lifetime 3.5s; test waited about 4.3s, not millisecond-level animation measurement |
| True input change | Native update-analysis action appeared after accepted CV change | Old stale analysis was correctly prevented from being applied |
| Longitudinal analysis | Started from the native update button; navigation stayed usable; completed for v2 with prior accepted changes | Final result distinguishes wording progress from newly acquired experience |
| Saved analysis | After v2 analysis completion only view-analysis remains; two more requests reused the same result | No additional analysis task or model run |
| Task results | Recent search and analysis entries navigate to the actual result; draft opens actual PDF; new formal result opens its job | Older tailored-CV/plan/practice/import routes without an exercised current record are not claimed as newly tested |
| New formal evaluation | New official Citi report #8 persisted; 2.6/5, decision Skip | Existing result reuse alone is no longer the only evaluation evidence |
| Reopening after formal completion | App was force-stopped and reopened; report remained available, Discovery did not re-offer it, evaluate CTA was absent, repeat requests reused it | No second agent was launched |
| Light/dark rendering | Actual home, opportunities, profile, task center and native PDF were captured on the device | Ambient-brightness variation and quantified GPU/frame-time testing are not claimed |

The final keyboard/surface follow-up passed in both light and dark modes: keyboard appearance hides the bottom navigation, and the actual system Back event restores it. Its evidence is `device-keyboard-surfaces.log`. Earlier test failures remain in the private logs instead of being overwritten into an all-green history. An initial route test used the Activity back dispatcher rather than the dialog/system back path; that harness was corrected to send the actual system Back event.

## Product and visual identity

The app keeps the professional, information-first layout but replaces the LinkedIn-like bright blue with a petroleum/teal accent, neutral/slate surfaces and a more restrained wordmark. Job rows and CV/analysis text remain opaque, high-contrast and scannable.

Translucency is limited to the top bar, bottom navigation, task center and compact feedback. Thin tonal highlights create separation. This is **alpha/tonal material, not a real-time background-blur implementation**. There is no blur on CV text and no attempt to turn every job into a glass card. The actual dark screenshots exposed black text on a translucent custom surface; explicit content colors fixed that issue. Material container colors were also made explicit so bottom sheets do not inherit the old lavender defaults. System status/navigation icon contrast follows light/dark mode.

An empty persona with an uploaded CV now sees a first-selection goal and availability context rather than a row of zeros or another request to start with a CV. The final official-report screen shows the report recommendation prominently, while retaining the user's application status as a separate decision.

## Navigation: one destination and filter state

The old list and parent navigation both remembered filters. Returning to a previously composed list could restore “All” despite clicking a filtered metric. The parent now owns the filter and passes it to the list; a metric route includes destination and filter, increments an entry request and clears residual search text.

`dashboard.actionSets` contains the exact canonical job IDs for all/high/due/decide and stage groups. The displayed count and filtered-list membership use the same set, rather than two subtly different predicates. Interview has an explicit selected filter. The implementation preserves existing report/candidature data and does not create a mobile Candidate database.

## Whole-page CV attention and the Synthetic Finance Profile result

See `CV_ATTENTION_MODEL.md` for the full schema and validation contract. One analysis now produces 2–3 priority signals, overlooked evidence, section priority and space trade-offs, real action gaps and an ordered plan covering every CV source block exactly once. Allowed decisions are keep, shorten, rewrite, merge, remove and reorder. An expansion must be balanced by selection or compression elsewhere. Applying the plan uses stored decisions, not another agent for every bullet.

For Synthetic Finance Profile's first markets internship, the plan makes ESCP/quantitative education, association treasury responsibility and ongoing market observation the main line. It does not invent a financial internship or convert treasury support into professional investment ownership. The tested plan reduced **15 bullets to 11**. The actual rendered draft was **one A4 page, 37 rendered text lines, 10pt body, 1.28 line height, 14/15mm margins and no horizontal overflow**. It did not fit by shrinking fonts.

Global acceptance checks actual PDF/layout measurements and rejects an overfull plan rather than auto-shrinking it. This is a readability heuristic plus visual review, not universal ATS certification. Reject keeps the canonical CV unchanged; accept checks base version under the profile lock, writes a backup, advances version once and records actual applied resolutions. Old evidence remains in version history.

The subsequent native v2 analysis explicitly recognized the accepted changes, stated that no new internship or technical skill had been acquired, and retained real action gaps. It did not reopen the accepted wording changes as new deficiencies. Once complete, the unchanged input returned that same persisted result.

## Synthetic Marketing Profile: complete fictional persona and observed limits

Synthetic Marketing Profile is visibly **SYNTHETIC / FICTIONAL TEST PROFILE**, not a real applicant. Canonical files and tasks are in the isolated `synthetic-marketing` profile; the user's other records are not copied into it. The profile is added only to the existing owner's grants. Authentication is not bypassed.

The fictional background uses a real program: ESSEC Grande École — Master in Management, Marketing Track, final year with expected graduation in 2027; fictional prior attendance is a Sun Yat-sen University BBA, 2020–2024. Official program references: [ESSEC MiM](https://www.essec.edu/en/program/master-in-management-international/) and [Marketing Track](https://chairs-tracks.essec.edu/tracks/marketing-tracks).

| Fictional experience | Dates | Evidence deliberately kept junior |
|---|---|---|
| BloomLab Consumer China — Marketing Intern, Shanghai; fictional employer | June–September 2023, four months | Consumer/competitor research support, Xiaohongshu and Excel campaign reporting, KOL briefing/follow-up assistance |
| Maison Asteria SAS — Brand & Marketing Intern, Paris; fictional employer | January–June 2026, six months | Campaign/asset coordination, agency requests, CRM/e-commerce Excel reporting, English cross-country presentations |

Mandarin native, English C1, French B1. Tools are Excel and PowerPoint, not an invented collection of analytics/CRM certifications. No performance uplift, campaign-budget ownership, management or autonomous brand strategy is claimed. The target is a first junior/graduate CDI in Paris/Île-de-France, hybrid permitted, no nationwide relocation, with availability **after graduation, July 2027**. Present vacancies are therefore market research unless their start date can accommodate that availability.

Her analysis identifies education, France/China marketing experience and English collaboration as potential signals. Professional French, limited autonomous ownership and local-market evidence remain real action gaps. The first model output had two real defects: malformed complete JSON, and partially translated English CV text. The same exact run output was recovered and repaired locally without a second model call. Since no consistent CV-language declaration was present, the stored presentation falls back to original wording plus planned ordering/removals and explicitly says so. Do **not** describe this fallback as a fully polished rewritten English CV. The new prompt separates analysis language from CV language and preserves explicit B1. Synthetic Marketing Profile's own canonical CV was not accepted/rewritten on the device in this release; the full decision cycle was exercised with Synthetic Finance Profile.

## Search: evidence-aware constraints, not a successful recall claim

Structured sources and AI supplementation now share one ranking stage. The old finance/quant-oriented terms missed legitimate Marketing roles, and the old AI fallback could bypass the full ranking. The shared stage now supports Marketing/Brand/CRM/Insights, junior seniority, confirmed CDI, regional no-relocation constraints and language evidence. Real pure-sales/senior/3–5-year requirements are excluded from this first-CDI target; unknown contract is not silently called CDI.

For French B1, explicit professional/fluent-French or local-writing requirements incur a relevance penalty and adjacent classification. Explicit international/English working context can retain a role; a description merely being in English is not proof that French is optional. Targeting does not use name, nationality, university or raw CV content. Synthetic tests verify these distinctions, including preservation of an international role.

The **actual small search** produced **zero strong matches and one adjacent opportunity** after offline re-ranking of the same saved output: [Cartelis, Consultant(e) Digital & Data Marketing, CDI, Paris](https://cartelis.welcomekit.co/jobs/consultant-digital-cdi_paris). Its documented bilingual/native-French expectation is a significant mismatch for B1; the app marks it accordingly, not as a strong recommendation. This run did not demonstrate useful live English-friendly recall. Publication freshness remains unconfirmed where the source lacks a reliable date; a reachable page is not proof of a newly posted job or availability in July 2027.

Provider metrics were: France Travail and JSearch **unconfigured**, tracked ATS disabled, development provider disabled; structured API calls/results were zero. The real retrieved page came from one bounded Luna web-supplement run. Do not claim that paid structured-provider credentials were installed or that this test proved a mature junior-Marketing search supply. The adjacent consultant correction used saved source requirements with **zero extra provider or AI calls**.

## New formal evaluation and action synchronization

Citi's Paris Markets Sales & Trading off-cycle 2027 role produced new official report #8 and a profile-scoped candidature. Score **2.6/5**, decision **Skip**: the source's 2027 graduation window and January 2027 six-month start conflict with the existing synthetic candidate's expected 2028 graduation and M1 calendar. The report did not invent an extra internship or score it highly just because “markets” matched.

Completion exposed a real product bug: a previously saved job still displayed the system default “official evaluation required” and “evaluate before applying.” Synchronization now retires only those automatic defaults using the report's real decision/next action. User-authored follow-ups, dates and application decisions are not overwritten. Internal tracker profile/date markers are not displayed as narrative CV/job advice; the original report/tracker remains intact. The completed report was then tested after process reopening, including absent evaluate CTA, correct result route and repeat result reuse.

## Actual operation measurements — not another benchmark matrix

All five rows below are real product operations on the two synthetic personas, not invented timings. The older 11-combination benchmark was not rerun. Queue and setup are distinct from Agent execution; wall time includes the product pipeline. Token values are exact task-session cumulative counters, with cache/reasoning where available.

| Operation | Model / reasoning | Queue s | Setup s | Agent s | Wall s | Input | Output | Cached input | Reasoning | API-equivalent estimate |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Synthetic Marketing Profile first analysis | Luna / medium | 0.139 | 1.544 | 98.240 | 100.234 | 36,613 | 3,733 | 0 | 1,125 | $0.01180 |
| Synthetic Finance Profile global v1 analysis | Luna / medium | 0.043 | 0.662 | 91.884 | 93.162 | 42,793 | 3,347 | 0 | 773 | $0.01258 |
| Synthetic Finance Profile v2 longitudinal analysis | Luna / medium | 0.077 | 120.788 | 204.602 | 326.049 | 40,770 | 3,502 | 0 | 1,345 | $0.01236 |
| Synthetic Marketing Profile small search | Luna / low | 0.044 | 0.714 | 51.913 | 52.933 | 179,728 | 822 | 123,136 | 431 | $0.01477 |
| New Citi formal evaluation | Sol / medium | 0.005 | 120.672 | 634.057 | 755.455 | 1,856,027 | 14,202 | 1,739,648 | 4,739 | $1.44542 |

These dollars use the existing [official API pricing snapshot](https://developers.openai.com/api/docs/pricing). **Actual per-task subscription billing is unavailable and remains null.** Estimates are not charges; they exclude tool fees, tax, regional uplifts and cache-write fees and use the documented Standard/short-context assumptions. The formal evaluation succeeded but is still slow and costly: roughly 12m35s and 1.87M total tokens. Success is not a claim that Sol/medium is now an optimized winner.

Some earlier attempts failed in `acp_session/new` before a model prompt was started. JobPilot now uses a dedicated product runtime cwd with unrelated coding MCP servers disabled locally, not a change to global Codex or other projects. Some new sessions started in under a second, but the final successful evaluation and longitudinal run still had about two minutes of startup; the residual cold-start/queue issue is not declared cured. All setup failures are retained. Explicit retries after those failures are not disguised as zero attempts.

The successful-operation audit found **no duplicate successful model runs for the same profile/operation input identity** in this continuation. Recovering the malformed output, re-ranking the saved search and generating/rejecting/recreating/accepting CV drafts added no model calls. A truly changed CV version appropriately allowed the next longitudinal analysis. No full model matrix was repeated.

## Evidence and remaining work

Private evidence: `release-summary.json`, `release-events.jsonl`, `device-draft-acceptance.log`, `device-longitudinal-start.log`, `device-task-routes-fixed.log`, `device-new-formal-reopen.log`, `device-final-visual.log`, `device-keyboard-surfaces.log`, build logs, final screenshots and profile-scoped immutable task/draft/history records. Targeted new regressions cover attention budgets/source coverage, Marketing constraints, output recovery/CEFR and report-action synchronization. Earlier baseline tests were not indiscriminately rerun.

Remaining limits are substantive: reliable structured-provider supply is not enabled in this workspace; Synthetic Marketing Profile has no demonstrated strong live match; French/English relevance is still heuristic rather than semantic certainty; her first stored English plan is structural-only; not every historic task type has a new end-to-end phone example; explicit performance measurements across ambient brightness/GPU load are absent; and ACP startup plus formal evaluation cost remain too high for a claim of commercial-scale readiness. No Play Store signing, store review or release-track submission is claimed.
