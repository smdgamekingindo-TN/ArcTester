import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyGoogleCredential } from "./auth.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Google credential verification", () => {
  it("accepts only verified, unexpired ID tokens for the configured client", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "arctester-web-client-id");
    const claims = {
      aud: "arctester-web-client-id",
      email: "Student@Example.com",
      email_verified: "true",
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "https://accounts.google.com",
      sub: "google-subject-123",
      name: "Student Example",
    };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(claims), { status: 200 })));
    await expect(verifyGoogleCredential("x".repeat(120))).resolves.toEqual({
      sub: "google-subject-123",
      email: "student@example.com",
      name: "Student Example",
    });
  });

  it("rejects an ID token issued for another OAuth client", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "arctester-web-client-id");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      aud: "another-client",
      email: "student@example.com",
      email_verified: true,
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "accounts.google.com",
      sub: "google-subject-123",
    }), { status: 200 })));
    await expect(verifyGoogleCredential("x".repeat(120))).rejects.toThrow("Google account verification failed");
  });

  it("rejects an unverified email address", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "arctester-web-client-id");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      aud: "arctester-web-client-id",
      email: "student@example.com",
      email_verified: false,
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "accounts.google.com",
      sub: "google-subject-123",
    }), { status: 200 })));
    await expect(verifyGoogleCredential("x".repeat(120))).rejects.toThrow("Google account verification failed");
  });
});
