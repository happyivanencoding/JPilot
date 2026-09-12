# JobPilot Web and backend

This Next application is the **only official Onward V1 tester client** on `feature/v1-mobile-web-only-20260912`. It is designed first for iPhone Safari and Android Chrome, while desktop keeps the same phone-oriented product surface. Testers require only `https://jobs-v1.thegreatnovel.com/`; native installation is not part of the V1 test. Android source remains in the repository but is frozen on this branch, and there is no iOS client or legacy Web workbench.

Install with `npm ci`, configure private `web/.env.local` from the root `.env.example`, then use `npm run dev` or `npm run build && npm start`. The root package simply delegates here; installing a separate root engine is unnecessary. Server-side PDF rendering requires Chromium/Edge/Chrome, optionally selected through `JOBPILOT_CHROMIUM_PATH`.

`src/lib/backend/` contains the file ledger, saved-opportunity inbox and native CV/PDF services. `src/lib/candidatures.ts` shares candidature storage/reconciliation across HTTP and task orchestration. `src/lib/job-search/` contains the current structured discovery pipeline. Model inference uses `src/lib/model-transport.ts`; no business model is given file, terminal or browser authority.

Run `npm test`, `npm run typecheck`, `npm run build`. `npm run qa:backend` tests a real temporary built server with fictional data and PDF rendering; `JOBPILOT_QA_ENGINE=webkit` selects WebKit instead of Chromium/Edge. `npm run qa:cv` renders fictional documents and verifies their actual PDF contents/page counts without model calls. `scripts/qa-jobpilot-web.mjs` covers the frontend interactions using fixture API responses.

See `../docs/OWNED_CORE.md` and `../DATA_CONTRACT.md` for the independent runtime boundary, retained data formats, completed validation, production cutover rules and license provenance.
