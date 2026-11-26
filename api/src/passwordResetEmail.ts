/**
 * Sends password-reset links through Resend. Keep provider credentials server-side.
 * Configure RESEND_API_KEY and RESEND_FROM_EMAIL in the API service.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new Error("Password reset email delivery is not configured.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your ArcTester password",
      text: "We received a request to reset your ArcTester password. Use this link within 30 minutes:\n\n" + resetUrl + "\n\nIf you did not request this, you can ignore this email.",
      html: "<p>We received a request to reset your ArcTester password.</p><p><a href=\"" + resetUrl + "\">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>",
    }),
  });
  if (!response.ok) {
    // Do not include provider response bodies: they may contain recipient or account data.
    throw new Error("Password reset email provider rejected the message (HTTP " + response.status + ").");
  }
}
