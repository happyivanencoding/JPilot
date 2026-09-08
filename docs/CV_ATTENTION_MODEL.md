# Global CV attention model

Updated 2026-09-08. Subordinate to `DEEP_CONTEXT_HANDOFF_FINAL.md`.

## One decision about the whole page

Analysis remains one persisted operation per profile/input revision. A UI or prompt upgrade alone does not invalidate an existing result. The new analysis result combines `globalPlan`, concise expression changes, actual capability/action gaps, and prior-version continuity. There is no model call for each recommendation or each layout attempt.

`globalPlan` contains 2–3 evidence-backed primary signals, overlooked signals, section allocations and paired space trade-offs, plus a complete ordered `targetBlocks` plan. Source blocks have local IDs within that exact CV version. Each source block must be accounted for exactly once: keep, shorten, rewrite, merge or remove. Order determines movement. A removed block is an explicit decision, not silent loss; the prior CV remains in immutable history.

The user-facing UI has whole-page priorities, presentation and real-action tabs. Junior users see education, relevant responsibility and project evidence before generic skill lists. Real language gaps or lack of professional ownership cannot become wording-only fixes. The plan cannot mark B1 as fluent. It must not infer incompetence merely from missing CV evidence.

## Content selection before font shrinking

Junior planning targets are at most 470 words, 12 bullets overall and 3 consecutive bullets for one experience/project; experienced planning has larger limits. These are product heuristics, not universal hiring rules. A plan that exceeds them is not made to fit by reducing font size.

The preview renderer uses actual A4 PDF output, 10pt body text, 1.28 line height and 14/15mm margins. It records actual page count, text lines, long bullets, section positions, horizontal overflow and occupied height. Global-plan acceptance requires one page, no horizontal overflow, at most 56 lines and no more than one bullet over three lines. The exact rendered values, not model claims about page count, decide acceptance. These checks do not certify every ATS or prove recruiter preference; final visual review remains necessary.

## Deterministic application and evidence boundaries

Apply-plan uses the stored complete plan and creates a separate draft. Local validation rejects duplicate/missing source blocks, unsupported numbers in rewritten source spans, identity/contact changes and lost explicit language levels. The fictional marker remains visible for fictional personas. A global plan cannot be applied as unrelated independent paragraph expansions.

The draft has base input version, source analysis, changes and layout metadata. Accept checks that the CV/evidence has not changed, then writes a backup and advances the CV version once. Reject leaves canonical content and version unchanged. A retry of a local render never calls AI. Only actually applied expression changes are resolved; a source-wording fallback must not mark its unapplied rewrites as fixed.

## Analysis language is not CV language

A real failure in the first synthetic Marketing test was a French explanation accompanied by a partially translated English CV. The analysis prompt now explicitly reads the requested presentation language from `config.cv.language`, separately from the explanation language, and requests `globalPlan.cvLanguage`. English CV headings must not be mixed with French replacement bullets.

For the already-generated result, no second model was invoked. Because the result lacked the required presentation-language declaration, `preservePresentationLanguage` conservatively retained original source wording while preserving planned order/removals. The UI explains that this is a structural-only plan. This is narrower than claiming all proposed rewrites were applied. Future analyses include the correct language contract, while the saved old result remains available without regeneration.

## Complete output, not partial summary

The previous generic extraction helper could salvage a summary from syntactically malformed JSON and incorrectly mark a whole analysis as complete. Global analysis now rejects a summary-only or cut-off output. A local syntax repair handles complete JSON with a witnessed dangling delimiter; it never supplies missing candidate evidence. Existing nested action arrays can be moved to their declared structural location without rewriting their contents.

ACP's event history may be bounded. The adapter can recover only the exact task's new Codex session final response, validated by session metadata. It does not read unrelated conversations. Complete output is persisted before parsing. The actual first persona result was repaired under the same task ID with zero additional model calls and a retained pre-recovery backup.

## Relevant source and focused regressions

- `web/src/lib/cv-global-plan.mjs`, `cv-analysis-prompt.mjs`, `analysis-result.mjs`.
- `web/src/lib/mobile-history.ts`, `mobile-engine.ts`, `ai-metrics.mjs`.
- `web/scripts/render-reference-cv.mjs`, `inspect-saved-analysis.mjs`.
- Android `CvAnalysisScreens.kt`, `CvPreview.kt`.
- `web/tests/junior-attention.test.mjs`, `analysis-recovery.test.mjs`.

For device acceptance, real runtime metrics and remaining failures, read `ANDROID_0_3_RELEASE.md` and `MOBILE_ACCEPTANCE.md`. Do not confuse compiled-plan checks or an ATS heuristic with on-device visual acceptance.
