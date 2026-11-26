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
- [x] Add protected-route tests for malformed tokens, missing bearer, signed tokens missing required identity claims, expired tokens, and revoked sessions.
- [x] Document production issuer/audience configuration and forced re-login impact.

### 4.2 Authorization and tenant/resource boundaries
- [x] Create the router-level authorization inventory in docs/security/API_AUTHORIZATION_INVENTORY.md.
- [ ] Complete handler-by-handler endpoint and ownership predicate review (inventory explicitly remains a working review artifact).
- [x] Document and test student MCP owner-only reads/edits, per-key scopes, role re-check, and immediate key revocation.
- [ ] Finish handler-by-handler role/account-approval verification on every privileged path; reviewed router-level guards are recorded in the inventory.
- [x] Admin MCP tests verify missing tool scopes, current administrator role, and key revocation.
- [x] Add static regression tests requiring auth/admin/MCP key middleware on all non-public API route registrations and admin route registrations.
- [ ] Verify ownership predicates are included in reads, updates, and deletes for student-owned resources.
- [ ] Verify college/branch content eligibility is enforced in server queries, not only in the UI.
- [x] Add IDOR regression test proving a student MCP key cannot read or edit another student's private question.
- [ ] Add broader IDOR/privilege-escalation regression tests across admin, exams, analytics, and academic-scope routes.

### 4.3 Authentication lifecycle and MFA
- [ ] Review password hashing parameters, reset/change flows, refresh/session rotation, logout, account recovery, and admin protection.
- [x] Review TOTP replay/attempt limits, recovery-code single use (compare-and-swap), passkey challenge attempts/origin/RP validation, and credential removal.
- [x] MFA removal revokes all sessions; passkey removal revokes all sessions. Password change already increments session version.
- [x] Require a session issued within five minutes for TOTP enrollment and passkey enrollment/removal; TOTP disable verifies password and current factor.
- [ ] Verify client UX handles re-authentication-required responses for these security changes.
- [x] Add recent-auth, concurrent one-time recovery-code use, MFA-removal and passkey-removal session-revocation tests.
- [ ] Add exhaustive expired-challenge, passkey replay, and attempt-limit tests.

### 4.4 Abuse protection and perimeter
- [x] Replace process-local password-login/token failure counters with atomic PostgreSQL buckets shared across API instances; bucket keys are hashed and raw email/IP are not stored.
- [x] Replace the global API request limiter with a shared PostgreSQL atomic counter; liveness/readiness probes bypass the limiter database dependency.
- [x] Preserve per-IP+account and per-IP failure ceilings; success clears the corresponding hashed buckets.
- [x] Review lockout tradeoff: no global per-account lockout; account failures are scoped to IP+account and an IP-only ceiling limits one source, so another network is not locked out.
- [x] Review CORS allowlist, cookie flags, CSRF behavior, HTTPS enforcement, Helmet/security headers, body limits, schema validation, upload handling, and safe errors at middleware/config level; Helmet CSP defaults are enabled.
- [x] Production browser registration fails closed if Turnstile secret is missing; TRUST_PROXY_HOPS is validated and documented.
- [ ] Complete deployment-specific CORS origin, proxy chain, upload route, and host-level log verification.
- [x] Add login throttle tests and assert hashed PostgreSQL bucket identifiers.
- [x] Add exact 300-request API limiter boundary test and hashed bucket check.
- [x] Add trusted/untrusted cookie mutation-origin tests (unit coverage in api/tests/csrf.test.ts).

### 4.5 Secrets, data, admin MCP/model controls
- [x] Verify JWT/TOTP secret validation and document production environment checklist in docs/security/PRODUCTION_SECURITY_CONFIGURATION.md.
- [ ] Confirm actual production secrets, DB least-privilege, object-storage policies and host configuration without exposing secret values.
- [ ] Review database least-privilege/backup access and sensitive fields.
- [x] Review admin MCP per-tool scope gates and current-admin/key revocation checks; student MCP is owner- and scope-bound (regression tests added).
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
- Password login, bearer-token endpoint, and general API throttling now use atomic PostgreSQL upserts in `auth_rate_limit_buckets`, shared across instances. The migration is `20261126070000_add_shared_auth_rate_limits`; account/IP bucket keys are SHA-256 digests and stale rows are cleaned during login failure handling and periodic API requests. `/health` and `/ready` bypass the limiter so liveness/readiness remain meaningful during database trouble.
- Production browser registration fails closed without Turnstile secret configuration. Helmet's default CSP and SAMEORIGIN headers are enabled. `TRUST_PROXY_HOPS` is validated; deployers must configure it to match the actual trusted proxy chain.
