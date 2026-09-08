# JPilot — Project Rules

## 1. Authority

Before modifying this repository, read and follow:

`C:\dev\career-ops\DEEP_CONTEXT_HANDOFF_FINAL.md`

That handoff is the single project authority. Then inspect the actual files relevant to the task; do not infer current behavior from historical Career-Ops documentation.

## 2. Repository authority

The only development repository is:

`https://github.com/happyivanencoding/JPilot`

Local `origin` must point to that repository. `santifer/career-ops` is historical provenance only. Do **not** pull, apply, or reintroduce upstream Career-Ops updates as product changes. The inherited updater is not a JPilot development workflow.

## 3. Android-first product rule

JPilot is Android-first.

- `android/` is the canonical frontend for product behavior, information architecture, navigation, interaction and visual decisions.
- `web/` mirrors the current Android product in a phone-first browser surface and hosts the local backend/API.
- Do not create an independent desktop Web product, Classic UI, old Career-Ops workbench, TUI product surface, or alternate navigation model.
- For a cross-client feature, implement/define the Android behavior first, then keep Web parity unless the change is backend-only.
- Android and Web must continue to share the same Candidate data, tasks, evaluations, CVs, reports and application state.

See `docs/PROJECT_STRUCTURE.md`, `docs/ANDROID_HANDOFF.md`, `docs/MOBILE_ACCEPTANCE.md` and `docs/WEB_ANDROID_PARITY.md`.

## 4. Inherited engine boundary

Some root-level Career-Ops code remains because JPilot backend still calls it. Treat it as a compatibility engine, not as product authority.

Examples of currently meaningful engine capabilities include structured job providers/search, tracker/report persistence, PDF/CV rendering, ATS checks, canonical states, and the limited mode/template files still read by the mobile backend.

Do not delete an inherited file merely because its name is old. Delete it only when real code/import/command/data-flow inspection shows it is unreachable from JPilot and not required by retained backend tests or legal attribution.

Conversely, upstream distribution/community machinery, marketing material, unrelated multi-CLI UX and obsolete Web/TUI surfaces should not be reintroduced after cleanup.

## 5. AI runtime architecture

All product ACP calls are **transport-only**. ACP/AgentDock is a model transport adapter, not a coding-agent runtime for JPilot business flows.

- Business orchestration, search, file access, persistence, browser actions and prompt assembly belong to JPilot backend code.
- Model transports receive explicit bounded inputs and return model output.
- Do not require model filesystem/terminal/browser/plugin/tool access for product inference.
- Future direct OpenAI/DeepSeek/other providers should be swappable at the transport adapter without rewriting business logic.

## 6. Data and privacy

Read `DATA_CONTRACT.md` before touching Candidate files.

Never commit or casually rewrite real Candidate CVs, profile data, application history, generated reports/PDFs, credentials, gateway sessions, API keys, runtime tasks or private QA artifacts. Preserve Profile isolation.

Do not reset/clean/stash or overwrite parallel work. Do not run destructive Git commands. Commit/push only when the user explicitly requests it.

## 7. Language contract

App/UI language and application-document language are independent. The UI language controls user-facing interface and analysis/explanations; CV/application material language is separately configured. Do not collapse them back into one setting.

See `docs/ANDROID_LANGUAGE_SEPARATION.md`.

## 8. Validation

Run only checks that can reveal a concrete failure you would fix. For code changes, prefer the smallest product-relevant validation first. Current primary gates are:

- Android: Gradle compile/build and relevant tests when Android/shared behavior changed.
- Web/backend: `npm run typecheck`, relevant Node tests, and `npm run build` when Web/backend behavior changed.
- `git diff --check` for repository edits.

Historical Career-Ops release/updater/community checks are not JPilot product gates.

## 9. Documentation and licensing

After changing product architecture, runtime behavior, repository structure or acceptance status, update the relevant docs and `DEEP_CONTEXT_HANDOFF_FINAL.md`.

JPilot-authored material is AGPL-3.0-only. Preserve the original MIT notice for inherited Career-Ops code in `LICENSES/career-ops-MIT.txt` and all applicable third-party notices/licenses.
