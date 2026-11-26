# Production security configuration checklist

Complete this checklist for each production/staging environment. Do not paste secret values into GitHub issues or this document.

## Required secrets and origins
- [ ] Set a unique, random `JWT_SECRET` (at least 32 bytes; generate with `openssl rand -hex 32`).
- [ ] Set `JWT_ISSUER` and `JWT_AUDIENCE` identically across API replicas; changing either invalidates existing tokens.
- [ ] Set `TOTP_ENCRYPTION_KEY` to a 32-byte hex key (`openssl rand -hex 32`) before enabling authenticator MFA.
- [ ] Set `CORS_ORIGINS` to exact HTTPS frontend origins, comma-separated; do not use wildcard origins with credentialed cookies.
- [ ] Set the Cloudflare Turnstile site key in the frontend and `TURNSTILE_SECRET_KEY` in the API. Browser registration fails closed in production if the secret is missing.
- [ ] Production currently defaults the session cookie to `SameSite=None; Secure` for cross-site frontend/API hosting. Confirm this is required; set `COOKIE_SAME_SITE=lax` only for same-site deployments. Always use HTTPS.
- [ ] Keep database credentials, object-storage credentials and model artifact credentials in the host's secret manager/environment, not source control.

## Proxy, database and network
- [ ] Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies before the application. Default is 1; do not trust a proxy hop that can be bypassed by direct public access.
- [ ] Restrict database network access to application/worker hosts; use a least-privilege database role where supported.
- [ ] Ensure HTTPS termination and secure transport to external services; disable public database access where possible.
- [ ] Keep API and worker credentials separate where feasible; restrict model artifact bucket permissions.
- [ ] Verify that production migrations are applied before rolling out code that uses the shared `auth_rate_limit_buckets` table.

## Logs, retention and scheduled operations
- [ ] Confirm hosting/security logs are enabled, protected from modification, retained for the required period and stored in the required jurisdiction. CERT-In Directions may require rolling 180-day logs within India for covered entities; confirm applicability and provider controls.
- [ ] Designate and register the appropriate CERT-In point of contact if applicable.
- [ ] Configure a hosting scheduler to run `cd api && npm run audit:prune` at the approved cadence. The command exists, but no hosting cron is created by this repository PR.
- [ ] Configure backups, encryption, retention, and periodic restore testing.
- [ ] Test key/session revocation, rate-limit behavior, and alert delivery before launch.

## Rollout notes
- Strict JWT issuer/audience/time claims require users to sign in again after deployment.
- Apply the migration and environment variables before enabling the new API version.
- Run the health and readiness checks after rollout; `/health` is liveness and `/ready` checks database readiness.
