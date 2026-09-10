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
also be dispatched manually on `main`. GitHub holds only the restricted deployment
SSH key and pinned server host key in Actions Secrets, not application API keys.
The deployment account accepts only a full current-main commit SHA or a read-only
status request. It cannot open a shell or forward ports.

The server fetches that exact public repository revision, builds a clean Linux
image, runs Node tests and deterministic PDF checks, takes a consistent backup,
then replaces the application containers. Health and authentication checks gate
success. A failed cutover restores the previous image reference; data snapshots
are retained separately for deliberate recovery. Busy model tasks postpone the
cutover rather than being killed.

Android 0.3.8/code12 continues to use the same domain and contract 0.3.8, so a
server-only move does not require reinstalling the application.

The old Windows scheduled tasks and data are retained for recovery. The ignored
marker `.career-ops-web/production-migrated-to-vps` prevents both Windows start
helpers from starting a second writer after a logon. Do not simply remove the
marker: first stop VPS writes and restore its latest data/sessions to the local
installation, then remove the marker and deliberately switch the DNS back.

For actual server state, directories, backup retention, restoration, ports and
other projects, read `server-infra/docs/SERVER_HANDOFF.md`.
