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

No paid model call is required by this release.
