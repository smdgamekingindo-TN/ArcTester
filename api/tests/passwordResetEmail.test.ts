import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "../src/passwordResetEmail.js";

const oldKey = process.env.RESEND_API_KEY;
const oldFrom = process.env.RESEND_FROM_EMAIL;
afterEach(() => {
  if (oldKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = oldKey;
  if (oldFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = oldFrom;
  vi.unstubAllGlobals();
});

describe("password reset email delivery", () => {
  it("posts the reset link to the configured email provider", async () => {
    process.env.RESEND_API_KEY = "unit-test-key";
    process.env.RESEND_FROM_EMAIL = "ArcTester <verified@example.test>";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendPasswordResetEmail("student@example.test", "https://arctester.vercel.app/?passwordResetToken=sample-token");
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.to).toEqual(["student@example.test"]);
    expect(body.text).toContain("passwordResetToken=sample-token");
  });

  it("rejects missing provider configuration", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    await expect(sendPasswordResetEmail("student@example.test", "https://example.test/reset")).rejects.toThrow(/not configured/);
  });
});
