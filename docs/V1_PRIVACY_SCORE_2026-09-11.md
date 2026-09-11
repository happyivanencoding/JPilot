# V1 CV privacy notice and anchored scoring — 2026-09-11

## 2026-09-11 V1 0.4.8 — broad directions, unified role tabs and upload notice

Android 0.4.8/code22 and Web 0.6.8 share one Match/CV/Tracking surface for both discovery and saved jobs. Inferred direction names/queries are broadened while specialty evidence and explicit targets stay intact. CV remains a muted, clickable tab until explicit generation; Tracking saves without AI. The previously unshipped privacy/scoring extension is included: visible pre-upload notice, unchecked acknowledgement, server enforcement and four-dimension deductions. Android comparison reopening fetches the corrected server PDF instead of an older in-memory version. No main/Yifeng merge. Local gates have passed; exact rollout receipts and boundaries are recorded in `docs/V1_0_4_8_RELEASE.md`.

## Release coordination

Privacy/scoring task: `tsk_696f43d284f49212`. The preceding 0.4.6 delivery is owned by completed task `tsk_e9ee71485b1f15b8` (`7b85455` + delivery docs `98e200d`). The active combined release task `tsk_c6d8b6936f8ca1f4` explicitly includes this privacy/scoring work and targets **Android 0.4.8/code22 / Web 0.6.8**. Do not install the older code21 artifact or race another VPS deployment. This task has stopped changing product source; the combined release owner can commit the current privacy/scoring files with its verified tabs/directions/PDF changes. Unrelated AGENTS.md, private evidence, sessions and Python __pycache__ must stay out of Git.

**Combined product source `24d2946686203b8a3489f3a698ad0273fae74814` has now been committed, pushed and deployed to independent V1.** Public Web privacy checks below passed. Phone installation is owned by the combined release task and must be confirmed from its actual receipt, not inferred from the APK build.

## CV information notice

One shared `web/shared/cv-privacy.json`, version **2026-09-11.1**, supplies Chinese/French/English text to the authenticated V1 endpoint and both clients. The small upload link opens the notice; the checkbox starts unchecked and the accept button is disabled until explicitly checked. Server acceptance is recorded before the browser/native file chooser opens. `/api/mobile/upload` checks the persisted record before reading multipart data, extracting text or scheduling AI and returns **428** when absent/withdrawn. The server records notice version, UI language and its own timestamp in the current profile's `mobile/cv-privacy.json`; a client checkbox alone is not authorization.

The notice is deliberately factual: closed-test purposes, CV-derived outputs, necessary troubleshooting, no sale/advertising/JobPilot-model training, no unsolicited employer submission, VPS storage, relevant text sent to configured third-party AI and DeepSeek translation, query/filter-only job search, administrator access for support. Actual configured AI endpoint **hostnames only** are returned without credentials or URL paths/query strings. The live analysis transport in this environment was observed as `api.openai.com`.

### Limits that must not be silently removed

- The current email-only entry **does not verify ownership**. Someone knowing the same email could access that test profile. The notice recommends **fictional or de-identified test CVs**, not confidential personal documents. Checking a box does not repair this access limitation.
- There is no claim of zero breach risk, zero third-party retention, all processing remaining on our VPS, or completed public-launch GDPR compliance. Provider retention/training/international-transfer terms need their own review.
- This version does not implement automatic expiry deletion. It states that plainly, rather than promising an unimplemented retention period.
- My includes the notice and withdrawal/deletion-request controls, including for pre-notice profiles with an existing CV. Withdrawal writes `withdrawnAt`, `deletionRequestedAt`, **`deletionStatus: pending`**. New CV uploads and new AI task creation stop; already-sent calls may finish. No existing files are silently erased and the UI does not claim deletion is complete. An administrator must process the profile, generated outputs, operational records and any backups; third-party copies need separate confirmation.

Controller/contact identified as Jingxuan Li via the test inviter and the in-app data-request channel. Participation is voluntary; access/correction/copy/withdrawal/deletion and CNIL complaint are described without a rights waiver. This is a product notice and control, **not legal review or a complete compliance certification**.

Reference material consulted: CNIL, `https://www.cnil.fr/fr/les-bases-legales/consentement` and `https://www.cnil.fr/fr/informer-les-personnes` (checked 2026-09-11): informed, affirmative, non-prechecked consent, documented choice and transparent purposes/recipients/retention/rights. No user consent is asserted retroactively.

## Why similar job titles had very different scores

Read-only VPS review of the user's synthetic Amina test records confirmed that 25-point specialist Data Engineer freelance work required Databricks/DBT/PySpark/Airflow/cloud plus independent production/SLA ownership, whereas the 74-point Data Engineer apprenticeship accepted an enrolled Master student. Those duties, specialist requirements and seniority differ despite the shared occupational title. Other low scores included explicit three/six-year experience requirements. A shared title is not a reason to force equal scores.

A real implementation defect was also confirmed: previous normalized results did not retain `scoreComponents`, so no reliable per-axis deduction ledger existed. The new UI **does not fabricate a historical deduction explanation**. It offers an explicit updated score on eligible old offers; pending or accepted role-CV baselines remain frozen to avoid contradicting their reviewed draft. A rejected draft no longer freezes the old CV's assessment and blocks a fresh version.

## New scoring contract

`scoring_method: anchored-4x4-v1`, `scoring_version: role-fit-2`. The model classifies each criterion into 0–4 anchored levels; the server calculates points, deductions and the final sum. It cannot accept an unrelated model-supplied total.

| Criterion | Maximum | Fixed awarded points for levels 0/1/2/3/4 |
| --- | ---: | --- |
| Role / explicitly accepted field of study | 30 | 0 / 8 / 15 / 23 / 30 |
| Actual duties and relevant/transferable examples | 30 | 0 / 8 / 15 / 23 / 30 |
| Explicitly required tools and documented language proficiency | 20 | 0 / 5 / 10 / 15 / 20 |
| Stated experience, independence and qualifications | 20 | 0 / 5 / 10 / 15 / 20 |

Each criterion persists `points`, `max`, `deducted`, the explanation, original job/CV excerpts and whether it is provisional. A wholly unknown criterion is set by the server to neutral level2 and labeled **to clarify**, not an invented proven incapacity. Invalid/missing ratings or rationale are rejected. Translation covers the explanation only; points, keys and evidence excerpts are not translated/recomputed. The screen displays the exact arithmetic, e.g. **100 − 24 = 76/100**, rather than claiming every absent keyword has an independent penalty.

Anchors explicitly prevent extra specialist degree requirements, penalizing a student for unrequired production ownership, conflating CDI with seniority, optional-skills-only severe deductions and inferring language proficiency from CV/UI language, names or country. Same-role field fit, duties, technical stack and seniority are separate criteria; a missing skill must not be deducted repeatedly across them.

The scoring prompt omits the retrieval score, profile/version identifiers, company prestige, provider URL and prior cached job narrative. Only CV/notes and actual title/description/contract are passed. Same profile + candidate version + normalized URL + method reuses the persisted task/result, including when only display language changes. Retry recovers an actual failed attempt; completed results are still reused. **No temperature/seed guarantee or claim of mathematical objectivity is made.**

## Real-model repeatability experiment

Eight paid direct API calls, on the actual configured `gpt-5.6-luna` / low-reasoning transport at `api.openai.com`, using a **synthetic student CV and synthetic postings**, not changing any user's saved assessment.

| Probe | Initial rubric | Clarified final anchors |
| --- | --- | --- |
| Identical supervised student Data Engineer input, three independent calls | 86, 85, 93 | **93, 93, 93** |
| Same title, explicit three-year specialist production role | 28 | **35** |

Initial explanations exposed an invented specialized-degree requirement and inconsistent student-duty thresholds. The final prompt clarifies these independently of the desired final total. Final junior components were 30/23/20/20 in all three runs, ~10s each. The senior probe returned 15/15/5/0 after a declared-unknown field was normalized to neutral by server policy, ~13s. Initial samples and the model's inconsistent unknown/rating declaration are retained in private evidence, not hidden. This small controlled sample supports the fix; it is **not a population benchmark or proof every future request is deterministic**. Product reuse supplies stability for repeat visits.

## Verification completed

- **49/49 targeted Node tests**: anchored arithmetic, invalid output, unknown neutrality, prompt noise removal, profile/version task identity, explanation-only localization, explicit/versioned/profile-scoped consent, withdrawal vs fake deletion, rejected-draft baseline release, and inherited language/journey/CV consistency tests.
- Final TypeScript and production Web build passed. Android unit/build passed with installed JDK21; initial wrong PrimaryButton argument failed compilation and was corrected, with logs retained.
- Real isolated browser and actual PDF extraction, controlled local model: denied upload before consent (428, no CV), unchecked/false acknowledgement rejected, explicit server acceptance followed by real file chooser, uploaded CV/selected contract persisted, water animation →100→directions, returning email restores profile, other email isolated; one scoring call reused by repeated requests, four itemized rows and exact76 arithmetic; withdrawal remains pending, blocks new upload/AI and does not pretend to erase the CV. No browser page errors.
- The privacy document and settled score-breakdown screenshot were visually inspected. The earlier screenshot was captured during sheet opacity animation; after waiting for transition completion, the content is correctly opaque and readable.
- Private evidence: `.career-ops-web/v147-delivery/` (`node-tests-final.log`, `typecheck-final.log`, `web-build-final.log`, `android-build-final.log`, `browser-final-settled.log`, `qa-final/`, `live-rubric*.json`). These files, synthetic account/session files and credentials are not committed.

## Deployment / installation receipt

The combined release owner (`tsk_c6d8b6936f8ca1f4`) deployed product **24d2946686203b8a3489f3a698ad0273fae74814**. Its `.career-ops-web/v148-delivery/deploy.log` ends in `V1_DEPLOY_OK` and confirms session/profile isolation/logout, model-key and search-provider gates.

This task then independently opened `https://jobs-v1.thegreatnovel.com` in a fresh Chinese browser session with a new synthetic test email: actual snapshot **0.4.8**, notice **2026-09-11.1**, configured analysis host `api.openai.com`, no prechecked acknowledgement, disabled acceptance, real upload endpoint **428** before consent. Closing the document left the profile empty with **no consent recorded, no CV sent, no AI task**. Browser page errors were empty, the Chinese document screenshot was visually checked and the temporary session was logged out. Evidence: `v147-delivery/public-privacy-result.json`, `public-privacy-zh.png` and `public-privacy.log`, all private.

Phone install/native receipts are supplied by the combined release owner in `docs/V1_0_4_8_RELEASE.md`; this extension does not independently install the superseded code21 or race the user's device.

### USB / APK status at this follow-up

A read-only ADB check returned an **empty device list** and `device R5CXB0BSTVD not found`. This task did not install code22, uninstall the app or clear any data. The current APK metadata confirms independent package `com.thegreatnovel.jobpilot.v1`, **0.4.8/code22**. A published download was verified over HTTPS with **200**, `application/vnd.android.package-archive`, **19,049,147 bytes**; the signed download URL is intentionally not committed. USB installation remains blocked until the phone is available. Web deployment and APK availability do not establish phone installation.
