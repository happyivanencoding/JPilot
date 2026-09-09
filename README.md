# JobPilot

JobPilot is an Android-first, local-first job-search application. It imports and analyzes a CV, discovers opportunities, evaluates individual roles, prepares a user-confirmed tailored CV, supports interview practice and tracks applications. The Web client mirrors the native Android product in a phone-sized interface; there is no separate legacy dashboard.

## Product and code

- `android/` — native Kotlin/Compose client, the interaction and design reference.
- `web/src/components/jobpilot/` — equivalent phone-first Web interface.
- `web/src/app/api/` — shared product API used by both clients.
- `web/src/lib/backend/` — JobPilot's own data ledger, inbox, atomic document writes and CV/PDF rendering.
- `web/src/lib/job-search/` — structured discovery, ranking and public-source adapters.
- `web/src/lib/model-transport.ts` — replaceable model transport; business prompts, evidence, persistence and task orchestration stay in the application.

The current backend does not require the former Career-Ops CLI, provider registry, mode files, CV templates or root npm dependencies. Installed private Candidate files are read in their existing locations, without a migration. See [the architecture](docs/PROJECT_STRUCTURE.md), [the replacement record](docs/OWNED_CORE.md) and [the data contract](DATA_CONTRACT.md).

## Development

Use Node 22 or newer and a local Chromium/Edge/Chrome installation for server-rendered CV PDFs. Android uses the Gradle wrapper in `android/` and the locally installed Android SDK.

```powershell
npm --prefix web ci
# Copy .env.example into web/.env.local and set private credentials as needed.
npm run dev
```

For production Web builds and local verification:

```powershell
npm test
npm run build
npm run qa:backend
npm --prefix web run qa:cv
```

The root package only delegates to `web/`; it has no separate engine dependency installation. `qa:backend` starts a temporary built server against fictional data and exercises actual API calls, persistence and CV rendering. `qa:cv` verifies rendered PDF contents/layout without calling a model. Real-model checks live separately in `web/scripts/verify-jobpilot-ai-flows.mjs` and require explicitly configured private credentials.

The hosted installation uses the authenticated gateway in `web/scripts/mobile-gateway.mjs`; do not expose the unauthenticated local Next port directly. Existing Windows deployment helpers are `web/scripts/start-mobile.ps1` and `run-mobile-service.ps1`. Read `docs/ANDROID_HANDOFF.md` before changing production connectivity.

## Collaboration

The development repository is `happyivanencoding/JPilot`. `main` is the integrated product branch; `Yifeng` is the collaborator's development branch. Successful `Yifeng` CI maintains a review PR, but does not merge it automatically. Product changes must preserve Android/Web parity and update the handoff documents. Repository rules are in [AGENTS.md](AGENTS.md).

Real CVs, profile details, generated reports/PDFs, application history, credentials, sessions and QA transcripts do not belong in Git. Rewriting code is never permission to delete or overwrite that data.

## License and provenance

JobPilot-authored material is licensed under **AGPL-3.0-only**. This repository originated from the MIT-licensed Career-Ops project. The legacy execution engine has been replaced, but development history and applicable third-party rights are not erased by refactoring. Original notices remain in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSES/](LICENSES/). See [LICENSE](LICENSE).

This is an independently maintained product, not a claim of clean-room development, exclusive rights to third-party software, guaranteed job placement or ATS-vendor certification.
