# Onward V1 0.5.0 / Web 0.7.0

Scope: isolated V1 worktree and feature branch; Android com.thegreatnovel.jobpilot.v1 versionCode 24. Continues the uncommitted Onward changes from the referenced V1 conversation. Production/main and Yifeng are separate releases.

## Product

- Onward open-O / ascending stroke icon and designed wordmark replace app, launcher, browser icon, PWA and visible branding.
- Authenticated per-profile product analytics cover page entry/active time/scroll/actions, ordered login -> upload_cv -> choose_direction -> view_jobs -> open_job -> view_cv -> generate_cv -> tracking, and analysis/search/evaluate/cv visible waiting. New server task terminal events separately capture actual task durations, including silent deep_match; client submissions cannot impersonate these server events. A private CLI exports JSON or a readable HTML report. No input values, CV content or job links enter telemetry.
- Automatic UI/source-CV/insight defaults reduce first-run choices; optional language settings are collapsed. The user retains direction, contract and city/all-France choices. Only the privacy consent is mandatory.
- Home has strengths, directions and priority jobs; compact cards use a single match scale. Positive CV gains require a prepared assessed payload, reused for the generated draft; zero gains are not advertised.
- Match/CV/Tracking remain the three detail tabs. Clean original/role PDF switching replaces highlighting. Status/date/reply draft/notes autosave; replies do not append a new received-email history item on each keystroke.
- Analysis/search waiting ends when display content is ready, including translation and matching. Background waiting does not cancel backend work.

## Browser integration corrections

- Preview PDF responses omit Content-Disposition; explicit download=1 retains attachment naming. A controlled standalone server proved that adding disposition made both local Chrome and Edge fetch return 204/empty while the server and API clients returned 200/PDF. The preview does not need download semantics.
- A pending translation only delays Match content. Fixed tabs, CV and Tracking remain accessible, so saving a reply never waits for translation.

## Validation and delivery

Android unit tests (5/5) and final assembleDebug passed; Web typecheck and production build passed; targeted backend/client/analytics/search regression checks passed. Browser acceptance used a synthetic profile, real upload/API/PDF rendering and controlled model/provider output: the prepared payload and final draft were identical, score 76→82 remained stable, both clean PDFs rendered, tracking edits survived navigation, and 60 persisted events completed all eight ordered funnel steps. Cross-profile reads were rejected. Final resumed acceptance made no additional model calls. Deployment/device receipts follow after the actual rollout. Synthetic model/provider browser acceptance is explicitly distinct from real upstream AI evaluation. Private screenshots, APK, logs and analytics exports stay in .career-ops-web/ and must not enter Git.
