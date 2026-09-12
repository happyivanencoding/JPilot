# Onward V1 0.6.3 / Web 0.8.3 — role-CV layout + AI progress

Date: 2026-09-12 (Europe/Paris)

## Scope

Independent V1 only: `C:\dev\jpilot-v1-student-20260910` / `feature/v1-student-match-loop-20260910`. Production main and Yifeng were not modified or deployed.

## Youness role-CV failure

The real Youness profile (`test-c5e37a78019e4c46a1f2a18437a0e0e1`) reproduced the `Consultant FinOps - CDI (H/F)` failure twice. The model output had already been persisted; the `cv` task failed in the local PDF renderer with `Le CV occupe 2 pages pour une limite de 1`. The uploaded source PDF is one page, 960×540pt, with a wide main column and a narrow sidebar. The old parser detected columns but discarded the column identity/width and original page geometry; the tailored CV was therefore flattened into A4/single-column layout and exceeded the one-page limit.

The renderer now preserves `column`, `columnCount`, `columnFractions`, `pageWidth`, `pageHeight`, source email/phone, and recognizes `PROFESSIONAL EXPERIENCE`. Tailored content replaces wording inside the source topology and keeps the source page size. A compact retry is allowed only inside the same source layout if the first render still exceeds the source page count. Renderer identity is `original-layout-v3-source-page`.

Exact no-model acceptance used Youness's real `source.pdf` plus the already-cached Consultant FinOps generation JSON. Readback: source `columnCount=2`, fractions `0.7691 / 0.2309`, page `960×540pt`; generated role PDF `1 page`, 92,495 bytes, ATS 100 / grade A / no ATS issues. `(+33) 6.66.49.96.83` and `kinani.youness@gmail.com` remain in the PDF.

## AI progress direction

The first-run full-screen `CvAnalysisWater` remains bottom-to-top. Normal AI action buttons now progress left-to-right on both Web and Android. Android uses `liquidRight = size.width * progress`; Web uses `width: var(--jp-ai-progress)`. The existing fast-then-slow estimate, active ceiling below 100%, terminal success snap to 100%, and failure stop behavior are unchanged.

## Versions and checks

- Android: 0.6.3 / code31.
- Web package: 0.8.3.
- Targeted job-search + CV-consistency + polish: 47/47 PASS.
- Web `npm run typecheck`: PASS.
- Web production `npm run build`: PASS.
- Android `:app:assembleDebug`: PASS.
- Release `git diff --check`: PASS.
- Product code commits: `bb729b8d1046bb0a5eeaf44390da81daf84b4154` and `cb8be35fe7f32c9ca93abd0478138dc9e2fd8dce`.

Samsung SM-S928U1 / R5CXB0BSTVD was upgraded in place using `adb install -r`; device readback is `versionCode=31 / versionName=0.6.3`. APK: `.career-ops-web/onward-063/Onward-V1-0.6.3-code31.apk`, 19,671,019 bytes, SHA-256 `2823FBBE86ED0AD6A1591BDC1897EB1C083FA2C6AD1329358DAC00FF6127DF79`; the same file is in phone Download.

## Public rollout status

Source is pushed, but the V1 server is not yet switched to this release. Runtime connector currently returns `We couldn't connect your account`; the fallback AgentDock V1 root-deploy write call is blocked by the current OpenAI tool safety layer before execution. A read-only root-script status check still reports deployed SHA `80c400308b8a08133b826e7222b24d1bf3203f67` and a healthy V1 container. Therefore Web 0.8.3 must not be described as live yet.

When deployment capability is restored, deploy the then-current `origin/feature/v1-student-match-loop-20260910` HEAD, not an older product-only SHA, then verify: `V1_DEPLOY_OK`, public HTTP 200, Youness retry of the same Consultant FinOps role, one-page role PDF with preserved contact, and unchanged production/Yifeng container identities.
