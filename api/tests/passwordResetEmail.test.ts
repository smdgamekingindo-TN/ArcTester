import { afterEach, describe, expect, it } from "vitest";
import { sendPasswordResetEmail } from "../src/passwordResetEmail.js";

const oldUser = process.env.GMAIL_USER;
const oldPassword = process.env.GMAIL_APP_PASSWORD;
afterEach(() => {
  if (oldUser === undefined) delete process.env.GMAIL_USER; else process.env.GMAIL_USER = oldUser;
  if (oldPassword === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = oldPassword;
});

describe("password reset email delivery", () => {
  it("rejects missing Gmail SMTP configuration without connecting", async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    await expect(sendPasswordResetEmail("student@example.test", "https://example.test/reset")).rejects.toThrow(/Gmail.*not configured/);
  });
});
