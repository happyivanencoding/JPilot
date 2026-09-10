# Yifeng Web Preview — 2026-09-10

This branch is an isolated review surface for Yifeng commit `6148e7d` (`Add onboarding access flow and profile navigation`). It is **not** production and must not be merged into `main` without an explicit product decision.

## Branch and runtime

- Branch: `preview/yifeng-6148e7d-20260910`
- Base: current `origin/main` at task start (`a64e761`)
- Worktree: `C:\dev\jpilot-yifeng-preview-20260910`
- Preview server: local Next production server on `127.0.0.1:3011`
- Preview data: isolated copy rooted at `C:\dev\jpilot-yifeng-preview-data-20260910`
- Preview profile: synthetic `Louis MARTIN — PROFIL TEST`; production Candidate data is not the preview writer target.

## What the preview contains

- 3-tab Web navigation: Home / Offers / My space.
- Applications, interview preparation and settings moved under My space.
- Offer cards gain compact “what you will do / what you bring” summaries and a separate source-information page.
- CV upload shows the privacy explanation before opening the file picker.
- Yifeng’s private-beta invite/login/register visual flow is retained only so the product concept can be reviewed. Its Google/email actions are preview UI state, **not** the production Google authentication implementation.
- `/quiz` exposes the proposed two-minute job-search self-assessment/marketing surface.

## Main-line compatibility adjustments made only for preview

Yifeng’s branch diverged before the current Google-login/Profile-isolation and owned-backend work. The preview therefore keeps today’s main as the base and adapts only the new UI idea. In particular:

- Current `needsCv` onboarding and Profile-switch visibility semantics are preserved.
- Current AI task-launch feedback and ETA behavior are preserved.
- `cv_review` destinations are preserved.
- “Skip guide” still means skip all tab guides, matching current main behavior.
- Existing applications/prepare routes are remapped into `profile` subviews rather than removed.
- Android source remains unchanged in this preview task; this branch exists only for the requested Web product review.

## Validation actually performed

- `npm run typecheck`: PASS.
- `npm run build`: PASS; Next production build includes `/`, `/quiz`, `/jobs/source` and current backend routes.
- Local preview `GET /?fresh=1`: HTTP 200.
- Isolated preview `GET /api/mobile?profileId=louis`: HTTP 200 with 13 jobs, 1 pending discovery offer and 22 task records.
- Public quick-tunnel root: HTTP 200 / JobPilot title.

No production deploy, production data migration, Android install, AI benchmark or business write validation was performed for this review branch.
