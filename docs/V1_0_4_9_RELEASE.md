# V1 0.4.9 — Privacy, stable potential and application tracking

Date: 2026-09-11. Runtime task: `tsk_99d26eda3feba7ee`.
Branch: `feature/v1-student-match-loop-20260910`. Android package remains `com.thegreatnovel.jobpilot.v1`, version **0.4.9 / code 23**. Web package **0.6.9**, mobile snapshot **0.4.9**.

## Product behavior

- The shared privacy notice is now `2026-09-11.2`. It contains no personal project-owner name. Every opening defaults to **English**, with **Français** second and **中文** third, independently of application/analysis preferences. Questions go to the person who supplied the invitation code. Consent records the selected notice language, not the menu language. Explicit unchecked consent, profile scope, pending deletion and withdrawal gates remain intact.
- For one frozen role assessment and original CV, **initial potential and actual review are different values**. Example: initial `65 → 80` remains visible after an actual `65 → 65` review. `matchScore.forecast` and `potential` remain the original estimate; `reviewedScore` is separate. Neither generation, zero gain, adoption nor reopening overwrites the frozen baseline/forecast. A genuinely new master-CV assessment may have a new basis. No gains are invented, and existing stored bases require no data migration.
- Native/Web Match tabs no longer mount the per-criterion scoring breakdown or formula. Internal scoring remains unchanged. Strengths, presentation improvements and practical capability gaps remain visible. Future analyses request more concrete explanations linking CV experience to actual duties; historical assessments are not silently regenerated or re-scored.
- **My → Profile / Applications** is now shared across native and Web. Applications includes all canonical saved/tracked roles, including replies, interviews, offers, hired, rejected and archived. There is no twelve-role cap. Search by company/title and filter any status; activity order is newest first. Each role shows its state, recorded dates/notes/reply and available CV versions. Opening it goes directly to Tracking. Saved CVs are not represented as submitted documents. Only user-written next actions appear in the list, not the generic pre-evaluation placeholder.

## Validation

- Purposeful Node regression: **41/41 passed** across V1 feedback, CV consistency, match, privacy, role tabs, polish and journey tests. This covers immutable `65/80` versus actual review, acceptance/reopening, no fake gain, more than twelve records and all status filters. One pre-existing exact-object assertion was updated for the new explicit `reviewedScore: null` field.
- TypeScript `tsc --noEmit`: passed. Web production build: passed.
- Android `testDebugUnitTest assembleDebug`, JDK 21: passed. Existing Gradle/Compose deprecation warnings are non-blocking.
- Isolated Chrome acceptance uses the real application, PDF importer, account and tracking APIs, with controlled local model responses and a synthetic saved-review fixture. It verifies EN/FR/ZH notice tabs, French consent recorded under English menus, English notice under Chinese menus, no visible rubric, unchanged initial forecast after a zero-gain review, all **19 roles / 9 states**, search, Tracking edits read back from My, and no extra AI calls from browsing or tracking. Consent refusal/withdrawal and cross-profile isolation remain covered. This is not a live-model quality benchmark.
- Private logs/screenshots: `.career-ops-web/v149-delivery/`. No personal CV, session, key or screenshot is committed.

## Delivery boundaries

Only the independent V1 stack at `jobs-v1.thegreatnovel.com` is a deployment target. Production main and Yifeng staging must not be rebuilt, merged or modified for this release. Existing unrelated `AGENTS.md` edits and `web/scripts/__pycache__/` are excluded from the product commit.

ADB returned **no attached device**. The new APK is built, but it must not be described as installed or physically tested on the phone. Updating an old V1 APK is required to obtain the new native labels and tabs.

Deployment and artifact receipt are recorded after publication below.
