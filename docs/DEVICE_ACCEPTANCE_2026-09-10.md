# Physical Android acceptance — 2026-09-10

## Installed release and scope

The connected Samsung SM-S928U1 was upgraded **in place from Android 0.3.7/code11 to 0.3.8/code12**, using `adb install -r`. Existing login, profile selection and local preferences were retained. The installed client called the authenticated `https://jobs.thegreatnovel.com` backend; ADB reverse was empty. Android is still 0.3.8: the later **Web/backend 0.5.1** patch changes the shared PDF renderer, not the APK contract (0.3.8).

Two explicitly fictional profiles already present in the owner's workspace were used for business-flow acceptance. No application, email or interview answer was submitted. No real Candidate source was edited. Original profile/UI-language/theme preferences were restored afterward.

## Actual device results

| Check | Evidence |
|---|---|
| Installation and launch | APK installation succeeded; package version/code confirmed; first recorded cold Activity launch 897 ms. |
| Navigation and onboarding | Five native tabs clicked and selection asserted. Skip-guide suppresses the remaining tab guides. |
| UI/material languages | Chinese → French → Chinese controls worked; source CV and application language unchanged; switching languages created no business task. |
| Existing analysis and evaluation | Three analysis views and the report view opened. The report screenshot captured display-translation in progress; completion of that full-report translation was not asserted. Repeating formal evaluation for its URL returned `completed` + `reused`, with no new task. This was reuse, not a fresh evaluation inference test. |
| New tailored-CV workflow | A real native button started one direct-API CV task; the central background feedback appeared; the task completed in **21.066 s**. The pending one-page PDF had ATS 85/100 and presentation comparison **82 → 90 (+8)**. These are one fictional example, not general performance or hiring guarantees. |
| Confirmation boundary | Reject left the master CV and previously saved job CV unchanged. No Accept operation was exercised in this round. |
| Native PDF rendering | Two existing master PDFs and the newly generated tailored PDF downloaded and opened. Follow-up checks waited for the actual page bitmap, not just a downloaded file or loading spinner. |
| Profile isolation | Switching to the other fictional profile cleared the foreign job context; its own PDF was readable. |
| Interview preparation | Existing plan collapsed/expanded; Practice this question scrolled to the simulation area. An actual visible-field click and typed marker were checked in a screenshot: the answer field was above the software keyboard. No keyboard layout change was necessary. |
| Theme | Light and dark native views were captured and inspected. |

`OwnedCoreDeviceAcceptanceTest#installedClientUsesRemoteOwnedBackend` completed **OK (1 test), 56.179 s**. The focused no-new-AI visual method completed **OK (1 test), 9.985 s**. These are two composite instrumented tests, not exhaustive per-screen coverage.

An intermediate visual run was interrupted while another project's phone automation took the foreground; its logs include a disconnected UiAutomation/runner failure. Those artifacts are retained rather than counted as a pass. The later focused run succeeded. No other project was stopped or modified to obtain the result.

## Bug found and fixed

The generated tailored PDF printed literal Markdown emphasis (`**...**`) in its prose/bullets. Its renderer escaped all prose as plain text, whereas the canonical-CV renderer already had an inline-formatting helper. The tailored renderer now uses that same helper for summary, bullets, project and education descriptions, while retaining HTML escaping.

The same saved fictional payload was rendered again **without another model call**. Its rejected state, payload, assessment, one-page result and ATS 85 remained unchanged. The corrected PDF was reopened on the physical phone; raw stars no longer appeared and the intended labels were bold. The patch is shared by Android and Web because both consume the same backend-generated PDF. It does not batch-rewrite previously accepted user PDFs.

Regression coverage: **166 Node tests passed, 0 failures**, including a new emphasis/escaping case; TypeScript and the Web 0.5.1 production build passed. Android test APK compilation passed. No Android product source or UI was changed in this task.

## Data preservation

Before/after comparison confirmed all **12 canonical CV/config/notes files across four profiles**, plus both real-candidate candidature stores, remained byte-identical. There was exactly **one new business task**, the intended fictional CV task. The other three profiles gained no business tasks. Only the fictional job's draft state/output was changed; the draft remains rejected.

## Reproduction and limits

The tracked device test is opt-in and requires an authenticated physical device, two existing explicitly fictional profiles, and `allowSyntheticAi=yes` for the method that generates a CV. Run the main workflow and the no-new-AI visual continuation by their explicit class/method names. The latter additionally takes `previewJobId` for an existing rejected fictional draft. Do not run these tests against a real candidate to create an acceptance sample.

Raw screenshots, model results, PDFs, preferences and file baselines stay in ignored local QA artifacts, not Git. Existing import/document-picker, new job search, fresh formal-evaluation inference, CV Accept/edit/re-review, full OTP login and physical USB-disconnection tests were not repeated here. Public-host connectivity with no ADB reverse was verified; this does not claim the service remains available when the hosting PC is off.
