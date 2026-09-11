# V1 0.4.8 — broad directions, one role view and upload privacy

Scope: independent `feature/v1-student-match-loop-20260910`; Android `com.thegreatnovel.jobpilot.v1` **0.4.8/code22**, Web **0.6.8**, snapshot **0.4.8**. This release also delivers the previously unshipped privacy/scoring work from `tsk_696f43d284f49212`; version 0.4.7/code21 was only built locally and is superseded. Current delivery task: `tsk_c6d8b6936f8ca1f4`. No main/Yifeng product merge.

## Product changes

- Inferred directions use broad market role names: for example Data analyst, Economist, ESG analyst and Policy analyst. Specialty knowledge remains in evidence, not mandatory query qualifiers. Existing analysis is projected locally without re-running AI or rewriting the CV. Deduplicate related inferred suggestions; preserve explicit target roles and custom searches. Future analysis prompts follow the same rule.
- A discovery offer and its saved candidature now use one three-tab detail component on both clients: Match / CV / Tracking. Opening or switching tabs is read-only. Before a role CV exists, the CV tab is visibly muted with a lock but stays clickable. Its explicit Generate my role-specific CV button is the only generation trigger. Completion updates the same role/tab, without redirecting to another window. Tracking can save an unsaved offer through the canonical writer without an AI task.
- Privacy notice is now part of the actual release, not leftover local work: a small link plus a mandatory pre-upload dialog, no preselected checkbox, server-versioned acknowledgement, and only then the file picker. The upload endpoint refuses an unacknowledged upload before reading multipart data. My exposes the same notice and an explicit withdrawal/deletion-request control; withdrawal is pending administrator action, never represented as completed erasure.
- Notice text states actual limits: third-party AI and translation processing, stored profiles and debugging, no unrelated commercial reuse or unrequested employer submission, unverified-email preview and recommendation to use fictional/de-identified CVs, no claim of instant erasure, automatic expiry or fully audited EU compliance. It does not promise zero breaches or zero third-party retention. Required public-launch follow-up includes confirmed controller contact details, retention period and third-party/cross-border arrangements.
- Adopted scoring extension uses fixed 0–4 anchors across the existing 30/30/20/20 dimensions. The server computes awarded/deducted points and retains reasons and source excerpts. Candidate/company/URL/retrieval metadata do not anchor an irrelevant score. Translations cannot change points or source excerpts. Old reports without a breakdown are not retroactively given invented deductions; original role-CV baselines remain frozen.
- The server PDF overlay fix from 0.4.6 (`wrap_contents`, derivative layout v2) is preserved. Android now fetches the current comparison when comparison is reopened instead of keeping an in-memory pre-fix PDF. Switching the already loaded highlight/original tabs does not re-generate a CV. Clean PDFs remain the documents used for keep/share/download.

## Local acceptance

- Web TypeScript and production build passed; Android debug unit tests and assemble passed with the existing installed JDK21. **46 targeted Node tests passed**, including broad-label mapping, preserving explicit targets, read-only role projection, current contract/language rules, consent/withdrawal isolation and scored-draft consistency.
- Browser acceptance uses real local application APIs, persisted accounts, real PDF extraction and a controlled model, not paid/live AI. It verifies mandatory unchecked notice → server acknowledgement → file picker; refusal sends no CV and calls no model; source CV and chosen contracts persist; full-screen water; broad suggestions; old-email return and cross-profile isolation.
- The same browser test opens one role and its three tabs, checks that visiting CV creates no candidature or CV task, saves Tracking without any extra model call, keeps the same window/tab, and displays the identical Match breakdown from saved/discovery entry points. It then withdraws consent, confirms a pending deletion request, and verifies new uploads/AI tasks are blocked while original data remains intact.
- Two early browser test failures were test setup only: an invalid non-UUID synthetic search filename was ignored by the real task reader, then the selector targeted a prerendered hidden Home card. The fixture now uses a valid task UUID and the visible card; the full test passes. These failures are not hidden or treated as product regressions.
- Previously performed live calibration evidence is retained in private `v147-delivery`: three identical junior inputs each returned 93; changing the same-titled job to a senior requirement returned 35. This small experiment does not prove all future model calls are deterministic. Persisted task reuse and fixed arithmetic provide repeatable displayed results for the same stored assessment.

## Privacy reference basis

The notice is an implemented information/choice mechanism, not legal certification. CNIL requires clear information at collection and lists purposes, recipients, retention, controller contact and rights; consent must involve a clear positive choice and permit withdrawal. References checked 2026-09-11:

- https://cnil.fr/fr/informer-les-personnes
- https://www.cnil.fr/fr/les-bases-legales/consentement

## Delivery receipts

At this source commit, deployment and USB installation are pending. Add the exact deployed SHA, real Web/native PDF/privacy checks and non-V1 isolation readback after performing them. Private test artifacts stay in `.career-ops-web/v148-delivery/`; they must not enter Git.
