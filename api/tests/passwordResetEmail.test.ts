import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));
vi.mock("node:tls", () => ({ connect: connectMock }));

import { sendPasswordResetEmail } from "../src/passwordResetEmail.js";

const oldUser = process.env.GMAIL_USER;
const oldPassword = process.env.GMAIL_APP_PASSWORD;
afterEach(() => {
  if (oldUser === undefined) delete process.env.GMAIL_USER; else process.env.GMAIL_USER = oldUser;
  if (oldPassword === undefined) delete process.env.GMAIL_APP_PASSWORD; else process.env.GMAIL_APP_PASSWORD = oldPassword;
  connectMock.mockReset();
});

class FakeSmtpSocket extends EventEmitter {
  writes: string[] = [];
  write(value: string | Buffer, callback?: (error?: Error | null) => void) {
    const text = value.toString();
    this.writes.push(text);
    let reply = "";
    if (text.includes("\\r\\n.\\r\\n")) reply = "250 2.0.0 Message queued\\r\\n";
    else {
      const command = text.trim();
      if (command.startsWith("EHLO ")) reply = "250-smtp.gmail.com\\r\\n250-AUTH LOGIN PLAIN\\r\\n250 OK\\r\\n";
      else if (command === "AUTH LOGIN") reply = "334 VXNlcm5hbWU6\\r\\n";
      else if (command === Buffer.from("smdgameking@gmail.com").toString("base64")) reply = "334 UGFzc3dvcmQ6\\r\\n";
      else if (command === Buffer.from("app-password-fixture").toString("base64")) reply = "235 2.7.0 Authentication successful\\r\\n";
      else if (command.startsWith("MAIL FROM:")) reply = "250 2.1.0 Sender OK\\r\\n";
      else if (command.startsWith("RCPT TO:")) reply = "250 2.1.5 Recipient OK\\r\\n";
      else if (command === "DATA") reply = "354 End data with <CR><LF>.<CR><LF>\\r\\n";
      else if (command === "QUIT") reply = "221 2.0.0 Bye\\r\\n";
      else throw new Error("Unexpected SMTP command in test: " + command);
    }
    // Emit the reply before the write callback to reproduce the real SMTP race.
    if (reply) this.emit("data", Buffer.from(reply));
    callback?.();
    return true;
  }
  end() {}
  destroy() { this.emit("close"); }
}

describe("password reset email delivery", () => {
  it("rejects missing Gmail SMTP configuration without connecting", async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    await expect(sendPasswordResetEmail("student@example.test", "https://example.test/reset")).rejects.toThrow(/Gmail.*not configured/);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("handles immediate SMTP replies and sends a password-reset message", async () => {
    process.env.GMAIL_USER = "smdgameking@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-password-fixture";
    const socket = new FakeSmtpSocket();
    connectMock.mockImplementation(() => {
      queueMicrotask(() => {
        socket.emit("secureConnect");
        queueMicrotask(() => socket.emit("data", Buffer.from("220 smtp.gmail.com ESMTP ready\\r\\n")));
      });
      return socket;
    });

    const resetUrl = "https://arctester.vercel.app/?passwordResetToken=test-token";
    await sendPasswordResetEmail("student@example.test", resetUrl);
    expect(socket.writes.some(write => write.startsWith("EHLO "))).toBe(true);
    expect(socket.writes.some(write => write.includes("MAIL FROM:<smdgameking@gmail.com>"))).toBe(true);
    expect(socket.writes.some(write => write.includes("RCPT TO:<student@example.test>"))).toBe(true);
    expect(socket.writes.some(write => write.includes(Buffer.from(resetUrl).toString("base64")))).toBe(true);
    expect(socket.writes.some(write => write.trim() === "QUIT")).toBe(true);
  });
});
