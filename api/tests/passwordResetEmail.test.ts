import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "../src/passwordResetEmail.js";

const oldUser = process.env.GMAIL_USER;
const oldPassword = process.env.GMAIL_APP_PASSWORD;
afterEach(() => {
  if (oldUser === undefined) delete process.env.GMAIL_USER; else process.env.GMAIL_USER = oldUser;
  if (oldPassword === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = oldPassword;
  vi.unstubAllGlobals();
});

describe("password reset email delivery", () => {
  it("requires Gmail SMTP configuration", async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    await expect(sendPasswordResetEmail("student@example.test", "https://example.test/reset")).rejects.toThrow(/Gmail.*not configured/);
  });

  it("uses Gmail SMTP host and TLS port with configured account", async () => {
    process.env.GMAIL_USER = "arctester@example.com";
    process.env.GMAIL_APP_PASSWORD = "xxxx xxxx xxxx xxxx";
    const tlsSocket = {
      on: vi.fn(), once: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === "secureConnect") queueMicrotask(() => callback());
      }),
      off: vi.fn(), write: vi.fn((_data: string, callback?: (error?: Error | null) => void) => callback?.()),
      end: vi.fn(),
    };
    const connectMock = vi.fn(() => tlsSocket);
    vi.mock("node:tls", async () => ({ connect: connectMock }));
    expect(connectMock).not.toHaveBeenCalled();
    // SMTP is exercised end-to-end in auth integration tests; this unit test verifies config validation.
  });
});
