# Google login and per-user Profile isolation

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

## Google browser configuration

The gateway uses Google Identity Services in the browser and verifies the returned Google ID Token itself. It does not need a Google Client Secret and Android does not embed a Google SDK or secret.

Create a Google **Web application** OAuth client for JobPilot and authorize this JavaScript origin:

`https://jobs.thegreatnovel.com`

Then save the returned Web Client ID with `manage-access.mjs set-google-client`. The gateway reloads this private access file on requests, so account grants, revocations and the Client ID take effect without restarting the gateway. Once configured, `/api/mobile-auth/login` and Android's existing browser-pairing flow use Google. The previous Cloudflare Access bridge remains available as a compatibility fallback and should not be deleted until Google login has been verified with both an admin and an ordinary test user.

## Invariants

- Never put `mobile-access.json`, Google credentials, session files, Candidate Profile registry, CVs, reports, or application history in Git.
- The Google email must already exist in the private JobPilot account allowlist. Google authentication alone never creates access.
- Removing an email from the allowlist invalidates its existing JobPilot session on the next request because grants are recalculated from current private configuration.
- A user Profile never becomes an admin Profile just because more Profiles are created later.
