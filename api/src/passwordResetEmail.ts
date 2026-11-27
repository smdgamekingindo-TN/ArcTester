import { connect } from "node:tls";

type SmtpReply = { code: number; lines: string[] };

function readReply(socket: ReturnType<typeof connect>): Promise<SmtpReply> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); socket.off("close", onClose); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("Gmail SMTP connection closed before a reply.")); };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      const complete = lines.filter(line => /^\d{3} /.test(line));
      if (!complete.length) return;
      const code = Number(complete[complete.length - 1].slice(0, 3));
      if (code < 200 || code >= 400) { const detail = complete.map(line => line.slice(4)).join(" ").split("").filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126).join("").slice(0, 160); cleanup(); reject(new Error("Gmail SMTP rejected a command (SMTP " + code + (detail ? ": " + detail : "") + ").")); return; }
      cleanup();
      resolve({ code, lines: complete });
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

function command(socket: ReturnType<typeof connect>, value: string): Promise<SmtpReply> {
  // Start listening before writing: SMTP servers can reply before the write
  // callback runs, and attaching the reader afterward can lose the response.
  const response = readReply(socket);
  const write = new Promise<void>((resolve, reject) => {
    socket.write(value + "\r\n", error => error ? reject(error) : resolve());
  });
  return Promise.all([write, response]).then(([, reply]) => reply).catch(error => {
    socket.destroy();
    throw error;
  });
}

function mimeBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const fromName = process.env.GMAIL_FROM_NAME?.trim() || "ArcTester";
  if (!user || !appPassword) throw new Error("Gmail password reset email delivery is not configured.");

  const socket = connect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com" });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    await readReply(socket);
    await command(socket, "EHLO arctester.app");
    await command(socket, "AUTH LOGIN");
    await command(socket, Buffer.from(user).toString("base64"));
    await command(socket, Buffer.from(appPassword).toString("base64"));
    await command(socket, "MAIL FROM:<" + user + ">");
    await command(socket, "RCPT TO:<" + to + ">");
    await command(socket, "DATA");

    const subject = "Reset your ArcTester password";
    const text = "We received a request to reset your ArcTester password. Use this link within 30 minutes:\n\n" + resetUrl + "\n\nIf you did not request this, you can ignore this email.";
    const html = "<p>We received a request to reset your ArcTester password.</p><p><a href=\"" + resetUrl + "\">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>";
    const boundary = "ArcTesterReset-" + Buffer.from(resetUrl).toString("hex").slice(0, 24);
    const message = [
      "From: " + fromName.replace(/[\r\n"]/g, "") + " <" + user + ">",
      "To: <" + to + ">",
      "Subject: " + subject,
      "MIME-Version: 1.0",
      "Content-Type: multipart/alternative; boundary=\"" + boundary + "\"",
      "",
      "--" + boundary,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      mimeBase64(text),
      "--" + boundary,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      mimeBase64(html),
      "--" + boundary + "--",
      ".",
    ].join("\r\n");
    await new Promise<void>((resolve, reject) => socket.write(message + "\r\n", error => error ? reject(error) : resolve()));
    await readReply(socket);
    await command(socket, "QUIT");
  } catch (error) {
    throw error instanceof Error && /Gmail SMTP/.test(error.message) ? error : new Error("Gmail SMTP password reset email delivery failed.");
  } finally {
    socket.end();
  }
}
