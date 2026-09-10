# JobPilot VPS deployment

Production infrastructure is maintained separately in `happyivanencoding/server-infra`.
Application source remains in this repository. The production domain is unchanged:
`https://jobs.thegreatnovel.com`.

The Ubuntu VPS runs the Web/backend, authenticated gateway and Cloudflare connector
as separate containers in one private application network namespace. The existing
loopback trust boundary remains intact; no application port is published on the host.
The infrastructure repository owns Docker build definitions, Compose, backup,
restore, health checks and restricted deployment scripts.

The backend uses `direct-openai`; display translations use the configured direct
DeepSeek transport. It does not require a home computer or AgentDock process.
Private Candidate data and gateway sessions are mounted from persistent VPS
directories; credentials are read from files outside both Git repositories.
The existing file-based data contract remains unchanged. PostgreSQL belongs to
the independent infrastructure layer and is not a replacement JobPilot datastore.

## Delivery

`Deploy JobPilot to production VPS` runs for changes to `web/**` on `main` and can
also be dispatched manually on `main`. The deployment account accepts only a full
current-main commit SHA or a read-only status request. It cannot open a shell or
forward ports. Production application API keys never live in GitHub Actions.

The 2026-09-10 Environment migration is complete. The production deploy job is
bound to `environment: production`; that environment contains `VPS_DEPLOY_KEY`
and `VPS_KNOWN_HOSTS` and only permits `main`. The staging environment contains
`VPS_STAGING_DEPLOY_KEY` and `VPS_KNOWN_HOSTS` and only permits `Yifeng`.
Repository Secrets are empty. Production run `34485270711` succeeded using the
Environment credentials, followed by a passing VPS health check.

The server fetches that exact public repository revision, builds a clean Linux
image, runs Node tests and deterministic PDF checks, takes a consistent backup,
then replaces the application containers. Health and authentication checks gate
success. A failed cutover restores the previous image reference; data snapshots
are retained separately for deliberate recovery. Busy model tasks postpone the
cutover rather than being killed.

## Yifeng staging

Yifeng's collaboration branch has a separate deployment path. A push to `Yifeng`
can deploy only to the isolated JobPilot staging stack; it does not deploy or
restart production. The staging server account is `jobpilot-staging-deploy` and
its forced command accepts only the current `origin/Yifeng` full SHA (plus a
read-only `status` request). A current `main` SHA and arbitrary shell command were
both explicitly rejected during installation.

Staging runs under `/srv/apps/jobpilot-staging` with its own Docker Compose
project/network and a synthetic `Louis` data root. It mounts no production
Candidate directory, no production sessions and no OpenAI/DeepSeek key. It also
publishes no VPS host port. The dedicated Cloudflare tunnel
`vps-jobpilot-staging` (`da4ff730-4fdb-4d1b-8961-fe49f063dea7`) is Healthy and routes
`staging.jobs.thegreatnovel.com` to `http://localhost:3000` in the staging Web
network namespace. Its token is a separate file owned by 1000:1000, mode 0400.

Staging run `34485410457` succeeded for Yifeng revision
`2b54b237870064db54c0d9f9372bac823841e0ab`; the deployed-SHA marker matches.
Internal synthetic API returns HTTP 200 / profile id `louis`, and the connector
readiness endpoint returns 200. Production container IDs did not change during
staging deployment.

**Public HTTPS remains blocked:** the existing Universal SSL certificate covers
only `thegreatnovel.com` and `*.thegreatnovel.com`, not the requested two-level
hostname. Both Windows and VPS HTTPS probes fail during TLS negotiation. The
owner must choose a covered one-level hostname such as `jobs-staging.thegreatnovel.com`
or authorize the dashboard's $10/month Advanced Certificate Manager option.
No subscription was purchased; public staging browser/API acceptance is pending.

The staging deployment gate is deliberately smaller than the production merge
gate: the exact Yifeng revision must complete the production Web build and then
pass a live synthetic root/API smoke. A staging preview may therefore exist while
branch tests are still red; those tests must be reconciled before the code is
eligible for `main`. `main` remains owner-reviewed through CODEOWNERS and branch
protection, and the existing production deployment continues to accept only
current `main`.

Android 0.3.9/code13 and Web/backend 0.5.2 keep the same public domain. The
authenticated gateway now supports Google Identity Services plus the existing
Cloudflare Access bridge. Google configuration stays in the private mounted
JobPilot access file (or `JOBPILOT_GOOGLE_CLIENT_ID`), never in Git. See
`GOOGLE_LOGIN_AND_ACCOUNT_ISOLATION.md` for admin/user Profile grants and first-CV onboarding.

The old Windows scheduled tasks and data are retained for recovery. The ignored
marker `.career-ops-web/production-migrated-to-vps` prevents both Windows start
helpers from starting a second writer after a logon. Do not simply remove the
marker: first stop VPS writes and restore its latest data/sessions to the local
installation, then remove the marker and deliberately switch the DNS back.

For actual server state, directories, backup retention, restoration, ports and
other projects, read `server-infra/docs/SERVER_HANDOFF.md`.
