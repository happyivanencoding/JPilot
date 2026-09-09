# JPilot Web

JPilot Web is the browser mirror of the native Android product and the host for the current local backend/API.

**Development repository:** `https://github.com/happyivanencoding/JPilot`

## Product rule

Android is the frontend authority. Web follows the current Android navigation, interaction, states and phone-first visual language. It does not have a separate desktop information architecture and must not restore the historical Career-Ops workbench or Classic UI.

The root route renders the supported JobPilot shell. Historical URLs may redirect to the matching JobPilot destination only.

Desktop browsers use the phone portrait composition; actual phone browsers use the real viewport and safe areas. Chinese/French/English UI follows the same product language contract as Android. Application-document language remains independent.

## Develop

Use Node 22+:

```powershell
cd C:\dev\career-ops\web
npm ci
npm run dev
```

Product checks:

```powershell
npm run typecheck
npm test
npm run build
```

Production remains on the existing loopback service and authenticated gateway. Do not expose Candidate data, runtime secrets or a new unauthenticated public endpoint while developing the Web mirror.

## Implementation

- `src/components/jobpilot/` — supported Web product shell and screens.
- `src/app/page.tsx` — product entry.
- `/api/mobile` and related routes — Android/Web mobile backend contract.
- `../shared/jobpilot-i18n.json` — shared UI language dictionary.
- inherited root engine scripts/providers/templates — retained only where current backend code still calls them.

CV preview uses actual PDF bytes. Imports, canonical CV edits and draft acceptance keep explicit confirmation/version checks. Profile-scoped requests must remain isolated from other profiles and browser tabs.

## Acceptance

Current architecture/acceptance evidence is documented in [`../docs/WEB_ANDROID_PARITY.md`](../docs/WEB_ANDROID_PARITY.md) and [`../docs/MOBILE_ACCEPTANCE.md`](../docs/MOBILE_ACCEPTANCE.md). Read `../DEEP_CONTEXT_HANDOFF_FINAL.md` before changes.

## License

JPilot-authored Web material is AGPL-3.0-only. Inherited Career-Ops code retains its original MIT notice in `../LICENSES/career-ops-MIT.txt`; dependency notices remain in `../THIRD_PARTY_NOTICES.md`.

## Backend service boundaries on the refactor branch

`src/lib/candidatures.ts` owns shared candidature persistence and report reconciliation. Mobile task orchestration calls model-backed evaluation and CV services directly; it does not send internal requests to another localhost server. The root `lib/pipeline-store.mjs` supplies the canonical inbox/history writers without loading the full scanner.

After `npm run build`, `npm run qa:backend` launches a disposable built server and tests real browser requests/file persistence against fictional data. Set `JOBPILOT_QA_ENGINE=webkit` to use WebKit; Chromium/Edge is the default. It never starts the production service or runs business AI. See `../docs/REFACTOR_2026-09-09.md` for exact results and the explicit feature-branch-only delivery boundary.
