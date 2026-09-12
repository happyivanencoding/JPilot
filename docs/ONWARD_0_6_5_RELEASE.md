# Onward V1 0.6.5 / Web 0.8.5 — Product Analytics & Project OS Dashboard

Scope: isolated `feature/v1-student-match-loop-20260910` only. Production main and Yifeng staging are not part of this release.

## Product Analytics

- True server milestone `cv_ready` after persisted valid CV; upload click remains only an attempt signal.
- Jobs Seen requires actual results; opening an empty/loading Offers surface does not qualify.
- Job Opened stays `open_job`.
- Analysis Read is report-derived at >=8s accumulated foreground Match time or >=50% scroll and deduplicated by an opaque user/job context.
- Explicit role-CV request is `generate_cv_started`; old `generate_cv` remains report-compatible.
- `cv_completed` / `cv_failed` come from the terminal `kind=cv` task, not button state or `cv_review`.
- Core funnel, Europe/Paris D1, five p50/p90 Time-to-Value metrics, four consolidated AI-performance rows and pseudonymous tester journeys are emitted directly by the report.
- Android/Web page taxonomy is canonicalized while old page tokens continue to normalize.

## Project OS read path

V1 owns telemetry. A new `/api/internal/analytics` is read-only and requires a private bearer secret; unauthenticated calls fail closed. It returns aggregate metrics and pseudonymous journeys only. The Project OS backend is the only consumer and does not copy the dataset into SQLite or expose the secret to its browser.

The Project OS JobPilot project displays an Analytics tab. A Dashboard version selector is part of the page contract; this release offers only `V1 · 第一轮商业验证`, leaving future versions to be added only when they have real data/definitions.

## Validation before rollout

- synthetic Analytics fixture + existing privacy/retention suite
- Web typecheck + Next production build
- Android `assembleDebug`
- Project OS dedicated server-to-server tests + TypeScript/Vite build

## Live delivery

The isolated V1 Web is live at product SHA `efddea2872a5290b4e62251130f3cf32a0c663e6`. The existing V1-only root deploy returned `V1_DEPLOY_OK` after Docker production build, V1 session/Profile isolation + logout, model-key gate, search-provider gate, and the new internal Analytics gate. The Analytics gate verifies unauthenticated access returns 401 and the private service bearer returns a V1 aggregate. Public `https://jobs-v1.thegreatnovel.com/` returns 200. Production and Yifeng Web/gateway/tunnel container IDs and StartedAt values remained unchanged.

The first deploy attempt exposed VPS disk pressure rather than an application defect: `/` had only 576 MB free and Docker held many unused historical V1 images. Only unused old `jobpilot-v1` images were removed; current V1 rollback images, production/Yifeng images, Candidate data and backups were not touched. Free space recovered to about 16 GB before the successful deploy. The next gate caught a real secret file ownership mismatch and rolled back; ownership was aligned to the existing V1 secret convention before the final successful deploy. A further gate caught the preview session middleware blocking the internal Analytics route; the route is now the sole session exception and still enforces its own private bearer.

Project OS source commit is `bc9c7a7` (`feat: add JobPilot V1 analytics dashboard`). Its source backend was restarted through the existing safe restart script and then loaded the real V1 feed through `/api/projects/<JobPilot>/analytics?dashboard=v1`. Browser acceptance opened `JobPilot → Analytics`, displayed the Dashboard-version selector with `V1 · 第一轮商业验证`, V1 Overview, Core Funnel, AI Performance and Anonymous User Journeys with no console errors.

Current retained telemetry contains 8 pre-release pseudonymous users from development/acceptance. The strict server-backed `cv_ready` boundary is intentionally not fabricated for history, so those old users currently show zero in the new ordered commercial funnel unless they create a real post-release CV Ready milestone. Treat them as a pre-launch baseline, not as the first commercial tester cohort.

Android 0.6.5/code33 was compiled successfully in this task; no physical-device installation is claimed here.
No paid model call is required by this release.
