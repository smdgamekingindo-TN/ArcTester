# Parent / legal guardian consent flow

ArcTester student registration supports two paths:

- Adults confirm they are 18 or older and accept the current Terms & Conditions and Privacy Notice.
- Students under 18 leave the adult confirmation unchecked and provide a parent or legal guardian email. The API creates the student request as pending and emails a one-time consent link to that address.

The consent link contains a random 256-bit token. ArcTester stores only its SHA-256 digest, expires the link after 48 hours, and accepts consent only once. The guardian must open the link and submit the explicit confirmation form; opening the email link alone does not record consent. Student sessions are blocked until guardian consent is recorded, and the existing administrator approval requirement remains in force.

## Deployment configuration

Set API_BASE_URL on the API service to the public root URL of the deployed API (for example, https://arctester.onrender.com). Guardian consent email delivery uses the existing Gmail API credentials (GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN). Keep these server-only.

Apply the GuardianConsent Prisma migration before deploying the API. The production deployment must be checked after migration and email credentials are configured.

## Important

This is an implementation of email-based guardian confirmation and an access gate. It is not a legal certification of DPDP compliance or a substitute for legal review of the applicable child-data requirements, consent language, retention, and withdrawal process.
