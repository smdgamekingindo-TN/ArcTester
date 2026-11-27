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

function mimeBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trimEnd();
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
      mimeBase64(text),
      "--" + boundary,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64", "",
      mimeBase64(html),
      "--" + boundary + "--");
  } else {
    parts.push("Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64", "",
      mimeBase64(text));
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
    // Keep provider response bodies and OAuth credentials out of user-facing errors.
    throw new Error("Gmail API message delivery failed (HTTP " + response.status + ").");
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const safeUrl = resetUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const text = "Reset your ArcTester password\n\nWe received a request to reset your password. This secure link expires in 30 minutes:\n\n" +
    resetUrl + "\n\nIf you did not request this, ignore this email. Your password will not change.";
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="padding:32px 12px"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e8f1;border-radius:18px;overflow:hidden">
    <div style="padding:24px 28px;background:#3159d8;color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:2px;opacity:.85">ARCTESTER</div><h1 style="margin:12px 0 0;font-size:24px;line-height:1.25">Reset your password</h1></div>
    <div style="padding:28px"><p style="margin:0 0 14px;font-size:15px;line-height:1.7">We received a request to reset the password for your ArcTester account.</p>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#526078">Use the secure button below to choose a new password. This link expires in <strong>30 minutes</strong> and can only be used once.</p>
      <p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:#3159d8;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px">Reset password</a></p>
      <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#65738a">If the button does not work, copy and paste this link into your browser:</p><p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all"><a href="${safeUrl}" style="color:#3159d8">${safeUrl}</a></p>
      <div style="padding:14px 16px;background:#f6f8fc;border-radius:10px;font-size:12px;line-height:1.6;color:#65738a">If you did not request a password reset, you can safely ignore this email. Your password will not change.</div>
    </div><div style="padding:16px 28px;border-top:1px solid #edf0f5;font-size:11px;color:#8792a5">ArcTester · Focused exam practice</div>
  </div></div></body></html>`;
  await sendEmail(to, "Reset your ArcTester password", text, html);
}


export async function sendEmailVerificationCode(to: string, code: string): Promise<void> {
  const baseUrl = requiredEnv("APP_BASE_URL").replace(/\\/$/, "");
  const verifyUrl = baseUrl + "/?verifyEmail=1&email=" + encodeURIComponent(to);
  const text = "Verify your ArcTester email\\n\\nYour 6-digit verification code is " + code +
    ". It expires in 15 minutes.\\n\\nOpen ArcTester to enter the code: " + verifyUrl +
    "\\n\\nIf you did not create an ArcTester account, you can ignore this email.";
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="padding:32px 12px"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3e8f1;border-radius:18px;overflow:hidden">
    <div style="padding:24px 28px;background:#3159d8;color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:2px;opacity:.85">ARCTESTER</div><h1 style="margin:12px 0 0;font-size:24px;line-height:1.25">Verify your email</h1></div>
    <div style="padding:28px"><p style="margin:0 0 14px;font-size:15px;line-height:1.7">One quick step to finish creating your ArcTester account.</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#526078">Enter this verification code in ArcTester:</p>
      <div style="margin:0 0 22px;padding:18px 14px;background:#f3f6ff;border:1px solid #dbe4ff;border-radius:12px;text-align:center;font-size:30px;font-weight:800;letter-spacing:10px;color:#3159d8">${code}</div>
      <p style="margin:0 0 22px;font-size:13px;line-height:1.6;color:#65738a">This code expires in <strong>15 minutes</strong> and can only be used once.</p>
      <p style="margin:0 0 24px"><a href="${verifyUrl}" style="display:inline-block;padding:14px 24px;background:#3159d8;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px">Open email verification</a></p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#65738a">If you did not create an ArcTester account, you can ignore this email.</p>
    </div><div style="padding:16px 28px;border-top:1px solid #edf0f5;font-size:11px;color:#8792a5">ArcTester · Focused exam practice</div>
  </div></div></body></html>`;
  await sendEmail(to, "Verify your ArcTester email", text, html);
}
