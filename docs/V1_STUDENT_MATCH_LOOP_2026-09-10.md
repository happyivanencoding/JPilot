# JobPilot V1 — Student Match Loop

## 2026-09-11 V1 0.4.4 — coherent match, professional master CV and bounded exploration

### 0.4.4 deployed acceptance — completed

- Product SHA **`dd07f3e0f15cc85e6cd4b87eb4272f1adb2172d8`** was pushed and deployed to the isolated V1 stack. The root deploy returned `V1_DEPLOY_OK` after production build, authenticated single-Profile/login/logout smoke, model-key and search-provider gates. Production/Yifeng container IDs and StartedAt remained identical to the pre-deploy baseline.
- Final Android **0.4.4/code18** installed successfully with `adb install -r` on Samsung SM_S928U1 (`com.thegreatnovel.jobpilot.v1`), preserving the user's existing session/data. Device metadata confirmed versionCode18/versionName0.4.4. Real native Home displayed Yuki's Chinese strengths/directions without the deleted generic growth panel; the user's own Master CV opened as **one page** with the professional template and was visually checked on the phone.
- An independent real Web Yuki session completed original PDF upload, translated directions and four semantic-scored export roles. Scores were 78→86, 70→78, 83→99 and 71→83 for that test run; these are model estimates, not a promise of accuracy or hiring probability. The first role's real generated CV showed **header78 / baseline78 / draft86**, with no competing ATS/writing scores. Its pending draft was not automatically accepted.
- Both fullscreen and normal search displayed the real liquid button (including estimated percentage), with completion covering analysis and translation. A second direction produced a new prepared batch and left the first direction collapsed in history; opening the disclosure expanded it. English alias `Export sales assistant` reused the original task id and displayed **已并入「出口销售支持」，一起查看已找到的岗位。**, rather than running a duplicate search.
- The Web My page had no refresh/version/account developer controls. Page errors: zero. Public Master-PDF response reported one page. Local 53 relevant regression assertions and final Web/Android builds passed. The first browser continuation stopped on an incorrect test selector after upload/first batch/My/PDF already passed; the same session was resumed with the real accessible textbox, not re-uploaded. The resumed browser acceptance passed; the temporary test login was revoked afterwards, without logging out the user's phone.
- Existing historical assessments are preserved. Reopening/searching a cached direction can enrich its visible top four roles under the new semantic rubric; GET reads do not initiate business-model evaluation or retroactively rewrite all historical scores. Direction grouping is conservative cached reuse, not an unimplemented automatic widening promise. The daily allowance is per preview Profile and does not purport to be production anti-abuse/account billing infrastructure.


This change remains on the isolated V1 feature line. Android 0.4.4/code18, Web 0.6.4 and mobile contract 0.4.4 supersede the previous polish screenshots.

- A semantic `role-fit-2` rubric replaces lexical retrieval scores as the final job-match score: role/domain 30, duties/transferable work 30, tools/languages 20, level 20. Retrieval scores remain ranking hints only. There is no fabricated 60-point minimum: 60–74 means credible junior fit, while genuinely senior/unrelated vacancies may remain lower. Current → estimated CV-edit potential is the single visible 0–100 scale on cards, job headers, drafts and accepted versions. ATS/internal writing rubrics remain internal. New model responses must return the rubric rather than silently reverting to the heuristic.
- My no longer displays account-refresh/runtime/version controls; bottom logout remains. Home's generic growth panel was removed. Weakness titles use plain actions/shortfalls; unknown abilities are questions to clarify, not asserted incapacity.
- Master PDF uses a one-column professional template with a centered identity, contact line, section dividers, bold education/experience headings, dates and bullets. For retained uploaded PDFs, column geometry and typography restore original section grouping without OCR or rewriting facts. Text fallback uses recognised headings. The exact Yuki sample is one page, no horizontal overflow, with education, experience, projects, languages and all checked original dates/numbers preserved. A real raster preview was inspected. Long genuine CVs may use more pages rather than deleting facts to force one page.
- Search/history direction labels follow UI language; explanation prose follows the independent analysis language. Raw execution keywords no longer appear as duplicate suggestion chips. History is collapsed per direction with role counts; opening an old group requires no provider/model request.
- Local conservative bilingual direction keys group common equivalents (e.g. export sales assistant / assistant commercial export). Explicitly different specialisms stay separate. Same-CV completed results reuse a 24-hour cache; one active new selection at a time; at most six new direction searches per Profile/day. Existing results remain browsable even when another selection is active or the new-search allowance is exhausted. Merging is explicitly described as grouping existing results, not falsely claimed as a wider fresh search. V1 rank selection prioritises junior/candidate-stage and recognisable direction relevance over broad provider relevance.
- Semi-transparent liquid buttons use a fast-then-slow estimated curve capped at 96%. Search progress spans provider search, deep match and translation/title readiness; only real readiness reaches 100%, and genuine failures offer retry. Pending/failed tasks cannot be hidden behind stale completed results. Role-CV creation keeps its progress visible and routes to the saved version once ready. Progress is explicitly estimated, not a model-reported percentage or an arbitrary timeout at 90%.

Local acceptance before deployment: TypeScript and production Web build pass; 53 relevant Node assertions pass (including live snapshot progress fields, language/readiness/isolation, cache budget, semantic rubric, draft score mapping and source-template escaping). Android and deployment/device final results are recorded below after rollout. Existing unrelated AGENTS edits are excluded from commits. Main and Yifeng are not merged or deployed.


## 2026-09-11 V1 0.4.3 — deployed acceptance

- Product revision `6b3093f063103eec5bc8528a8dd07f106b88ce70` is live on the isolated `jobs-v1.thegreatnovel.com` stack. Android `0.4.3/code17` is installed on Samsung `SM_S928U1` under `com.thegreatnovel.jobpilot.v1`; final ADB install returned Success and device metadata confirmed both version values. Main/Yifeng products were not merged or overwritten.
- Real Web journey: original Yuki PDF → Yuki's Chinese advantages/directions, no extracted-text confirmation. My-bottom logout → another simulated sign-in → a distinct empty account → synthetic Mehdi logistics CV → English UI with fully French insights → four real French logistics cards, each with deep-match and translated strengths/gaps/potential before display. The phone's real UI independently displayed `你好，Yuki Tanaka。` and Chinese directions.
- Real tailored-CV continuation created Mehdi's own pending draft. The deployed UI now consistently displays role match 42 → estimated draft 50 (+8), not the unrelated internal writing-quality 58→70. The actual one-page PDF rendered in the browser with **Mehdi Martin**, logistics experience/projects and English CV text; French insight language did not rewrite the document language. Keep/reject was left to the user.
- Live authorization checks passed: anonymous 401, cross-Profile read 403, cross-Profile write denied with target unchanged, forged admin headers ignored, unauthorized profile switching 404, foreign task denied, old token 401 after logout, another session still valid. Local new-journey regression **9/9**, Web typecheck/production build and final Android build passed. These are not a claim that every legacy test or production Google OAuth flow was rerun.
- Deployment identity and authenticated smoke passed. The five production/Yifeng Web/gateway/tunnel container IDs and start times were unchanged. Existing mixed Louis test data is retained for diagnosis, not seeded into new accounts. This preview uses separate simulated identities on each new login; real Google account linking remains the production login's separate contract.


## 2026-09-11 V1 0.4.3 — personal journey and independent preview accounts

The Yuki/Louis defect was not merely a stale display name: the previous preview hardcoded every sign-in to `louis`, and CV replacement retained that profile's old name, finance targets and notes. V1 preview now has genuine server-side sessions. Each simulated Google sign-in creates a new empty Profile; it never clones the default person's facts, preferences, jobs, history or tasks. The API requires that session and binds reads/writes to its sole Profile, stripping caller-supplied privilege headers. Logout revokes the server session and discards client profile/results/navigation; another preview sign-in starts a separate test account. This is V1 simulation only, not a change to production Google OAuth or real email-linked accounts. Existing mixed Louis data is preserved for diagnosis but inaccessible to new ordinary preview accounts.

The first-run product flow is now **language → invite/preview Google → CV with source and insight language choices → personal strengths and directions → chosen direction → complete scored role deck → normal details**. UI defaults to English for a new installation. English/French CV language and Chinese/French/English insight language are separate from UI language. Choosing the uploaded file authorizes saving its extracted original text in that account: there is no forced raw-text preview or extraction-confirmation step. Generated tailored-CV drafts still require explicit keep/reject.

V1 orientation is a short, fresh-CV-only English model analysis, not the full legacy CV-audit/global-layout plan. It produces a source-checked candidate name, strengths, practical growth actions and distinct search directions. It does not consume the previous CV's analysis continuity or auto-search before the user chooses a direction. DeepSeek display translation prepares the selected insight language; neither untranslated directions nor partially enriched/translated offer cards are released. Four leading roles are enriched silently; scores and CV-only potential ceilings remain unchanged by translation. Failed preparation offers an explicit retry without turning into endless placeholders.

Discovery enrichment is bound to the current Candidate version as well as profile+URL. Switching directions preserves earlier result groups, and selecting an older reused search makes that exact search current rather than waiting forever behind the newer search. Android/Web share per-profile journey completion, the new My-bottom logout, and the same readiness rules. Source CVs, consented facts and generated draft acceptance remain separate.

Real rollout follow-up found that removing Louis's preferences also removed the implicit search geography: a genuinely empty Profile let the provider return its US default. V1 now uses France as its **product search market** (not a personal CV fact), still keeping flexible European options and respecting explicitly configured locations. The V1 search operation version is `search-v7-v1-market`; other product lines retain their existing defaults. The normal offer detail was also simplified: current CV match → estimated CV-edit potential, practical strengths/improvements, no repetitive audit or action-side-effect paragraphs. Capability-potential calculation remains available internally without dominating the first-use page.

Real first-use acceptance (the per-session release, before the final CV-view-only polish): the exact Yuki PDF produced a Yuki greeting and fully Chinese strengths/directions, with no raw extraction confirmation. My → Sign out → simulated sign-in created a different empty account. A synthetic Mehdi logistics CV then produced `Hi, Mehdi Martin` with English UI and fully French insights, followed by four real French logistics roles after deep-match/translation readiness. The explicit tailored-CV action generated a pending draft under Mehdi's own job; it did not borrow Yuki/Louis facts. The Samsung UI independently showed `你好，Yuki Tanaka。` and Chinese business/export directions on installed `0.4.3/code17`.

Live API isolation also passed: anonymous 401; another Profile read 403; cross-Profile write denied with the target unchanged; forged admin headers ignored; unauthorized profile switch 404; foreign task denied; logout invalidated the old token (401) without affecting another session. Preview accounts are intentionally separate test identities, not proof of real Google OAuth account linking.

The real tailored-CV check additionally exposed a confusing legacy display: role match 42/potential 50 alongside an unrelated internal writing score 58→70. V1 draft views now use the **same bounded delta mapping already applied by Keep**, showing 42→50 in that example; raw assessments and candidate facts are not rewritten. The internal writing score/ATS score no longer competes with the primary match score, and the PDF preview concentrates on the document and keep/reject controls. A deterministic regression covers score cap, no decrease, legacy preservation and nonmutation.

Versions: Android `0.4.3/code17`, Web `0.6.3`, snapshot `0.4.3`. Targeted deterministic coverage includes independent profiles, forged/cross-profile access denial, auto-ingest without a proposal textarea, prior-CV exclusion, translation wait/failure/retry, score invariance and token revocation. Real deployment and device acceptance are recorded after rollout.

> Branch-only product line for first external student tests. This document describes `feature/v1-student-match-loop-20260910`; it is not a statement that production `main` has switched to V1.

## 2026-09-11 CV ingest deployment fix

The first-run CV picker exposed two deployment-only assumptions that local development had hidden. Two real synthetic `louis` uploads of `CV_Test_10_Yuki_Tanaka.pdf` first failed with `spawn python ENOENT`; after the runtime image gained Python/PyMuPDF, the next task showed that the extractor path was incorrectly derived from `CAREER_OPS_ROOT=/data` and therefore tried `/data/web/scripts/extract-mobile-cv.py`. The uploaded PDF itself is valid and extracts readable text locally.

The shared runtime image now provides `/usr/bin/python3` + `python3-fitz`, while V1 resolves the extractor from the running Web application root (`process.cwd()/scripts/extract-mobile-cv.py`) rather than from Candidate data storage. This is a server-side ingest fix: multipart upload, canonical CV confirmation/versioning and the Android first-run contract do not change.

Deployed acceptance used the exact PDF selected on the Samsung. Public V1 upload task `e0a96fef-f3fc-4d76-8d73-e071c71a880b` completed, preserved filename `CV_Test_10_Yuki_Tanaka.pdf`, and returned 2,104 extracted characters beginning with `Yuki Tanaka`. The deployed V1 SHA is `7301c49076909a0a0a625a32d6e4e1a1012d7302`; production and Yifeng container identities/start times were unchanged.

## 2026-09-11 first-run match journey — 0.4.2/code16

V1 now starts from a candidate journey rather than dropping a new tester into an already-populated workspace:

- the preview-only first run is full-screen and ordered as **invite code → simulated Google sign-in → real CV upload/extraction → user confirmation → profile analysis → suggested directions/custom intent → real search → 3–4 swipeable scored roles**;
- simulated Google is intentionally limited to this V1 preview. It is labelled as a test account and does not replace or weaken the real Google authentication path on production `main`;
- CV upload and confirmation use the existing canonical ingest/version pipeline. Direction generation, structured job search, deterministic `fastMatch`, and the existing silent top-offer `deep_match` remain the real backend flows rather than onboarding fixtures;
- the first role deck exposes score, concise strengths/gaps and CV presentation upside. Tapping a card exits first-run and opens the same normal offer detail used after onboarding;
- Android and Web implement the same stages and persist first-run completion locally. Android package remains `com.thegreatnovel.jobpilot.v1`, so this release does not overwrite production or Yifeng builds.

Normal V1 surfaces were simplified at the same time. Home now leads with **“这是你会闪光的地方。”**, changes the old “当前信号” section to **“你的优势在哪”**, and removes explanatory causal prose that was repeating or qualifying every signal. Opportunity cards prefer score/strength/gap/potential labels over paragraphs of model rationale. Ordinary users no longer see the development server/domain control in “我的”; only account sync, refresh and sign-out remain.

Search history is now a product contract rather than a presentation accident. The mobile snapshot projects the current completed search plus up to eight earlier completed V1 searches for the same candidate version, deduplicates URLs across groups, and keeps their current deep-match enrichment. Changing direction therefore does not erase earlier offers from the UI, and a historical offer can still open the normal detail sheet. No candidate-data migration was added: persisted search tasks remain the authority.

Release versions for this change are Android `0.4.2/code16`, Web `0.6.2`, mobile snapshot contract `0.4.2`. Local release gates: Web TypeScript and production Next build PASS; Android `assembleDebug` PASS. The broad Node suite currently exposes the already-independent `owned-backend.test.mjs` asynchronous preference-refresh cleanup failure (`Profil inconnu.`) after its assertions pass; none of the first-run/search-history files touch that preference path, so it is recorded rather than hidden or treated as evidence for this V1 change.

Deployment/owner preview is also complete for this revision. Feature SHA `94389931d24928ccd01a41d6b2ad02ab30090cfe` is live on the isolated `jobpilot-v1` stack at `jobs-v1.thegreatnovel.com`; the deployment passed the production Web build, synthetic snapshot, model-key prewarm and structured-search provider gates. The live snapshot reports contract `0.4.2`, one current Louis offer and one retained historical search group/offer. A mobile-size Runtime browser check had no console errors and verified the `1/7` invite screen plus the following labelled simulated-Google step. Android `0.4.2/code16` is installed on the connected Samsung under the separate V1 package and its UI hierarchy shows the same first-run invite screen.

## 2026-09-11 AI/bootstrap recovery — 0.4.1/code15

The first deployed V1 preview exposed two real migration defects rather than a broken model transport:

- the V1 `analysis` flow reused a pre-V1 completed task because its operation key only contained the candidate version. That old task had no `careerDirections/searchKeywords`, so the UI reported analysis complete while showing no V1 directions and never started the intended analysis → search → deep-match loop;
- the isolated V1 VPS stack had model keys but no independent copy of the production search-provider runtime variables, so France Travail and JSearch were `unconfigured` and a search could finish in a few milliseconds with zero offers.

V1 now versions persisted operation identities (`analysis-v2-v1-directions`, `search-v6-live-providers`). A profile that already has a Master CV but no current V1-shaped analysis exposes `v1.needsBootstrap=true`; Android and Web each issue one idempotent POST `bootstrapV1` for that candidate version, rather than starting business work from a GET. Failed V1 analysis can be retried by the normal write/bootstrap triggers. A structurally unconfigured search environment now fails explicitly instead of pretending that an empty search succeeded.

The V1 VPS uses its own `/etc/server-infra/secrets/jobpilot-v1/runtime.env`; it receives an independent copy of the configured France Travail/JSearch values and does not mount the production runtime.env path. Deployment now fails if those three provider variables are absent.

Real synthetic `louis` acceptance after deployment:

- new V1 analysis `c4ba2344-1298-48b6-a951-2980a9a5bd19`: completed, agent 37.809s, 8,081 input + 3,104 output = 11,185 tokens; 4 career directions and 8 search keywords persisted;
- automatic structured search: France Travail `ok` (3 calls, 410ms, 0 raw in this run), JSearch `ok` (3 calls, 5.236s, 30 raw); one displayed high-relevance offer survived current ranking;
- Goldman Sachs 2027 EMEA Paris FICC & Equities Summer Analyst: deterministic fast match 82; silent deep match completed with CV potential 87 and capability potential 94;
- explicit tailored-CV task `6b42ab87-8c13-4bb5-b5ee-1e368f630e92`: completed, agent 12.592s, 6,410 input + 1,577 output = 7,987 tokens; produced a one-page pending draft for explicit keep/reject;
- Android `0.4.1/code15` was installed on the real Samsung `SM_S928U1`; the device UI showed the four new career directions and the Opportunities screen contained Goldman Sachs with score 82.

These checks use only the synthetic Louis profile. Production and Yifeng container identities/start times remained unchanged during V1 deployment.

## Product goal

V1 is for students and early-career candidates who are looking for a first CDI or one of their first internships and often do not yet understand what job titles mean in practice.

The product loop is intentionally narrow:

`Master CV -> directions -> real offers -> 0–100 match -> understand why -> see honest upside -> tailored CV diff -> keep/reject -> try another role`

The product should feel like it already understands the candidate and the job market. Users make decisions; AI performs background interpretation and scoring work.

## Three primary surfaces

### Home / 首页

- Starts from the CV, not an application-management dashboard.
- Shows 3–5 career directions inferred from documented evidence.
- Explicit user target roles always take priority over AI-inferred directions.
- Shows the first high-relevance real offers and the candidate's strongest current signals / real gaps.

### Opportunities / 机会

- Search intent is editable directly and seeded from explicit roles, AI directions and concrete search keywords.
- Every returned offer gets an immediate deterministic `fastMatch` score from 0 to 100. No per-card AI wait is required.
- Results are sorted by the exploration match score.
- Only the first five offers are silently enriched with `deep_match`.
- Opening an offer is read-only: it does not save an application, create an official evaluation, or write candidature state.

### My / 我的

- Holds the Master CV / Master Profile, preferences and secondary settings.
- Lists role-specific CV branches by company and role rather than opaque `CV v1 / final_final` filenames.
- Legacy application tracking remains available inside a saved role, but interview planning, coaching and formal evaluation are no longer primary navigation.

## AI visibility and triggers

### Hidden / automatic

1. Confirming or materially editing the Master CV triggers `analysis` silently.
2. Changing explicit target-role/location intent triggers a silent refresh analysis.
3. Analysis produces:
   - `careerDirections[3..5]`
   - concrete `searchKeywords`
   - the existing CV evidence/action analysis.
4. Completed analysis starts an initial silent search.
5. Search gives every offer `fastMatch` immediately.
6. Only top five search results start silent `deep_match` tasks.
7. Editing a tailored-CV draft rerenders locally and automatically starts a silent `cv_review`; there is no separate reassess button.
8. Silent tasks are omitted from the task centre and do not open the old blocking AI launch overlay. The snapshot exposes only `v1.backgroundActive` / state fields so clients can refresh quietly.

### Explicit

The primary V1 AI action is the offer CTA:

`查看我的 XX 分版本 / Voir ma version ~XX/100 / See my ~XX/100 version`

Only at this point is the offer saved into the user's own role list and a tailored CV generated. The user still explicitly decides whether to keep or reject the draft.

## Match-score contract

The V1 0–100 score is deliberately separate from the historical official 0–5 evaluation report.

For an offer the UI can show three levels:

- `currentScore`: current exploration match using documented candidate evidence.
- `cvPotentialScore`: approximate upper range reachable only through better selection/rewording of facts already documented. Capped at `current + 18`.
- `capabilityPotentialScore`: approximate upper range if the candidate later genuinely fills identified capability gaps. Capped at `current + 35`.

These are guidance scores, not probabilities of being hired.

A missing tool or skill is expressed as **not demonstrated**, not as a definitive claim that the candidate cannot do it.

When an accepted tailored CV has a measured presentation improvement, the saved role's display score may rise, but never above the prior `cvPotentialScore` ceiling. No wording change can masquerade as capability acquisition.

## Master Profile and CV consistency

Role-specific CVs never form a chain.

Correct model:

```text
Master Profile / Master CV
  |- Role A tailored CV
  |- Role B tailored CV
  |- Role C tailored CV
```

Forbidden model:

```text
Master CV -> Role A CV -> Role B CV -> Role C CV
```

The tailored-CV backend already freezes and loads its `inputVersionId` from candidate history. V1 keeps this boundary explicit in both Android and Web UI.

Edits made inside a role-specific CV stay role-specific. New real facts should be added to the Master Profile explicitly before they are reused by other roles; V1 does not silently promote wording from one tailored CV into the shared truth source.

## Deep Match contract

`deep_match` is read-only and does not create an official report or candidature write. It explains:

- what the role actually does;
- responsibilities;
- core / nice-to-have requirements;
- tools;
- candidate strengths with evidence;
- presentation gaps;
- real capability gaps and concrete next actions;
- CV-only and capability potential.

Candidate facts may come only from the frozen Master candidate sources. Job-intrinsic intelligence (role summary, responsibilities, requirements and tools) may be cached by normalized posting URL and reused across users. Candidate-specific strengths, gaps and scores are never put in that shared cache.

## Existing capabilities retained but demoted

The codebase still retains historical formal evaluation, interview plan/practice, comparison and coach flows for compatibility and later product stages. They are not V1 primary surfaces and are not automatically run across discovered offers.

Historical saved roles without `v1Match` continue to open through the legacy detail view so existing user data is not discarded.

## Versions and preview identity

- Web: `0.6.1`
- Android: `0.4.1` / code `15`
- Mobile backend snapshot contract: `0.4.1`
- Independent Android preview package: `com.thegreatnovel.jobpilot.v1`
- Launcher name: `JobPilot V1`
- Independent preview origin: `https://jobs-v1.thegreatnovel.com`
- The preview build is pinned to the isolated synthetic `louis` Profile and does not reuse the production/Yifeng Android package identity or persisted login state.

## Validation scope

The V1 branch uses deterministic / synthetic checks for development validation and does not rerun expensive full AI benchmarks against real candidates. The independent V1 preview deployment is separate from production `main` and Yifeng staging; deploying that preview must never be described as a production release or a merge into `main`.
