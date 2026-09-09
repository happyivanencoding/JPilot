# JobPilot Web and backend

This Next application mirrors the native Android product and serves both clients through the same API. There is no independent desktop dashboard or legacy Web workbench.

Install with `npm ci`, configure private `web/.env.local` from the root `.env.example`, then use `npm run dev` or `npm run build && npm start`. The root package simply delegates here; installing a separate root engine is unnecessary. Server-side PDF rendering requires Chromium/Edge/Chrome, optionally selected through `JOBPILOT_CHROMIUM_PATH`.

`src/lib/backend/` contains the file ledger, saved-opportunity inbox and native CV/PDF services. `src/lib/candidatures.ts` shares candidature storage/reconciliation across HTTP and task orchestration. `src/lib/job-search/` contains the current structured discovery pipeline. Model inference uses `src/lib/model-transport.ts`; no business model is given file, terminal or browser authority.

Run `npm test`, `npm run typecheck`, `npm run build`. `npm run qa:backend` tests a real temporary built server with fictional data and PDF rendering; `JOBPILOT_QA_ENGINE=webkit` selects WebKit instead of Chromium/Edge. `npm run qa:cv` renders fictional documents and verifies their actual PDF contents/page counts without model calls. `scripts/qa-jobpilot-web.mjs` covers the frontend interactions using fixture API responses.

See `../docs/OWNED_CORE.md` and `../DATA_CONTRACT.md` for the independent runtime boundary, retained data formats, completed validation, production cutover rules and license provenance.
