# JobPilot Web 0.4.0

The Web client follows the current native Android experience. It replaces the old Career-Ops workbench rather than adding another page or an optional theme. The root route renders the only product shell; historical page URLs redirect to the corresponding JobPilot tab or detail.

Desktop: fixed 384 × 832 portrait composition, scaled down to fit. Phone: real viewport, safe areas, fixed five-tab navigation and scrollable content. Light/dark themes and Chinese/French/English UI follow Android. Application document language remains independent.

## Develop and deploy

Use Node 22+ and the existing repository setup. From this directory:

```powershell
npm ci
npm run dev
```

Production:

```powershell
npm run typecheck
npm test
npm run build
.\scripts\start-mobile.ps1 -RestartWeb
```

The production listener stays on 127.0.0.1:3000, behind the existing authenticated gateway. Keep secrets in ignored local configuration, not client environment variables. For optional trusted-LAN access use the existing start/stop LAN demo scripts, not a public unauthenticated binding.

## Implementation

`src/components/jobpilot/` contains the phone shell, screens, scoped client state, details and PDF preview. `src/app/page.tsx` and `layout.tsx` are the only product entry; the old AppShell is not mounted. The existing `/api/mobile` backend contract and `shared/jobpilot-i18n.json` remain shared with Android.

CVs remain backend-owned. Preview uses actual PDF bytes, not a visual approximation. Imports, edits and draft acceptance require explicit confirmation; version conflicts stay visible without losing edits. All calls are scoped to the displayed profile, independently of a cookie another browser tab may change.

`scripts/prepare-web-assets.mjs` copies self-hosted PDF.js resources from the pinned dependency before dev/build. Generated `public/jobpilot-pdf/` is ignored and rebuilt, not committed. No runtime CDN or service-worker CV cache is used.

## Browser acceptance

```powershell
$env:BUILD_DIST = '.next-web-parity-qa'
npm run build
node scripts/qa-jobpilot-web.mjs
$env:JOBPILOT_QA_ENGINE = 'webkit'
node node_modules/playwright-core/cli.js install webkit
node scripts/qa-jobpilot-web.mjs
Remove-Item Env:JOBPILOT_QA_ENGINE, Env:BUILD_DIST
```

The default browser is installed Microsoft Edge; `JOBPILOT_QA_BROWSER` can select another Chromium executable. The suite owns and cleans up a temporary loopback server, intercepts every API with isolated fictional records, and fails unknown requests instead of sending real business writes. It exercises actual DOM interaction, PDF rendering/download, languages/themes, profile isolation, completed-result navigation and small-screen geometry. It does not claim to run new production AI model calls.

Private screenshots and logs belong in ignored runtime QA storage, never Git. See [the architecture and acceptance record](../docs/WEB_ANDROID_PARITY.md) for exact results and platform limitations. Read the repository's `DEEP_CONTEXT_HANDOFF_FINAL.md` before modifying the project.

## License and attribution

JobPilot Web is part of the JobPilot distribution and is licensed under **AGPL-3.0-only** for JobPilot-authored material. See the repository root [`LICENSE`](../LICENSE).

Pre-existing Career-Ops engine code retains its original MIT notice in [`../LICENSES/career-ops-MIT.txt`](../LICENSES/career-ops-MIT.txt). Rounded navigation icons match Android's Material Icons and keep their Apache-2.0 license beside the source. PDF.js retains the licenses shipped with its pinned dependency. See [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
