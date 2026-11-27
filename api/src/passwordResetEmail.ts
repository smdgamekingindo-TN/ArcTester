/**
 * Gmail API delivery using a Google Cloud Console OAuth 2.0 refresh token.
 * No Gmail password or SMTP app password is stored by ArcTester.
 */
function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Gmail API delivery is not configured: missing " + name + ".");
  return value;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

async function getGmailAccessToken(): Promise<string> {
  const clientId = requiredEnv("GMAIL_CLIENT_ID");
  const clientSecret = requiredEnv("GMAIL_CLIENT_SECRET");
  const refreshToken = requiredEnv("GMAIL_REFRESH_TOKEN");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Google OAuth token refresh failed (HTTP " + response.status + ").");
  const payload = await response.json() as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Google OAuth did not return an access token.");
  }
  return payload.access_token;
}

function buildRawMessage(to: string, subject: string, text: string, html?: string): string {
  const sender = requiredEnv("GMAIL_USER");
  const fromName = safeHeader(process.env.GMAIL_FROM_NAME?.trim() || "ArcTester");
  const recipient = safeHeader(to);
  const safeSubject = safeHeader(subject);
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("A valid email recipient is required.");
  }
  if (!safeSubject) throw new Error("Email subject is required.");
  const boundary = "ArcTester-" + Buffer.from(String(Date.now()) + recipient).toString("hex").slice(0, 32);
  const parts = [
    "From: " + fromName + " <" + sender + ">",
    "To: <" + recipient + ">",
    "Subject: " + safeSubject,
    "MIME-Version: 1.0",
  ];
  if (html) {
    parts.push("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"", "",
      "--" + boundary,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64", "",
      mimeBase64(text).trimEnd(),
      "--" + boundary,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64", "",
      mimeBase64(html).trimEnd(),
      "--" + boundary + "--");
  } else {
    parts.push("Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64", "",
      Buffer.from(text, "utf8").toString("base64"));
  }
  return encodeBase64Url(parts.join("\r\n"));
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const accessToken = await getGmailAccessToken();
  const raw = buildRawMessage(to, subject, text, html);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: "Bearer " + accessToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!response.ok) {
    // Keep provider response bodies and OAuth credentials out of user-facing errors/logs.
    throw new Error("Gmail API message delivery failed (HTTP " + response.status + ").");
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const text = "We received a request to reset your ArcTester password. Use this link within 30 minutes:\n\n" +
    resetUrl + "\n\nIf you did not request this, you can ignore this email.";
  const html = "<p>We received a request to reset your ArcTester password.</p><p><a href=\"" +
    resetUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;") +
    "\">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>";
  await sendEmail(to, "Reset your ArcTester password", text, html);
}
