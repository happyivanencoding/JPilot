# Onward V1 0.6.2 / Web 0.8.2 — Profile IA and match uplift refinement

Date: 2026-09-12

Scope: independent V1 only — `feature/v1-student-match-loop-20260910`; no production main or Yifeng deployment.

## Product changes

- `我的职业档案` no longer has a separate `投递情况` tab. The three summary metrics are actionable: applications, saved roles and role-specific CVs each open a bottom drawer with the corresponding real records.
- `我的简历`、`职业分析`、`语言`、`求职偏好`、`外观` are now secondary collapsible sections. The city / all-France search-area control moved into `求职偏好` on both Android and Web.
- The detailed CV uplift presentation now uses the requested neutral initial card → arrow → Sage/Forest optimized card, with progress bars tied to the real baseline and optimized scores.
- The unused vertical gap above Match / CV / Tracking in job detail was reduced. The Home gap between the editorial identity block and `值得探索的方向` was reduced as well.
- Android and Web were changed together; no AI transport, scoring formula, search-provider or Candidate/Profile storage contract was rewritten.

## Versions and source

- Android: **0.6.2 / code30**, package `com.thegreatnovel.jobpilot.v1`.
- Web: **0.8.2**.
- Product commit: **`437778cecf7959090a922444b3b34b7f3bb1c9e3`**.

## Validation

- Web `npm run typecheck` — PASS. This check initially caught one real JSX closing-brace error in the Profile refactor; it was fixed before release.
- Web `npm run build` — PASS for `@jobpilot/web@0.8.2`.
- Android `./gradlew.bat :app:assembleDebug` — PASS for 0.6.2/code30.
- Targeted `git diff --check` for release files — PASS.

No broad paid-AI or unrelated data regression suite was rerun for this UI/IA-only change.

## Public V1 deployment

The existing V1-only server deploy script deployed the exact product commit and returned:

`V1_DEPLOY_OK 437778cecf7959090a922444b3b34b7f3bb1c9e3`

Its built-in gates passed: V1 session/Profile isolation + logout, model-key prewarm and search-provider configuration. Follow-up status reports `jobpilot-v1-web-1` healthy on image `jobpilot-v1:437778ce...`; public `https://jobs-v1.thegreatnovel.com/` returns HTTP 200. No production or Yifeng deploy command was invoked.

## Android delivery

Samsung **SM-S928U1 / R5CXB0BSTVD** was upgraded in place with `adb install -r`; no uninstall or data clear was used. Device readback:

- `versionName=0.6.2`
- `versionCode=30`

The launcher activity was started after installation. APK:

- Local: `.career-ops-web/onward-062/Onward-V1-0.6.2-code30.apk`
- Phone: `/sdcard/Download/Onward-V1-0.6.2-code30.apk`
- Size: **19,671,019 bytes**
- SHA-256: **`43C4AE248425B1AE470CED1BF2D95FD57074351C34023710AE9BE204886A2824`**

Pre-existing unrelated worktree changes and private QA artifacts were preserved and were not staged into the product commit.
