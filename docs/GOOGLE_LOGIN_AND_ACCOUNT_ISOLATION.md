# Google login and per-user Profile isolation

## Current Google production configuration — 2026-09-10, 08:21 UTC

This section supersedes the quota/client blockers in the historical checks below. Google approved the quota request; the browser subsequently allowed project creation. Created the independent **JobPilot Production** project (`jobpilot-production`) and **JobPilot Web** OAuth Web application client. Branding is `JobPilot`, using the owner account's selectable support/contact email; Audience remains **External / Testing**. The owner and explicitly authorized partner are saved as test users. Data Access contains only `openid`, `https://www.googleapis.com/auth/userinfo.email` and `https://www.googleapis.com/auth/userinfo.profile`; no sensitive or restricted scopes, additional requested APIs, Firebase, publication or verification were added.

- Public Client ID: `693658457123-rg339kiqms0bt1huv5uhm12kgsl23ql5.apps.googleusercontent.com`.
- Sole authorized JavaScript origin: `https://jobs.thegreatnovel.com`; no authorized redirect URI. No Client Secret was copied to files, VPS, Android or Git.
- Installed only `googleClientId` in the private VPS access config after a private backup. Existing three admins, one ordinary user and all other fields were preserved. Inode and `1000:1000 / 0400` remained unchanged; the running gateway mount read back the exact Client ID. No restart/recreate was needed.
- Public login returns **302 → `/api/mobile-auth/google`**; POST pairing start returns **200 / provider=google** with the real production host. Anonymous `/api/mobile` remains **401** and the old Cloudflare bridge remains **302**. At 08:21 UTC gateway/Web were healthy, Tunnel ready, backup fresh.
- **Owner Google login is NOT TESTED end to end**: Chrome blocked both the login entry and Google page with `ERR_BLOCKED_BY_CLIENT`, before Google account selection or a new JobPilot session. The browser tool refused access to extension-management diagnostics under its URL policy; no browser protections were bypassed. Existing cookies or previous admin sessions are not Google acceptance evidence.
- Yifeng and ordinary-user real Google sign-in remain pending their own authentication. Android real Google pairing remains pending; only the public pairing provider was verified. No new AI analysis, evaluation, CV generation or job search was triggered, and no Candidate data was deliberately modified.

Next: open `https://jobs.thegreatnovel.com/api/mobile-auth/google` in the owner's browser and resolve the client-side block, then complete real Google sign-in and verify a newly issued admin session with all Profiles. Do not recreate the project/client or replace the installed Client ID while addressing browser access.

## Partner administrator update — 2026-09-10

The user supplied and explicitly authorized the partner's Google email. That exact email was absent from the production allowlist, so it was added as `admin` without removing or changing the two existing admins or the ordinary user's single-Profile binding. The current total is **3 admins + 1 ordinary user**. Do not continue assuming that the previously inferred second admin is the partner: they are distinct allowlist entries.

A private backup preceded an in-place write preserving the access file inode, uid/gid `1000:1000` and mode `0400`. The running gateway's mounted configuration was read back and confirmed the new admin. No other config fields, production data or containers were changed. Google Client ID remains unset while the official project quota request is pending. The partner's actual Google sign-in is still unverified; user confirmation of the email is not an OAuth login test.

## Production continuation check — 2026-09-10

Google production activation remains **BLOCKED**. The signed-in Google Cloud account has no clearly identified JobPilot project in its All projects list; New project displays **Increase Project Limit**. No other Google project was changed, no JobPilot client was created, and the earlier Project OS client must not be reused for JobPilot. No Firebase, Identity Platform, extra API scopes, publication or OAuth verification was configured.

The VPS private configuration was read without exposing account emails or session tokens: two admins, one ordinary user bound to `youness`, empty `googleClientId`, uid/gid `1000:1000`, mode `0400`. The browser owner matches a production admin. The other admin has not been matched to Yifeng through a real Google account; this is unverified, not a proven mismatch. Do not activate Google until that identity is confirmed.

Both existing admin sessions returned HTTP 200, `role=admin` and four Profiles through the public `/api/mobile` endpoint. These are existing sessions, **not Google-login evidence**. The ordinary user has no active production session. Production ordinary-user Google login and data isolation remain pending that user's own sign-in.

Unauthenticated `/api/mobile` returns 401; `/api/mobile-auth/login` redirects to the retained bridge; the bridge responds with 302; pairing start returns 200 with `provider=cloudflare` and the real production host. VPS health passed at 07:51 UTC: gateway/Web healthy, Tunnel ready, backup fresh. No production configuration, containers, Candidate data or AI tasks were changed by this check.

Targeted local tests (`node --test tests/mobile-gateway.test.mjs tests/jobpilot-web.test.mjs`) passed 14/14 using isolated fixtures. Source inspection also confirms allowlist-only Google access, one-Profile user grants, query/body/header scope rejection, filtered `/api/profiles`, and CV onboarding with `needsCv=true`. Default `invite-user` creates an independent profile without canonical `cv.md`; retain that path for new testers. Do not mistake regression/source checks for live Google or personal-data isolation acceptance.

ADB reported no connected devices. Existing APK metadata is 0.3.9/code13; no installation or Android login was performed. Google Web login, owner Google login, Yifeng identity, ordinary-user production Google isolation and Android pairing: **BLOCKED**. Cloudflare fallback and VPS health: **PASS**. Resume after project quota and real-account/device prerequisites are available; preserve fallback and the single-file bind-mount precautions below.

## Product contract

JobPilot has two account roles at the authenticated gateway:

- `admin`: for the workspace owner and explicitly trusted collaborators. Admins resolve the current Profile registry dynamically and may switch Profiles.
- `user`: one invited email maps to exactly one `profileId`. The gateway rejects any query/body/header that tries to select another Profile, and the Web API filters Profile listings with the same grant.

Legacy array grants remain readable during migration, but new accounts must use the role form. Do not create a normal user with multiple Profile grants.

A newly provisioned normal user intentionally starts without `cv.md`. The shared `/api/mobile` snapshot returns `access.needsCv=true`; Web and Android then keep the user on the Profile/CV screen and hide ordinary navigation until the canonical CV is uploaded or entered and confirmed through the existing versioned CV writer.

## Private account management

Account configuration and Candidate files remain outside Git. Run from the JobPilot application checkout/runtime that owns the private mounted data:

```bash
node web/scripts/manage-access.mjs grant-admin --email ADMIN_GOOGLE_EMAIL
node web/scripts/manage-access.mjs invite-user --email USER_GOOGLE_EMAIL --name "Display Name"
node web/scripts/manage-access.mjs revoke --email USER_GOOGLE_EMAIL
node web/scripts/manage-access.mjs set-google-client --client-id GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
```

`invite-user` creates an empty, isolated Profile if needed. It creates minimal private config/notes/candidature files but deliberately does not create a CV, so first login enters CV onboarding. Existing Candidate Profiles are not deleted by `revoke`.

Current production status (2026-09-10): the three pre-existing legacy grants have been migrated to two `admin` accounts and one `user` bound to a single existing Profile. Both admin accounts have been verified through existing authenticated production sessions; the ordinary-user mapping is present in the production config but that account had no active session during this migration. The Google Web Client ID is still unset, so production login still falls back to the Cloudflare bridge.

The current VPS mounts `mobile-access.json` into the gateway as a single read-only bind-mounted file. If host-side tooling updates that file by atomic rename, the running container can keep the old inode even though the gateway code rereads its path for every request. In that case preserve the production file ownership/mode required by the non-root container and recreate the gateway container after the write. Server-specific commands belong in the private `server-infra` handoff rather than this repository.

## Google browser configuration

The gateway uses Google Identity Services in the browser and verifies the returned Google ID Token itself. It does not need a Google Client Secret and Android does not embed a Google SDK or secret.

Create a Google **Web application** OAuth client for JobPilot and authorize this JavaScript origin:

`https://jobs.thegreatnovel.com`

Then save the returned Web Client ID with `manage-access.mjs set-google-client`. The gateway reloads the private access file on every request when the mounted path resolves to the updated file. On the current VPS, follow the bind-mount caveat above if the host update replaces the inode. Once configured, `/api/mobile-auth/login` and Android's existing browser-pairing flow use Google. The previous Cloudflare Access bridge remains available as a compatibility fallback and should not be deleted until Google login has been verified with both an admin and an ordinary test user.

## Invariants

- Never put `mobile-access.json`, Google credentials, session files, Candidate Profile registry, CVs, reports, or application history in Git.
- The Google email must already exist in the private JobPilot account allowlist. Google authentication alone never creates access.
- Removing an email from the allowlist invalidates its existing JobPilot session on the next request because grants are recalculated from current private configuration.
- A user Profile never becomes an admin Profile just because more Profiles are created later.
