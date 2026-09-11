# V1 Product Analytics

Both clients send the same bounded event batch to `POST /api/analytics`. The endpoint validates a live V1 bearer/cookie session and derives its Profile server-side. Unsigned gateway role/profile headers never authorize analytics. `GET /api/analytics` returns only that session's Profile. There is no public all-user/admin endpoint.

## Event contract

Body: `{events:[{id,sessionId,event,page?,action?,step?,durationMs?,scrollDepth?,kind?,status?,timestamp?}]}`.

- `id` and `sessionId`: random UUIDs; reuse event ID on retries.
- Events: `page_enter`, `page_exit`, `page_heartbeat`, `click`, `scroll`, `funnel`, `ai_wait`. Heartbeats carry incremental duration and are counted as residence, never exits.
- Page/action are fixed product tokens (`^[a-z][a-z0-9_-]{0,63}$`), never visible labels, URLs, input values or CV content. Pages include `onboarding_email/upload/analysis/direction/search/results` (each with the `onboarding_` prefix), `home`, `offers`, `profile`, `job_match`, `job_cv`, `job_tracking`, `pdf`.
- Ordered steps: `login → upload_cv → choose_direction → view_jobs → open_job → view_cv → generate_cv → tracking`.
- AI kinds: `analysis`, `search`, `evaluate`, `cv`; status: `completed`, `failed`, `abandoned`.
- Durations: 0–86400000 ms. Scroll: 0–100 percent. Optional timestamp: epoch ms, within the retained 30-day window and no more than five minutes ahead. Server receive time is also saved.
- Required fields: pages for page/scroll events; duration for exit; action for click; step for funnel; kind/status/duration for AI wait.
- Max 50 events / 32 KiB per request, including streams without Content-Length. Unknown fields reject the batch. No email, raw Profile ID, CV text, job prose, URL or secrets in telemetry.

## Storage and reporting

Private `CAREER_OPS_ROOT/.career-ops-web/analytics/<sha256-profile>/events.json` stores a random pseudonymous user ID and ordered bounded events. Profile locks and atomic replacement prevent concurrent loss; event IDs deduplicate within retained data. A write removes events older than 30 days and caps each Profile at 20,000 events. The first ingestion each hour also physically prunes expired events from all analytics Profiles (including inactive users). Reports exclude expired records. For servers with no ingestion, schedule the local CLI with --prune hourly; no online traffic means no in-process timer can run. --prune only compacts telemetry, never Candidate data. Data remains private and must not enter Git.

From `web/`:

```sh
node scripts/analytics-report.mjs --root /data
node scripts/analytics-report.mjs --root /data --profile PROFILE_ID
node scripts/analytics-report.mjs --root /data --html /private/analytics.html
node scripts/analytics-report.mjs --root /data --prune
```

The CLI requires operating-system access to private data. It emits JSON with per-user/session journeys, page residence and maximum scroll, click totals, ordered unique-user funnel counts/conversion/dropoff, last observed exit steps, and four AI wait summaries (p50/p90, completed/failed/abandoned counts and abandoned p50/p90). No public identity is included.

Funnel counts require actual ordered step events across a user's retained sessions; missing earlier stages are not inferred. Returning users whose original onboarding predates retention may not enter the onboarding funnel. Cap/retention losses are disclosed by `discardedEvents`.

AI metrics are **client-observed visible waiting segments**, not server/model total execution time. Backgrounding ends a segment with `abandoned`; resuming starts another segment. An abandoned segment means the user stopped watching, not that the backend failed. Last observed page/step and best-effort page exit likewise do not prove permanent churn. Browser/process kills and offline delivery can lose final events.

## Server task durations

New live task terminal writes also record internal `server_ai_task` events with `source:server`. Public POST rejects both this event and the source field. The backend maps `deep_match → evaluate` and `cv_review → cv`; local-only ingest is not an AI task. Per-task UUIDs deduplicate in a separate server namespace. Only kind, terminal status and creation/finish timestamps are retained; no input or output content. Analytics failure never changes the task outcome.

`serverAiTasks` and the separate HTML section show four kinds of task counts, completed/failed totals and p50/p90. Duration means creation → terminal persistence, including queue time and non-model work, not pure provider inference. Background deep matches are included even when absent from client snapshots. Server events never enter client journeys/funnels/wait statistics. Existing task files are not scanned or backfilled.

## Validation

`node --test tests/product-analytics.test.mjs` exercises session identity and revoked-session rejection, forged headers, schema limits, Profile isolation, deduplication/concurrent writes, ordered funnel/exit/scroll/click statistics, AI percentiles, and physical retention/cap compaction.
