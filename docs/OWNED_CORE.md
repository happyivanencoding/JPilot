# JobPilot owned backend — 0.5.0

## Scope and integration baseline

This change starts from the previously accepted `refactor/jobpilot-simplify-20260909@c04e053`, which already includes every commit in `main@1c3ebb3`. A separate `refactor/jobpilot-owned-core-20260909` branch carries the replacement work. The owner's latest request authorizes a new integrated main after acceptance; it supersedes the earlier temporary hold recorded in `REFACTOR_2026-09-09.md`.

The product baseline remains the current Android/Web application, not every command ever shipped by upstream Career-Ops. Android screens and Web components are retained, including onboarding, independent UI/material languages, discovery/batch operations, evaluated zero scores, CV draft edit/review/accept/reject, presentation-score floor, AI progress and collapsible interview plans.

## Replaced implementation, not a renamed wrapper

| Former dependency | Current implementation |
|---|---|
| Root tracker reader/helpers, alias JSON and broad Web data facade | `backend/workspace.ts` and `backend/tracker-document.mjs` read existing private ledgers/reports directly. |
| Report-number reservation process, staged TSV and merge CLI | `backend/evaluation-ledger.ts` allocates and saves the report and tracker entry under the existing cross-process locking primitive. |
| Scanner/provider import to append a saved opportunity | `backend/inbox.ts` writes the existing inbox/history formats directly, deduplicates within profile scope and reports actual I/O failures. |
| Root CV templates, HTML builder, PDF child process and ATS CLI | `backend/cv-document.mjs` renders a new single-column A4 document with Chromium, checks actual PDF text/pages and returns advisory ATS metadata. |
| Reference-CV renderer subprocess copied into Candidate directories | The same backend module renders canonical/reference previews directly. |
| Prompt fragments loaded from upstream `modes/` | Product-owned, evidence-first instructions assembled in the existing task orchestrator. |
| Dynamic root ATS provider catalogue | `job-search/providers/ats-board.mjs`: direct read-only adapters for the eight provider families reachable from the installed employer configuration. |
| URL/JSON/report/origin helpers and a separate profile seed file | Small product-owned modules and an explicit preference writer that preserves unrelated Candidate configuration. |

No additional model agent, migration engine, compatibility CLI wrapper, database or checksum layer was introduced. The existing model transport, Candidate versions, explicit draft confirmation, profile access control and task identity remain in place.

The active application no longer loads executable code from its Candidate data directory. Test fixtures deliberately contain only data. The historical environment/cookie/private-directory names remain because existing installations use them; renaming those identifiers would not improve ownership and would add an unnecessary migration.

## Removed source

The cleanup removed 812 tracked legacy root files (approximately 9.3 MB), plus replaced/dead Web helpers and their implementation-only tests. Retired areas include the root CLI scripts, scanner/provider/plugin catalogues, modes, CV templates/fonts, engine tests, examples, eval runners and old distribution configuration. Only explicitly tracked files were unlinked. Private notes, ledgers, generated documents, `.career-ops-web`, ignored configuration and secrets were not recursively deleted.

The root package is now a small JobPilot command entry point with no engine dependencies. Web runtime dependencies are installed from `web/package-lock.json`. The source is formatted for maintenance; a lower line count is not itself an acceptance criterion.

## Compatibility evidence

A read-only comparison against the installed data captured four profiles, 29 application records and 29 report documents. The new reader returned the same fields and complete report contents as the previous implementation. No production Candidate write was needed for this check.

The new ledger tests cover existing report reservations, concurrent allocation, zero scores, header reordering/extra columns, CRLF preservation and failure without false persistence. Inbox tests cover normalized duplicates, profile separation, unchanged historical TSV bytes and rollback on an actual write failure. Preference tests preserve unedited evidence and reject malformed existing YAML instead of overwriting it.

Generated PDFs intentionally use the new JobPilot layout, not pixel copies of an upstream template. The user-visible capabilities remain: a real PDF, selectable text, French/English material, page-limit enforcement, ATS warnings, keyword coverage, preview and user confirmation. Structural ATS scores are advisory and may differ from the retired heuristic. Existing saved CVs/PDFs/scores are not rewritten. Canonical previews can preserve a longer source document; tailored one-page output is rejected when overlong rather than silently truncated or shrunk.

## Search scope and public protocols

The installed employer configuration routes to Greenhouse (37), Ashby (39), Lever (9), Workable (4), Gem (1), Phenom (1), iCIMS (1) and SuccessFactors (2). The 23 entries that previously did not route to the tracked-board adapter still do not route there; other product discovery paths remain available. No claim is made that every unused provider in the former CLI catalogue remains supported.

Official public protocol references include:

- Greenhouse Job Board API: `https://docs.greenhouse.io/job-board.html`
- Ashby public posting API: `https://developers.ashbyhq.com/docs/public-job-posting-api`
- Lever postings API: `https://github.com/lever/postings-api`

For employer-hosted public endpoints without an equivalent stable public API specification, the implementation was verified against the currently configured board responses. One bounded live probe per family completed successfully. Seven returned postings; the selected Lever board returned an empty public list. Paginated probes were intentionally limited to one page per locale; they are not a completeness audit of the whole job market. Warnings explicitly identify partial pagination or optional enrichment failures, and request counts now count real HTTP requests; a cache hit counts zero new requests.

## Acceptance on the replaced source tree

| Gate | Evidence |
|---|---|
| Node product/backend tests | 165 passed, zero failures and zero skipped. Counts are lower than the old main because tests exclusive to deleted implementations were retired, not suppressed. |
| TypeScript and Next production build | Passed, Web 0.5.0. Server PDF/browser packages use their installed workers through Next's external-package mechanism. |
| Chromium/Edge UI suite | 25/25 passed with synthetic API fixtures. |
| WebKit UI suite | 25/25 passed with synthetic API fixtures. |
| Chromium/Edge real backend | 7/7 passed against a built server and data-only root, including actual preference writes and a real PDF response. |
| WebKit real backend | 7/7 passed against the same backend contract. |
| Deterministic CV render | French financial layout, English standard layout, canonical preview and oversized-document rejection passed. Actual PDF pages were rendered with PyMuPDF and visually inspected. |
| Real model flows | Analysis 24.616 s; evaluation 11.495 s; CV generation/assessment 20.555 s; plan 38.802 s; practice 21.557 s; compare 25.631 s; coach 32.665 s; display localization 2.246 s. All completed using fictional Candidate data. |
| Android build | Existing 0.3.8/code12 sources packaged successfully; tasks were up-to-date and unit tests were `NO-SOURCE`. No device installation or phone acceptance occurred. |

The eight model runs are functional samples, not latency guarantees, hiring-probability validation or proof of all possible outputs. Real-model output, provider traces, private read comparisons and screenshots remain ignored local artifacts, not public Candidate data.

Useful commands from `web/`: `npm test`, `npm run typecheck`, `npm run build`, `npm run qa:backend`, `npm run qa:cv`; `JOBPILOT_QA_ENGINE=webkit` selects WebKit for browser acceptance. Model verification remains a separate explicit operation because it incurs inference requests.

## Commercial ownership and licenses

The project is independently maintained and the legacy runtime has been replaced. That does not make this a clean-room implementation or erase prior copyright, inherited tests, repository history, standard dependencies or contributor rights. The original MIT notice remains in `LICENSES/career-ops-MIT.txt`; JobPilot's existing AGPL-3.0-only choice is unchanged. Neither changing names nor deleting an attribution file would make the product exclusively proprietary. Any future license/distribution change requires a separate rights decision, not another code cleanup.

## Release boundary

Integrate only after the above gates pass and a fresh main/status check confirms no concurrent work will be overwritten. A running old backend may still spawn the deleted legacy scripts, so stop it before advancing its working directory, rebuild/install Web dependencies and restart Web plus the gateway together. Preserve all private data and existing sessions. Final integration/deployment identifiers belong in the release handoff after the cutover is verified.

## Verified main cutover — 2026-09-10

Main was fast-forwarded from `1c3ebb3` to source commit `7501b9f` after acceptance; no reset, force push or overwrite of parallel work was used. The owned-core branch and main were both pushed and their remote references checked. The previously accepted simplification branch remains available as historical evidence.

The installed main directory completed `npm ci` and a fresh Web 0.5.0 production build. Web and gateway were restarted: local Web returned HTTP 200 with the JobPilot page, and the unauthenticated gateway returned its expected HTTP 302 login redirect. This is a backend deployment, not an Android installation or an authenticated phone acceptance claim.

A private before/after comparison confirmed that 50 existing canonical/profile/ledger/report files across four profiles retained their contents through the cutover. No Candidate data was committed. An orphaned old gateway process was explicitly verified and stopped during maintenance; stopping the scheduled task alone is not proof that its listener has gone away.


## Physical Android follow-up — 2026-09-10

The existing APK is now physically installed as 0.3.8/code12. Native navigation, language separation, saved-report reuse, one new assessed PDF draft, reject, profile isolation and interview controls were exercised. A literal-Markdown-emphasis issue found in the real tailored PDF is corrected by the shared renderer in Web/backend 0.5.1; both clients consume the corrected PDF. No Android/Web interface change was necessary. Current backend regression: 166/166 and production build passed. See `DEVICE_ACCEPTANCE_2026-09-10.md` for the exact physical evidence, interrupted intermediate run and untested boundaries.
