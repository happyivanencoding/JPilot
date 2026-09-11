# V1 0.4.6 — first-run experience and role-CV continuity

Scope: independent `feature/v1-student-match-loop-20260910`, Android `com.thegreatnovel.jobpilot.v1` **0.4.6 / code20**, Web **0.6.6**, snapshot **0.4.6**. No product main/Yifeng merge or deployment.

## Product contract

- First upload requires one or more of Stage, Alternance, CDI, CDD. The selected types travel with ingest and are saved together with the original CV, before profile analysis and first search. Unknown-contract offers are not silently treated as matching; recognized freelance roles do not match the selected four types. Non-contract preferences remain soft.
- First CV analysis and first role search share the full-screen rising-wave progress. All AI progress shows a number and percent sign without `≈`; only real analysis/match/translation readiness reaches 100. Failure stops progress. The first-result deck has one shared instruction; opening a card enters the normal product. First-run logout and the generic continue-exploring action are removed; My retains logout. Empty-result/error recovery still permits changing direction.
- My has one Languages card: App and insights, Application CV, and an expandable override for a different insights language. Theme is separately labelled Appearance. Uploaded-document language is detected from original text; output preference does not masquerade as a spoken-language skill or restrict the job market.
- Bounded French/English role vocabulary expands existing provider queries and recognizes corresponding role titles without using CV language, UI language, name or nationality. Existing provider budgets remain bounded. Deep-match prompts explicitly compare document meaning, and may only use actual proficiency plus a stated vacancy requirement for language gaps.
- Opportunities with role CVs have a tinted card and an explicit preparing / ready-to-review / saved label. Offer and saved-role details expose the CV entry prominently. My retains its collection. First matches are ordered by their current match scores after deep analysis, not provider order.
- Each new draft freezes its original role assessment as `matchBasis`. CV review now uses the same role/domain 30, duties 30, tools/required language 20, level 20 rubric instead of a second writing-quality rubric. Only actual draft improvements count. First estimates are not promises: an original 31→43 estimate followed by a reviewed 39 is consistently displayed as 31→39 across card/detail/draft. Raw assessment data is retained; legacy draft projections use the existing bounded-gain rule, without paid bulk reanalysis.
- Role-PDF preview offers Compare original / highlight changes. It compares the actual draft PDF to the frozen original CV version and overlays green added wording / amber rewritten wording, without reflow, OCR, replacement text or modified source facts. Unchanged moved wording is not marked as new. Android PdfRenderer and Web pdf.js receive the same graphics. The clean CV remains the keep/download/share output; comparing never accepts a draft.

## Local acceptance, 2026-09-11

- 42 targeted Node tests passed: account persistence, import/contract-language separation, complete translated first-run sections, reviewed-score consistency, bilingual retrieval and contract rejection, progress and legacy projection. Added five focused score/search tests and expanded the real ingest test. This is not a claim of rerunning all legacy suites.
- PDF comparison: two Python tests pass, including unchanged/moved text and equal PDF page geometry/text/word coordinates with an actual changed render.
- Web final TypeScript and production build passed. Android unit tests and debug build passed using installed JDK21. The initial build picked Android Studio's incompatible JBR25; it failed before compilation and was rerun with the existing compatible JDK, without changing dependencies.
- Local browser used real PDF extraction, real account persistence and a controlled local model response: required contract selection → full-screen animated CV water → 100 → directions; no first-run logout; return-by-email restores the same CV/workspace; another email remains isolated. Unified language controls were inspected. No API key or external model used in this local test.
- The first resumed Node run exposed a real new-import bug: passing an artificial no-config Candidate into `documentLanguage` caused js-yaml to reject empty input. Ingest now calls the existing `detectedDocumentLanguage` directly on original text. The affected import and dependent tests pass after the fix.
- Private evidence stays under `.career-ops-web/v146-delivery/`, outside Git. Pre-existing `AGENTS.md` edits are preserved and excluded from this release.

## Delivery receipts

VPS cutover, live-model/CV preview acceptance and USB installation are pending at this source commit. Add the actual receipts after those operations; local controlled-model checks do not prove live AI success.
