# JobPilot V1 — Student Match Loop

> Branch-only product line for first external student tests. This document describes `feature/v1-student-match-loop-20260910`; it is not a statement that production `main` has switched to V1.

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

- Web: `0.6.0`
- Android: `0.4.0` / code `14`
- Mobile backend snapshot contract: `0.4.0`
- Independent Android preview package: `com.thegreatnovel.jobpilot.v1`
- Launcher name: `JobPilot V1`
- Independent preview origin: `https://jobs-v1.thegreatnovel.com`
- The preview build is pinned to the isolated synthetic `louis` Profile and does not reuse the production/Yifeng Android package identity or persisted login state.

## Validation scope

The V1 branch uses deterministic / synthetic checks for development validation and does not rerun expensive full AI benchmarks against real candidates. The independent V1 preview deployment is separate from production `main` and Yifeng staging; deploying that preview must never be described as a production release or a merge into `main`.
