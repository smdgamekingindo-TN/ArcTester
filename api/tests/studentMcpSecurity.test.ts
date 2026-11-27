import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/index.js";
import { signJwt } from "../src/auth.js";
import { startTestServer, type TestServer } from "./server.js";

let server: TestServer;
let studentId = 0;
let keyId = "";
let bearer = "";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const response = await fetch(server.baseUrl + "/mcp/student", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + bearer },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe("student MCP authorization and ownership", () => {
  beforeAll(async () => {
    server = await startTestServer(buildApp);
    const student = await server.db.user.create({
      data: { email: "student-mcp-security@arctester.test", passwordHash: "test-only", role: "STUDENT", accessStatus: "APPROVED" },
    });
    const other = await server.db.user.create({
      data: { email: "other-mcp-owner@arctester.test", passwordHash: "test-only", role: "STUDENT", accessStatus: "APPROVED" },
    });
    studentId = student.id;
    await server.db.studentPrivateQuestion.create({
      data: { userId: student.id, subject: "Security", topic: "Ownership", text: "Owned question", options: ["A", "B"], correctIndex: 0 },
    });
    await server.db.studentPrivateQuestion.create({
      data: { userId: other.id, subject: "Security", topic: "Ownership", text: "Other student's question", options: ["A", "B"], correctIndex: 0 },
    });
    bearer = "arc_student_" + randomBytes(32).toString("base64url");
    const key = await server.db.studentMcpKey.create({
      data: { userId: student.id, name: "security-test", keyHash: digest(bearer), scopes: ["questions:read", "questions:write", "practice:read", "practice:write"] },
    });
    keyId = key.id;
  });

  afterAll(async () => { await server.close(); });

  it("limits reads to the key owner and prevents cross-student edits", async () => {
    const listed = await rpc("list_my_questions", { limit: 50 });
    expect(listed.status).toBe(200);
    const body = listed.body as { result: { content: Array<{ text: string }> } };
    const output = JSON.parse(body.result.content[0]!.text) as { questions: Array<{ text: string; userId: number }> };
    expect(output.questions.map(question => question.text)).toEqual(["Owned question"]);
    expect(output.questions.every(question => question.userId === studentId)).toBe(true);

    const otherQuestion = await server.db.studentPrivateQuestion.findFirst({ where: { text: "Other student's question" } });
    const edit = await rpc("edit_my_question", { id: otherQuestion!.id, patch: { text: "Attempted cross-account edit" } });
    expect(edit.body, JSON.stringify(edit.body)).toMatchObject({ error: { code: -32004 } });
    expect((await server.db.studentPrivateQuestion.findUnique({ where: { id: otherQuestion!.id } }))?.text).toBe("Other student's question");
  });

  it("creates practice exams through MCP in the same student-owned library", async () => {
    const created = await rpc("create_my_practice_exam", {
      title: "MCP-created exam",
      description: "Shared library test",
      durationMinutes: 15,
      questions: [{ subject: "Math", topic: "Algebra", text: "What is 2 + 2?", options: ["3", "4", "5", "6"], correctIndex: 1, explanation: "Two plus two equals four.", difficulty: "easy" }],
    });
    expect(created.status).toBe(200);
    const response = created.body as { result: { content: Array<{ text: string }> } };
    const output = JSON.parse(response.result.content[0]!.text) as { practiceTest: { id: string; userId: number; title: string } };
    expect(output.practiceTest.title).toBe("MCP-created exam");
    expect(output.practiceTest.userId).toBe(studentId);

    const saved = await server.db.studentPracticeSet.findUnique({ where: { id: output.practiceTest.id } });
    expect(saved?.userId).toBe(studentId);
    expect(saved?.title).toBe("MCP-created exam");

    const listed = await rpc("list_my_practice_exams", { limit: 10 });
    const listBody = listed.body as { result: { content: Array<{ text: string }> } };
    const listOutput = JSON.parse(listBody.result.content[0]!.text) as { practiceTests: Array<{ id: string }> };
    expect(listOutput.practiceTests.some(test => test.id === output.practiceTest.id)).toBe(true);
  });

  it("enforces per-key scopes and re-checks current account role", async () => {
    await server.db.studentMcpKey.update({ where: { id: keyId }, data: { scopes: ["questions:read"] } });
    const denied = await rpc("create_my_questions", { questions: [{ subject: "Math", text: "Should be denied", options: ["A", "B"], correctIndex: 0 }] });
    expect(denied.body, JSON.stringify(denied.body)).toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining("Missing questions:write scope.") }] } });

    await server.db.user.update({ where: { id: studentId }, data: { role: "ADMIN" } });
    const demotedOrWrongRole = await rpc("list_my_questions", { limit: 10 });
    expect(demotedOrWrongRole.status).toBe(403);
    await server.db.user.update({ where: { id: studentId }, data: { role: "STUDENT" } });
  });

  it("returns a verified OAuth denial redirect and preserves state", async () => {
    const clientId = "https://chatgpt.com/oauth/client-metadata.json";
    const redirectUri = "https://chatgpt.com/connector/oauth/redirect";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === clientId) {
        return new Response(JSON.stringify({ client_name: "ChatGPT", redirect_uris: [redirectUri] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    try {
      const response = await fetch(server.baseUrl + "/oauth/authorize/deny", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          code_challenge: "A".repeat(43),
          code_challenge_method: "S256",
          scope: "questions:read",
          state: "oauth-state-check",
          resource: "https://arctester.onrender.com/mcp/student",
          approved: false,
        }),
      });
      expect(response.status).toBe(200);
      const body = await response.json() as { redirectUrl: string };
      const target = new URL(body.redirectUrl);
      expect(target.origin + target.pathname).toBe(redirectUri);
      expect(target.searchParams.get("error")).toBe("access_denied");
      expect(target.searchParams.get("state")).toBe("oauth-state-check");
      expect(target.searchParams.get("iss")).toBe("https://arctester.onrender.com");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("advertises OAuth resource metadata and challenges unlinked clients", async () => {
    const metadata = await fetch(server.baseUrl + "/.well-known/oauth-protected-resource/mcp/student");
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      resource: "https://arctester.onrender.com/mcp/student",
      authorization_servers: ["https://arctester.onrender.com"],
    });
    const response = await fetch(server.baseUrl + "/mcp/student", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("oauth-protected-resource");
  });

  it("advertises the admin OAuth resource and accepts admin-resource OAuth tokens only for admins", async () => {
    const metadata = await fetch(server.baseUrl + "/.well-known/oauth-protected-resource/mcp/admin");
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      resource: "https://arctester.onrender.com/mcp/admin",
      authorization_servers: ["https://arctester.onrender.com"],
    });

    const admin = await server.db.user.create({
      data: { email: "admin-mcp-oauth@arctester.test", passwordHash: "test-only", role: "ADMIN", accessStatus: "APPROVED" },
    });
    const token = signJwt({
      sub: String(admin.id),
      email: admin.email,
      sv: admin.sessionVersion,
      mcp_oauth: true,
      resource: "https://arctester.onrender.com/mcp/admin",
      scope: "models:read",
    }, 3600);
    await server.db.adminMcpKey.create({
      data: { userId: admin.id, name: "Admin OAuth test", keyHash: digest(token), scopes: ["models:read"] },
    });

    const response = await fetch(server.baseUrl + "/mcp/admin", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { serverInfo: { name: "arctester-admin-mcp" } } });

    await server.db.user.update({ where: { id: admin.id }, data: { role: "STUDENT" } });
    const revokedRole = await fetch(server.baseUrl + "/mcp/admin", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "initialize" }),
    });
    expect(revokedRole.status).toBe(403);
  });

  it("accepts a short-lived OAuth access token linked to a student key record", async () => {
    const user = await server.db.user.findUnique({ where: { id: studentId }, select: { id: true, email: true, sessionVersion: true } });
    expect(user).toBeTruthy();
    const oauthToken = signJwt({ sub: String(user!.id), email: user!.email, sv: user!.sessionVersion, mcp_oauth: true, resource: "https://arctester.onrender.com/mcp/student", scope: "questions:read practice:read" }, 3600);
    await server.db.studentMcpKey.create({
      data: { userId: studentId, name: "OAuth test connection", keyHash: digest(oauthToken), scopes: ["questions:read", "practice:read"] },
    });
    const previous = bearer;
    bearer = oauthToken;
    const result = await rpc("list_my_questions", { limit: 10 });
    bearer = previous;
    expect(result.status).toBe(200);
  });

  it("rejects revoked MCP keys immediately", async () => {
    await server.db.studentMcpKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
    const revoked = await rpc("list_my_questions", { limit: 10 });
    expect(revoked.status).toBe(401);
  });
});
