# ArcTester DPDP and privacy/security readiness plan

**Priority: P0 — required before broad public rollout.** This is an engineering plan, not legal advice or a compliance certification. The project owner must appoint the responsible Data Fiduciary/operator and obtain qualified Indian privacy counsel review.

## Implemented in this change

- Separate mandatory Terms acceptance and personal-data processing consent in web and mobile registration.
- Adult eligibility attestation; registration is blocked for users who do not attest to being 18+. This is only a self-attestation gate, not age verification.
- Server-side validation of all acceptance flags and exact document versions; direct API callers cannot skip the UI.
- Atomic account creation plus immutable legal acceptance record: user, accepted document versions, timestamp, source and age-gate version/attestation.
- Privacy Notice and Terms pages, plus source-controlled draft copies.
- Test coverage for missing consent and recorded acceptance.

## Must complete before production sign-off

1. **Operator identity:** identify the legal Data Fiduciary, postal address, privacy contact and grievance contact; publish verified details in both legal documents.
2. **Under-18 users:** implement a verifiable parent/guardian consent workflow that meets the applicable DPDP Rules. Do not accept child accounts until counsel verifies the method. A checkbox/email click alone may not establish verifiable parental consent.
3. **Data inventory:** map every personal-data field and purpose, including academic identifiers, exam answers/scores, analytics, audit logs, MCP records, devices, login metadata and backups.
4. **Processors and transfers:** list actual Render/Vercel/database/storage/email/AI/security providers, locations, subprocessors, contracts and safeguards. Verify production and backup region rather than assuming it.
5. **Retention:** approve and configure a per-category schedule, including exam/academic records, audit events, login/security logs, account deletion and backup expiry. Reconcile DPDP storage limitation with CERT-In log requirements.
6. **Rights workflow:** build verified access/correction/erasure/withdrawal/grievance intake, response tracking, deadlines, deletion/anonymisation and legal-retention exceptions.
7. **Consent lifecycle:** allow users to review and withdraw consent; version notices; re-prompt on material purpose/document changes; keep evidence without collecting unnecessary IP/device identifiers.
8. **Security controls:** enforce least privilege, tenant/branch isolation, encryption in transit/at rest, secret rotation, MFA for administrators, shared rate limits, secure backups, dependency scanning and audit access reviews.
9. **Incident readiness:** appoint an incident owner and backup, maintain CERT-In point of contact, test the applicable reporting timeline and DPDP breach-notification process, preserve evidence and run a tabletop drill.
10. **Children safeguards:** review restrictions on tracking/behavioral monitoring/targeted advertising and any exemptions before enabling features for minors.
11. **Legal release gate:** counsel reviews actual data flows and final policy/terms; no placeholder fields remain; production smoke tests verify consent and privacy controls.

## DPDP phased commencement

The Act and Rules have phased commencement. The principal data-fiduciary obligations and corresponding Rules are scheduled for 18 months after the 13 November 2025 notifications (13 May 2027); some provisions commenced earlier. Re-check the latest Gazette notifications and amendments at release. The project should implement controls early rather than treating the future date as permission to ignore privacy now.

## Acceptance evidence

For each control, record owner, implementation PR, test evidence, deployment date and counsel/security reviewer. Do not mark ArcTester “DPDP compliant” until the operator's actual obligations and all required controls have been independently reviewed.
