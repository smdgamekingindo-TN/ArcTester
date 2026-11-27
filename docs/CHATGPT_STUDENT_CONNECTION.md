# ChatGPT student connection and Gmail API setup

## Student ChatGPT connection

ArcTester exposes its existing student Streamable HTTP MCP endpoint at `POST /mcp/student`.
The endpoint accepts either a student MCP key or a Google OAuth access token. For Google
OAuth, the API calls Google's userinfo endpoint, requires `email_verified: true`, and
maps the verified email to an existing ArcTester user. Only `role=STUDENT` and
`accessStatus=APPROVED` accounts are accepted. Each tool query is scoped to that user's
own private question bank and practice sets.

ChatGPT tools currently include:
- list, create, edit and delete private practice questions;
- create, list and edit private practice papers;
- never create or assign official exams.

### Google Cloud Console

1. Open Google Cloud Console and select the ArcTester project.
2. Configure Google OAuth consent and enable the OAuth/OpenID identity flow. The server uses Google's OpenID Connect UserInfo endpoint with the `openid email profile` scopes; the People API is not required.
3. Configure the OAuth consent screen with ArcTester branding and a privacy policy.
4. Create an OAuth 2.0 **Web application** client ID.
5. In the ChatGPT plugin's OAuth connection setup, use:
   - Authorization URL: `https://accounts.google.com/o/oauth2/v2/auth`
   - Token URL: `https://oauth2.googleapis.com/token`
   - Scope: `openid email profile`
   - Client authentication: HTTP Basic or the method supported by the ChatGPT connector.
6. Copy the exact redirect/callback URL shown by ChatGPT into the Google Cloud Console
   client's **Authorized redirect URIs**. Do not guess or add a wildcard.
7. Save the client ID and secret in the ChatGPT connection configuration. Do not commit them
   to this repository or expose them in browser/mobile builds.

The student's Google account must use the same verified email as their approved ArcTester
student account. The server rejects unverified, unknown, pending, rejected, and non-student
accounts. Google access tokens are not stored in ArcTester.

### MCP server endpoint

Use the exact HTTPS origin assigned to the ArcTester API service in Render, followed by
`/mcp/student`. Do not use the Vercel frontend origin unless it has an explicitly configured
proxy for this MCP POST route. The server endpoint must be publicly reachable over HTTPS.

## Gmail API delivery

Password-reset email is sent through the Gmail API, not SMTP or a Gmail App Password.
The API uses a Google Cloud OAuth refresh token to obtain short-lived access tokens and then
calls `users.messages.send`.

### Google Cloud Console mail setup

1. Enable **Gmail API** in the same or a dedicated Google Cloud project.
2. Create an OAuth 2.0 Web application client and configure its authorized redirect URI for
   the OAuth flow used to obtain a refresh token.
3. Obtain a refresh token with the scope
   `https://www.googleapis.com/auth/gmail.send` for the Gmail account that will send ArcTester mail.
4. Set the following **server-only** environment variables on the Render API service:
   - `GMAIL_USER`: sender Gmail address
   - `GMAIL_CLIENT_ID`: Google OAuth client ID
   - `GMAIL_CLIENT_SECRET`: Google OAuth client secret
   - `GMAIL_REFRESH_TOKEN`: OAuth refresh token with Gmail send scope
   - `GMAIL_FROM_NAME`: optional sender display name (defaults to ArcTester)
   - `APP_BASE_URL`: public ArcTester frontend URL for reset links

Never put the client secret or refresh token in Vercel, the web bundle, Android app,
GitHub commits, or ChatGPT messages. A successful API response from Gmail confirms the
message was accepted by Gmail; it does not guarantee inbox placement. Check Gmail's
sent folder and delivery/bounce signals when diagnosing mail.

## Required release checks

- Test password-reset delivery to a real test mailbox after Render environment variables are set.
- Confirm Gmail API returns a message ID and the message appears in the sender's Sent folder.
- Test Google OAuth with an approved student, a pending student, a non-student, and a Google
  account whose verified email does not match an ArcTester account.
- Test MCP question and practice-set create/list operations and confirm data is isolated
  between two student accounts.
