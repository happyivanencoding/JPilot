# Onward V1 0.5.1 / Web 0.7.1

Scope: isolated V1 worktree and `feature/v1-student-match-loop-20260910`; Android package `com.thegreatnovel.jobpilot.v1`, versionCode 25. Production/main and Yifeng remain separate releases.

## Language and text integrity

- V1 analysis, job-detail explanations and company-related prose now follow the visible app language on Android and Web. Device/browser French -> `fr`, Chinese -> `zh`, every unsupported or unknown locale -> English. Legacy profile/Android analysis-language preferences can no longer create a French-UI/Chinese-analysis mismatch.
- The separate insights-language selector is removed from V1 first-run and profile settings. Application-CV material language remains independent.
- Common UTF-8-as-Latin-1 provider corruption is repaired at the V1 offer projection boundary; e.g. `VINCI Energies SÃ©nÃ©gal` is displayed as `VINCI Energies Sénégal` without changing correctly encoded Unicode names.

## DeepSeek display localization

The translation provider remains the direct DeepSeek transport configured for V1. Production operation records showed successful `deepseek-direct` French/Chinese localizations as well as failures where only a small number of segments remained outside the target language. The failure was therefore not a missing current API key or a disconnected provider.

The localization transaction now caches every segment that independently passes target-language and protected-token validation, then sends only rejected segments through one bounded DeepSeek repair pass. Wrong-language text and damaged protected evidence are still rejected; a repair failure remains explicit and requires user retry rather than silently accepting dirty cache content. This prevents two bad segments from discarding dozens of good translations.

## Tailored CV continuity

- V1 targeted CVs reuse the same professional layout source and CSS family as the Original CV preview. When the source was an imported PDF, both views reuse the same extracted original layout source.
- Original name, contact block, headline and untouched language/interest/additional-information sections are preserved. Job tailoring replaces wording/content inside the relevant Profile/Experience/Projects/Education/Skills sections instead of rebuilding a visually unrelated résumé.
- The generation prompt now explicitly preserves documented experiences, education and chronology; tailoring is primarily wording, bullet prioritisation and concise descriptions. The canonical/original CV is not overwritten by preview generation.

## Validation before rollout

- Targeted Node regression: 25/25 passed, covering locale fallback, mojibake repair, localization cache/repair semantics and targeted-CV contact/layout continuity.
- Web 0.7.1 production build: passed, including TypeScript and Next production compilation. An initial type error exposed by the build in `v1-display` was fixed and the build rerun successfully.
- Android 0.5.1/code25 `:app:assembleDebug`: passed after the final language-path cleanup. Existing SDK XML / deprecated `TabRow` warnings are unchanged and are not release blockers.

## Delivery receipts — 2026-09-11

Pending product commit/deployment/device receipts are appended after the real rollout; no placeholder is to be treated as acceptance evidence.
