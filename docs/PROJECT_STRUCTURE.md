# JPilot Project Structure

> Repository authority: `https://github.com/happyivanencoding/JPilot`  
> Product direction: **Android-first; Web mirrors Android.**

## 1. Frontend authority

### `android/` — canonical product frontend

Native Android is the reference implementation for:

- navigation and screen hierarchy;
- interaction patterns and task/result flows;
- visual language and information density;
- Profile switching;
- CV/search/evaluation/application/preparation experiences;
- UI language behavior.

When a feature affects both clients, Android defines the product behavior first unless the change is purely backend-side.

### `web/` — Android parity + backend

The Web client is not an independent desktop product. It reproduces the current phone product in a browser and keeps the existing local backend/API used by Android.

The only supported Web product shell is `web/src/components/jobpilot/` mounted from the root page. Historical page URLs may redirect into this shell, but the old Career-Ops workbench must not return.

After the 2026-09-08 cleanup, `web/src/components/` contains only the JobPilot product shell. The unused Career-Ops React workbench (`apply`, `assistant`, `followups`, `pipeline`, `portals`, old CV/config/home/jobs UI, etc.) and its production-unreachable helper modules were removed rather than left as a hidden second frontend.

The production Next API surface is intentionally narrow. The retained route files are:

- `/api/mobile`, `/api/mobile/cv`, `/api/mobile/upload`;
- `/api/profile`, `/api/profiles`, `/api/cv`;
- `/api/candidatures`, `/api/candidatures/cv`;
- `/api/explore/add`;
- `/api/run/status`;
- `/api/internal/prewarm` (loopback-only service warmup).

Android/Web authentication bridging is handled by the existing gateway/proxy path rather than an independent old Web workbench route. Historical page URLs such as `/jobs`, `/pipeline`, `/cv`, `/explore` remain redirect-only compatibility entry points.

## 2. Shared product layer

### `shared/`

Cross-client resources, currently including the JobPilot UI localization dictionary. Shared resources must not create a second source of truth that can drift between Android and Web.

## 3. Backend compatibility engine

JPilot still calls part of the inherited Career-Ops implementation. The following categories therefore remain in the repository until their real dependency is replaced:

- structured job-source providers and scan helpers;
- tracker/report/status persistence and locking;
- CV/PDF generation and ATS validation;
- canonical status/template data;
- limited coaching/CV mode guidance actually loaded by `web/src/lib/mobile-engine.ts` and related backend code;
- tests that still protect those live backend paths.

This layer is an implementation dependency, **not** a product/upstream authority. New product architecture should move toward explicit JPilot backend modules rather than adding more Career-Ops CLI coupling.

## 4. Historical content that is not product authority

The repository was originally derived from Career-Ops. Old materials for its public community, npm distribution, Manifesto/Hired Wall, Go TUI, multi-CLI onboarding, release bots and marketing are not part of JPilot's product direction.

They may be deleted once confirmed unreachable from current JPilot runtime/tests. They must never be used to justify reintroducing a second UI or upstream auto-update flow.

## 5. Data boundary

Candidate/runtime data remains local and ignored. Never include real CVs, Profile data, applications, reports, generated PDFs, task histories, localization/benchmark artifacts, credentials or QA screenshots in repository cleanup commits. See `../DATA_CONTRACT.md`.

## 6. Current authoritative docs

For current development, prefer:

- `DEEP_CONTEXT_HANDOFF_FINAL.md` — single project handoff authority;
- `docs/ANDROID_HANDOFF.md`;
- `docs/ANDROID_0_3_RELEASE.md`;
- `docs/ANDROID_LANGUAGE_SEPARATION.md`;
- `docs/MOBILE_ACCEPTANCE.md`;
- `docs/WEB_ANDROID_PARITY.md`;
- `docs/JOB_SEARCH_ARCHITECTURE.md`;
- `docs/CV_ATTENTION_MODEL.md`;
- `docs/AI_BENCHMARK_2026-09-08.md`;
- this file.

Historical Career-Ops docs that remain in the tree are reference material only.

## 7. Repository cleanup rule

Before deleting a file or directory, inspect actual imports, subprocess calls, path reads and product tests. A filename looking "legacy" is not sufficient evidence. If Android/Web/backend is unaffected and the item only serves the historical upstream distribution/community surface, it is a cleanup candidate.

The old upstream updater is not a supported JPilot workflow. Development changes come from `happyivanencoding/JPilot` only.

## 8. 2026-09-08 cleanup result

The repository was reduced in two passes using real import/subprocess/path-read evidence:

- removed the upstream updater/scaffolder, Go dashboard, public Career-Ops community/release automation, multi-CLI project wrappers, Hired Wall/Manifesto material, marketing/multilingual README assets and the old monolithic `test-all.mjs` release suite;
- replaced the old `.github` automation set with JPilot CI that builds/tests Android and the current Web parity/backend;
- removed the entire unused Career-Ops React workbench and unused API surface; `web/src/components/` now has only `jobpilot/`, while the production API build exposes the 11 route files listed above;
- removed 43 production-unreachable Web helper files and the tests that only exercised those dead modules;
- removed two ignored `.tmp-script-test-*` directories totaling about 1.44 GB of local temporary data;
- kept all Candidate/runtime state and all still-reachable backend engine dependencies.

Validation after cleanup:

- Web Node tests: **314 passed / 0 failed**;
- Web TypeScript: passed;
- Web Next production build: passed and contains only the retained API surface plus redirect-only historical pages;
- Android `testDebugUnitTest assembleDebug`: passed (unit source currently reports `NO-SOURCE`, APK compilation/package succeeded).

The cleanup stops at the live compatibility-engine boundary. In particular, `scan.mjs` is still dynamically loaded by `/api/explore/add` as the canonical pipeline/scan-history writer, and `scan.mjs` still imports `providers/` plus `plugins/_engine.mjs`. Those root engine directories therefore remain until JPilot replaces that dependency with an explicit backend module.
