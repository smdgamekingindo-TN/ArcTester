# Part 4 — Security and compliance hardening

**Status:** In progress on `feat/part-4-security-compliance-hardening`. This document is the implementation checklist; unchecked items are not claimed complete.

## Delivery rules
- Keep the work on this feature branch and open one reviewable PR for Part 4.
- No production deployment before merge and required environment configuration.
- Run focused tests after each security change, then full CI on the final head.
- Security controls must be enforced server-side. UI visibility is not authorization.
- Do not log passwords, tokens, cookies, OTPs, recovery codes, private keys, or raw request bodies.

## Workstreams and acceptance criteria

### 4.1 Token/session verification
- [x] Explicit HS256 algorithm/type allowlist and constant-time signature comparison.
- [x] Require JWT issuer and audience; validate issued-at, expiry, optional not-before, and maximum seven-day lifetime.
- [x] Keep session-version and database-backed session revocation checks.
- [x] Add coverage for invalid/expired JWTs, wrong issuer/audience, future issued-at, excessive lifetime, and revoked sessions in auth tests.
- [ ] Add dedicated malformed/missing-claim protected-route tests.
- [x] Document production issuer/audience configuration and forced re-login impact.

### 4.2 Authorization and tenant/resource boundaries
- [x] Create the router-level authorization inventory in docs/security/API_AUTHORIZATION_INVENTORY.md.\n- [ ] Complete handler-by-handler endpoint and ownership predicate review (inventory explicitly remains a working review artifact).
- [x] Document and test student MCP owner-only reads/edits, per-key scopes, role re-check, and immediate key revocation.
- [ ] Finish handler-by-handler role/account-approval verification on every privileged path; reviewed router-level guards are recorded in the inventory.
- [x] Admin MCP tests verify missing tool scopes, current administrator role, and key revocation.
- [ ] Verify ownership predicates are included in reads, updates, and deletes for student-owned resources.
- [ ] Verify college/branch content eligibility is enforced in server queries, not only in the UI.
- [x] Add IDOR regression test proving a student MCP key cannot read or edit another student's private question.
- [ ] Add broader IDOR/privilege-escalation regression tests across admin, exams, analytics, and academic-scope routes.

### 4.3 Authentication lifecycle and MFA
- [ ] Review password hashing parameters, reset/change flows, refresh/session rotation, logout, account recovery, and admin protection.
- [x] Review TOTP replay/attempt limits, recovery-code single use (compare-and-swap), passkey challenge attempts/origin/RP validation, and credential removal.
- [x] MFA removal revokes all sessions; passkey removal revokes all sessions. Password change already increments session version.
- [ ] Review remaining MFA enrollment and credential-change flows for fresh-auth requirements.
- [x] Add concurrent one-time recovery-code use and MFA-removal session-revocation tests.
- [ ] Add exhaustive expired-challenge, passkey replay, and attempt-limit tests.

### 4.4 Abuse protection and perimeter
- [x] Replace process-local password-login/token failure counters with atomic PostgreSQL buckets shared across API instances; bucket keys are hashed and raw email/IP are not stored.
- [x] Replace the global API request limiter with a shared PostgreSQL atomic counter; liveness/readiness probes bypass the limiter database dependency.
- [x] Preserve per-IP+account and per-IP failure ceilings; success clears the corresponding hashed buckets.
- [ ] Review shared IP lockout behavior against denial-of-service tradeoffs.
- [ ] Review CORS allowlist, cookie flags, CSRF behavior, HTTPS enforcement, Helmet/security headers, body limits, schema validation, upload handling, and safe errors.
- [x] Add login throttle tests and assert hashed PostgreSQL bucket identifiers.
- [x] Add exact 300-request API limiter boundary test and hashed bucket check.
- [ ] Add trusted/untrusted cookie mutation-origin tests.

### 4.5 Secrets, data, admin MCP/model controls
- [ ] Verify production secret validation and deployment configuration; ensure no secret values are committed.
- [ ] Review database least-privilege/backup access and sensitive fields.
- [ ] Review every admin MCP tool's required scope and current-admin checks; verify student MCP remains user-owned and scoped.
- [x] Add tests for missing admin MCP scopes, revoked/demoted admin keys, and student MCP cross-user access/role/revocation.

### 4.6 Privacy and incident readiness (India)
- [x] Draft privacy/data-purpose/minimization, retention/deletion, data-request and incident-response runbook in docs/security/PRIVACY_AND_INCIDENT_RESPONSE.md.
- [ ] Publish student-facing privacy notice and establish the actual request/grievance contact before production.
- [x] Record the current official DPDP phased commencement and CERT-In 6-hour incident reporting / 180-day log requirements with official links.
- [ ] Obtain qualified legal/security review and confirm applicability, hosting jurisdiction, log retention and point of contact.
- [x] State that engineering checklist completion is not legal certification.

## Current implementation notes
- JWTs now carry `iss=arctester-api` and `aud=arctester-client` by default. Override with `JWT_ISSUER` and `JWT_AUDIENCE` consistently across all API instances/environments.
- Verifier rejects missing/wrong issuer or audience, missing/future `iat`, expired tokens, invalid `nbf`, and lifetimes over seven days.
- Existing tokens minted before this change do not contain the required claims and will be rejected after deployment. Users will need to sign in again. This is intentional; schedule deployment with a user-facing re-login notice.
- Password login and bearer-token endpoint throttling now use atomic PostgreSQL upserts in `auth_rate_limit_buckets`, shared across instances. The migration is `20261126070000_add_shared_auth_rate_limits`; bucket keys are SHA-256 digests and stale rows are cleaned during failed-login processing. The global API request limiter now also uses the shared PostgreSQL table. Both login failure and general API request buckets store hashed identifiers; `/health` and `/ready` bypass the limiter so liveness/readiness remain meaningful during database trouble.
