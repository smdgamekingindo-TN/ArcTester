# Google student sign-in

ArcTester uses Google Identity Services (GIS) to sign in students with a Google account. The browser sends a Google ID credential to the API; the API validates its claims through Google's token verification endpoint and checks the configured OAuth client audience.

## Google Cloud Console

1. Open the Google Cloud project used for ArcTester.
2. Configure the OAuth consent screen with the app name and support email.
3. Create an OAuth 2.0 Client ID of type **Web application**.
4. Add the exact production frontend origin under **Authorized JavaScript origins**. Add localhost origins only for local development.
5. Copy the Web client ID. Do not put a client secret in the frontend; GIS ID-token sign-in does not require a client secret.

## Render API

On the Render service **ArcTester** (https://arctester.onrender.com), set:

- GOOGLE_CLIENT_ID: the OAuth Web client ID.

Keep the server value aligned with the frontend value. The API rejects tokens with a different audience, an unverified email, an expired token, or an invalid Google issuer.

## Web frontend

Set the Vercel web project's build environment variable:

- VITE_GOOGLE_CLIENT_ID: the same OAuth Web client ID.

Redeploy the web frontend after adding or changing this variable. The Google button is rendered only when this variable is configured.

## Student behavior

- A verified Google email matching an existing approved student account signs in directly.
- Existing accounts that are pending or rejected remain blocked by the current administrator approval policy.
- A new Google email opens the **Complete your student profile** popup. The student enters their full name, college, diploma registration number and branch, and accepts the current Terms & Conditions and Privacy Notice.
- New Google registrations are submitted as PENDING and require administrator approval, consistent with ArcTester's existing registration flow.
- Google sign-in does not bypass TOTP. Existing students with an authenticator enabled must complete the second-factor challenge.
- New Google-only accounts receive a random server-generated password hash; no password or Google access token is stored.

## Verification checklist

- Existing approved student: signs in and receives the normal ArcTester session.
- Existing pending / rejected student: receives the same access-status restriction as password login.
- New Google email: sees the profile-completion popup; invalid registration identity or missing legal acceptance is rejected.
- New registration: creates one pending student and one legal-acceptance record.
- Wrong OAuth audience, unverified email, expired token, and malformed credential are rejected.
- Student with TOTP must complete the second-factor challenge.
- Two different Google accounts cannot access each other's student records.
