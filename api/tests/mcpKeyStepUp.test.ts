import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPasswordAsync } from "../src/auth.js";
import { buildApp } from "../src/index.js";
import { startTestServer, type TestServer } from "./server.js";

let server: TestServer;
const password = "step-up-test-password-123";

async function post(path: string, body: Record<string, unknown>, cookie?: string) {
  return fetch(server.baseUrl + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}
function sessionCookie(response: Response): string {
  const value = response.headers.get("set-cookie");
  if (!value) throw new Error("Expected session cookie from authentication response.");
  return value.split(";")[0]!;
}

describe("MCP key creation step-up authentication", () => {
  beforeAll(async () => { server = await startTestServer(buildApp); });
  afterAll(async () => { await server.close(); });

  async function verifyRole(role: "STUDENT" | "ADMIN") {
    const email = role.toLowerCase() + "-mcp-step-up@arctester.test";
    const user = await server.db.user.create({
      data: { email, passwordHash: await hashPasswordAsync(password), role, accessStatus: "APPROVED" },
    });
    const login = await post("/auth/login", { email, password });
    expect(login.status).toBe(200);
    const cookie = sessionCookie(login);

    const path = role === "STUDENT" ? "/student/mcp-keys" : "/admin/mcp-keys";
    const scopes = role === "STUDENT" ? ["questions:read"] : ["models:read"];
    const denied = await post(path, { name: "step-up-test", scopes }, cookie);
    expect(denied.status).toBe(403);
    expect(await server.db.studentMcpKey.count({ where: { userId: user.id } })).toBe(0);
    expect(await server.db.adminMcpKey.count({ where: { userId: user.id } })).toBe(0);

    const reauthenticated = await post("/auth/reauthenticate", { password }, cookie);
    expect(reauthenticated.status).toBe(200);
    const freshCookie = sessionCookie(reauthenticated);
    const created = await post(path, { name: "step-up-test", scopes }, freshCookie);
    expect(created.status).toBe(201);
    const result = await created.json() as { key: { secret: string } };
    expect(result.key.secret).toMatch(/^arc_(student|admin)_[A-Za-z0-9_-]+$/);
    const storedStudent = await server.db.studentMcpKey.findFirst({ where: { userId: user.id } });
    const storedAdmin = await server.db.adminMcpKey.findFirst({ where: { userId: user.id } });
    expect(Boolean(storedStudent)).toBe(role === "STUDENT");
    expect(Boolean(storedAdmin)).toBe(role === "ADMIN");
  }

  it("requires explicit reauthentication for student and administrator keys", async () => {
    await verifyRole("STUDENT");
    await verifyRole("ADMIN");
  });
});
