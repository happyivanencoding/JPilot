# JobPilot Android 0.2 — implementation and acceptance boundaries

## Superseded by the 0.3 continuation

This file preserves the original 0.2 delivery and its failures. For the now-installed Android 0.3.0/code4, closed USB acceptance, successful new formal/longitudinal results and remaining limits, read `ANDROID_0_3_RELEASE.md` and the current `MOBILE_ACCEPTANCE.md`. Do not repeat the old disconnection/failure status as the current runtime state.

Date: 2026-09-08. The sole project authority remains `DEEP_CONTEXT_HANDOFF_FINAL.md`.

## Release status

Android 0.2.0 was built, installed over the existing app on the real USB device, and opened against the updated backend. Native home/filter navigation, the profile's saved-analysis entry and the actual one-page master-CV PDF were inspected on the device. The phone disconnected during acceptance. Android **0.2.1 / versionCode 3** contains subsequent corrections and was built successfully, but was **not installed or tested on that disconnected device**. The final build records live in `.career-ops-web/mobile-qa/20260908-final-*-build.json`.

This is not a claim that every requested flow passed end to end. In particular, fresh formal evaluation and live-model updated-CV continuity did not obtain successful final benchmark results. Existing-result reuse and the data/version/draft operations have separate passing tests.

No reset, clean, stash, blanket replacement of parallel work, commit or push was performed. The pre-existing Android implementation was backed up under the ignored QA directory before modification. A separate structured-job-search change appeared during this work; its source was preserved. Only its JS parameter type annotation and estimated-vs-actual cost labeling were adjusted for integration. Do not attribute its overall design or acceptance to this release's old ACP-only search benchmark.

## Native product changes

The Web workbench is no longer an Android destination. Web remains available independently and uses the same Candidate Authority, CV, jobs, reports and candidature source files.

The five native destinations are Home, Opportunities, Applications, Preparation and Profile. The visual hierarchy emphasizes company, role, score, status and next action, with a restrained blue/slate/neutral palette, compact spacing, flat rows/dividers and small radii. Home metrics are working filtered-list routes rather than decorative cards. A measured zero score is distinct from an unknown score; unknown is shown as unassessed, not 0%.

There is one CV/skills analysis entry in Profile. Saved analysis opens its persisted result. An actual CV/evidence/preference revision exposes an update action. Preparation can link to the saved analysis without creating a second analysis operation. Results distinguish evidence already possessed but poorly expressed from gaps requiring projects, learning or further evidence. Legacy before/after recommendations are imported without another AI call; old narrative conclusions remain explicitly historical.

A new task does not replace the page with a full-screen blank loader. A compact transient notice provides the available historical estimate, then yields to the task center. The center shows active work and about three recent business events with real destinations, not raw ACP transcripts. Duration, token usage and API-equivalent estimate are secondary. Success notices auto-dismiss after 3.5 seconds; errors remain dismissible. Post-build corrections include repeated home-filter navigation, very-fast task completion notices, safer upload response projection and per-profile PDF caches.

Structured contract types are Stage, Alternance, CDI and CDD. They are persisted under `target_roles.contract_types`, included in search intent and used to reject known incompatible contracts; an unverified contract is not falsely declared permanent.

## Backend idempotency and input history

`mobile-state.mjs` implements a short, cross-process profile lock and atomic operational JSON writes. The lock encloses result/task lookup and creation of the single queued task claim. It is not a second Candidate database. Existing profile files, report/tracker reconciliation and candidature records remain authoritative.

The formal-evaluation identity is profile plus normalized canonical job URL, preserving job-identifying parameters while removing tracking variants. A persisted official report or a real curated candidature evaluation is returned without a new agent. An existing queued/running/reconciling task is reused. Android and the public Web evaluation/tailored-CV entry points pass through the same task gate. Discovery is a derived view: completed evaluations disappear from its ordinary queue, while in-flight tasks are marked as evaluating. Subscriber disconnects do not own or cancel the underlying task.

CV, configuration and verified profile notes are snapshotted into immutable input revisions. Exact content changes—not a fresh mtime, checksum or a page reload—determine new input identity. CV version increments only when CV text changes; evidence/preference changes create an input revision without fabricating a new CV version. Legacy results are adopted only where existing source timestamps support that the saved analysis followed those inputs. Historical data beyond the 60-item UI list remains eligible for reuse.

Analysis is keyed by input revision, not UI entry point or response language. Search includes its real query and date so time-dependent opportunities can refresh. Tailoring and preparation use the selected job evidence; practice and advice use the actual question/answer. An explicit retry is required after a known failure. File upload reuse compares the retained successful source bytes, avoiding redundant extraction of an identical file.

Restart recovery observes the original ACP run and existing report store. It never starts a replacement agent merely because a web process restarted. Completed structured output can be recovered. Unknown legacy runs without enough identifiers remain in reconciliation rather than permitting speculative duplicates; they still need operator investigation. This conservative case is not an automatically solved recovery flow.

## CV rewrite, acceptance and rendered preview

A rewrite applies explicitly selected, unique `before` spans from the authoritative analysis. It preserves the current Candidate evidence, rejects new unsupported numbers and requires the user to review a separate draft. It does not ask a second agent to rewrite the same recommendation, and does not overwrite the canonical CV while preparing the draft.

The actual backend PDF is displayed through Android PdfRenderer, with current/draft tabs, page count, scrolling and pinch zoom. Master-CV preview renders current canonical Markdown, not an invented reconstruction of the original imported Word/PDF layout. It preserves content and warns about multiple pages rather than silently deleting evidence to claim one page. It is not universal ATS certification.

Rejecting a draft leaves the canonical bytes and version unchanged. Accepting checks the base input version under the profile lock, writes a backup, advances CV version once, records selected issue resolutions with before/after text and retains history. Repeated acceptance does not add another version. A stale draft cannot overwrite newer CV/evidence. Resolved issues leave the current open list; the next analysis prompt contains the old CV, old analysis, accepted edits and the new sources. Semantic evidence fidelity is not proven merely by a literal-span check: generated wording still needs human review, and the live updated-analysis quality run remains unverified.

Tailored CV generation now saves its structured model output before HTML/PDF rendering. A renderer/ATS failure can be retried from this output with zero new model calls. This was verified using all three actual generated benchmark CVs. The ATS checker was corrected to ignore literal `<img>` examples in HTML comments/CSS; a rendered content image is still detected.

## Measurements and model choices

See `AI_BENCHMARK_2026-09-08.md` for the full real matrix, input/output/cache/reasoning tokens, queue/agent/wall times, failures and local rendering recoveries. Actual subscription cost is not available per task; dollar figures are explicitly API-equivalent estimates using the cited official rate snapshot. Context occupancy is never presented as consumed tokens.

Defaults remain Luna/low for AI discovery supplementation, Luna/medium for CV/skills analysis and career advice, Terra/medium for tailored CV generation, and the prior Sol/medium baseline for formal evaluation. The last choice is retained because fresh evaluation experiments were inconclusive, not because Sol won a completed comparison. Apply-expression-to-draft is deterministic and costs zero additional AI tokens. Interview plan, practice and comparison settings were retained, not independently benchmarked.

Numeric ETAs require at least three comparable successful production runs for the same flow/model/reasoning. Reused outputs and isolated synthetic benchmark timings do not artificially improve the prediction. Otherwise the interface says it usually takes a few minutes.

## Verification actually obtained

- Sixteen targeted backend/transport checks passed in the recorded run, including cross-process competing claims, concurrent evaluation reuse, legacy-history reuse, profile isolation, version transitions, draft accept/reject, source-span safeguards, contract filtering, cumulative token accounting, ETA boundaries and non-closing SSE responses.
- Twenty-nine ATS self-checks passed, including the corrected false-positive regression. These are heuristic checks, not proof of compatibility with every ATS.
- `verify-mobile-acceptance.mjs --profile=<existing-profile-with-analysis>` passed seven checks: real profile task separation, eight concurrent unchanged-analysis reuses, eight concurrent existing-evaluation reuses, no added tasks, foreign job/task/report rejection, unchanged real canonical CV bytes, and synthetic actual PDF/draft/version/continuity-state acceptance. No production model call or real Candidate CV mutation was used for this verification.
- Next.js typecheck/build passed. Android assembleDebug passed. Android unit-test task reported NO-SOURCE earlier; it must not be reported as native UI tests passing.
- USB evidence exists for the installed 0.2.0 UI, high-match filtered navigation, saved-analysis entry, A/B analysis page and the actual one-page master PDF. A later draft-start capture is not treated as proof that draft acceptance/rejection was performed on the phone.

Raw evidence and screenshots remain local in `.career-ops-web/mobile-qa/`; do not commit CV previews, private task records or raw transcripts.

## Remaining acceptance work

Reconnect the phone and install 0.2.1 before claiming its final changes were device-tested. On-device rapid evaluation taps, persistence after reopening, draft current/proposed switching and both decisions, exact transient-notice duration, task-completion deep links and all profile switches are still incomplete as a single end-to-end acceptance pass. Backend tests cover several of those states, but are not a substitute for USB evidence.

Investigate the intermittent ACP session/setup failures using the saved run IDs and artifacts before rerunning experiments. No successful fresh formal-evaluation report or live updated-analysis continuity run was obtained in the final benchmark set. Retain the existing evaluation baseline and do not claim the new evaluation generation chain is fully verified. The explicit evidence checks also cannot guarantee that every future LLM reformulation avoids subtle unsupported implications.
