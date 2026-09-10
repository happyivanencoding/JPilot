# JPilot — Project Rules

## 1. Authority

Before modifying this repository, read and follow:

`C:\dev\career-ops\DEEP_CONTEXT_HANDOFF_FINAL.md`

That handoff is the single project authority. Then inspect the actual files relevant to the task; do not infer current behavior from historical Career-Ops documentation.

### Runtime execution layer

All new development and maintenance execution uses **Runtime MCP directly**. For files, shell/commands, Git, LSP, browser automation and Windows UI Automation, use Runtime native tools rather than routing normal work through AgentDock. AgentDock is legacy compatibility/fallback only and must not be chosen as the primary execution layer when Runtime is available. Runtime ACP remains dormant by default; `acp_start` / `acp_resume` are allowed only after an explicit user request for an independent ACP agent/model experiment.

Historical benchmark/audit text and legacy filenames containing `agentdock` remain factual history/compatibility names; do not mechanically rename them unless the underlying product code is actually migrated. They are not current development instructions.

## 2. Repository authority

The only development repository is:

`https://github.com/happyivanencoding/JPilot`

Local `origin` must point to that repository. `santifer/career-ops` is historical provenance only. Do **not** pull, apply, or reintroduce upstream Career-Ops updates as product changes. The inherited updater is not a JPilot development workflow.

## 3. Android-first product rule

JPilot is Android-first.

- `android/` is the canonical frontend for product behavior, information architecture, navigation, interaction and visual decisions.
- `web/` mirrors the current Android product in a phone-first browser surface and hosts the local backend/API.
- Do not create an independent desktop Web product, Classic UI, old Career-Ops workbench, TUI product surface, or alternate navigation model.
- **Hard release gate:** every Android UI/product behavior update must ship its equivalent Web behavior in the same development change/release. An Android update is not complete while Web parity is deferred. Backend-only changes are the only normal exception.
- For a cross-client feature, implement/define the Android behavior first, then implement and verify the equivalent phone-first Web behavior before calling the work complete.
- Android and Web must continue to share the same Candidate data, tasks, evaluations, CVs, reports and application state.

See `docs/PROJECT_STRUCTURE.md`, `docs/ANDROID_HANDOFF.md`, `docs/MOBILE_ACCEPTANCE.md` and `docs/WEB_ANDROID_PARITY.md`.

## 4. JobPilot-owned backend boundary

The legacy execution engine has been replaced. Product runtime code lives under `web/src/lib/`, with file-ledger/inbox/PDF services in `backend/` and native search adapters in `job-search/`. The root npm package only delegates to the Web application; it is not a second runtime.

Do not restore deleted root CLI scripts, provider/plugin catalogues, template engines, upstream mode prompts or old Web/TUI surfaces to implement a feature. Add behavior at the relevant JobPilot service boundary instead. Candidate data roots must not need executable source files.

Existing private data paths, the `CAREER_OPS_ROOT` variable and the profile cookie are retained compatibility identifiers, not evidence of a remaining upstream execution engine. Never delete or migrate real user data merely to remove an old name. Standard library dependencies, historical attribution and applicable licenses remain valid.

See `docs/OWNED_CORE.md` for the replacement scope, public protocol support and acceptance evidence.

## 5. AI runtime architecture

All product model calls go through the replaceable JobPilot model transport boundary. Production currently uses **direct OpenAI API**; if an ACP fallback is used for new work, prefer the **Runtime ACP adapter** and keep it **transport-only** rather than acting as a coding-agent runtime for JPilot business flows. AgentDock-named adapters/files are legacy compatibility and historical evidence, not the preferred runtime.

- Business orchestration, search, file access, persistence, browser actions and prompt assembly belong to JPilot backend code.
- Model transports receive explicit bounded inputs and return model output.
- Do not require model filesystem/terminal/browser/plugin/tool access for product inference.
- Future direct OpenAI/DeepSeek/other providers should be swappable at the transport adapter without rewriting business logic.

## 6. Data and privacy

Read `DATA_CONTRACT.md` before touching Candidate files.

Never commit or casually rewrite real Candidate CVs, profile data, application history, generated reports/PDFs, credentials, gateway sessions, API keys, runtime tasks or private QA artifacts. Preserve Profile isolation.

Do not reset/clean/stash or overwrite parallel work. Do not run destructive Git commands.

**Automatic delivery rule:** every task that modifies product/source code is incomplete until its relevant checks have run, the task-scoped code/docs changes are committed, and the commit is pushed to `origin/main`. Do this automatically without waiting for a separate “push” request, unless the user explicitly says not to push. Never sweep unrelated parallel dirty work into that commit; if a push is blocked, report the concrete blocker rather than silently leaving code only on the PC.

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
