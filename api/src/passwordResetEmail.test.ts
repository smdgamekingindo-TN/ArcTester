import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail, sendPasswordResetEmail } from "./passwordResetEmail.js";

const env = {
  GMAIL_USER: "sender@example.com",
  GMAIL_CLIENT_ID: "google-client-id",
  GMAIL_CLIENT_SECRET: "google-client-secret",
  GMAIL_REFRESH_TOKEN: "google-refresh-token",
  GMAIL_FROM_NAME: "ArcTester",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubGmailApi() {
  const fetchMock = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "temporary-access-token" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gmail-message-id" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Gmail API email delivery", () => {
  it("refreshes a Google OAuth token and sends a MIME message through Gmail API", async () => {
    vi.stubEnv("GMAIL_USER", env.GMAIL_USER);
    vi.stubEnv("GMAIL_CLIENT_ID", env.GMAIL_CLIENT_ID);
    vi.stubEnv("GMAIL_CLIENT_SECRET", env.GMAIL_CLIENT_SECRET);
    vi.stubEnv("GMAIL_REFRESH_TOKEN", env.GMAIL_REFRESH_TOKEN);
    vi.stubEnv("GMAIL_FROM_NAME", env.GMAIL_FROM_NAME);
    const fetchMock = stubGmailApi();

    await sendEmail("student@example.com", "ArcTester notice", "Plain text", "<p>HTML</p>");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://oauth2.googleapis.com/token");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("grant_type=refresh_token");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ authorization: "Bearer temporary-access-token" });
    const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { raw: string };
    const mime = Buffer.from(payload.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(mime).toContain("To: <student@example.com>");
    expect(mime).toContain("Subject: ArcTester notice");
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain(Buffer.from("Plain text").toString("base64"));
    expect(mime).toContain(Buffer.from("<p>HTML</p>").toString("base64"));
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(env.GMAIL_CLIENT_SECRET);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(env.GMAIL_REFRESH_TOKEN);
  });

  it("sends password reset content through the same Gmail API path", async () => {
    vi.stubEnv("GMAIL_USER", env.GMAIL_USER);
    vi.stubEnv("GMAIL_CLIENT_ID", env.GMAIL_CLIENT_ID);
    vi.stubEnv("GMAIL_CLIENT_SECRET", env.GMAIL_CLIENT_SECRET);
    vi.stubEnv("GMAIL_REFRESH_TOKEN", env.GMAIL_REFRESH_TOKEN);
    const fetchMock = stubGmailApi();

    await sendPasswordResetEmail("student@example.com", "https://arctester.example/reset?token=abc");

    const payload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { raw: string };
    const mime = Buffer.from(payload.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    expect(mime).toContain("Reset your ArcTester password");
    expect(mime.replace(/\\r?\\n/g, "")).toContain(Buffer.from("https://arctester.example/reset?token=abc").toString("base64"));
  });

  it("fails instead of claiming delivery when Gmail API rejects the message", async () => {
    vi.stubEnv("GMAIL_USER", env.GMAIL_USER);
    vi.stubEnv("GMAIL_CLIENT_ID", env.GMAIL_CLIENT_ID);
    vi.stubEnv("GMAIL_CLIENT_SECRET", env.GMAIL_CLIENT_SECRET);
    vi.stubEnv("GMAIL_REFRESH_TOKEN", env.GMAIL_REFRESH_TOKEN);
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "temporary-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("provider failure", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendEmail("student@example.com", "ArcTester notice", "Plain text"))
      .rejects.toThrow("Gmail API message delivery failed (HTTP 403).");
  });
});
