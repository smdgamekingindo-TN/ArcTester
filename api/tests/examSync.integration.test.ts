import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth.js";
import { buildApp } from "../src/index.js";
import { sessionCookie, startTestServer, type TestServer } from "./server.js";

describe("assigned exam concurrent synchronization", () => {
  let server: TestServer;
  let adminCookie = "";
  let studentCookie = "";
  let studentId = 0;
  let questionId = 0;

  async function request(path: string, method = "GET", body?: unknown, cookie?: string) {
    const response = await fetch(server.baseUrl + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: await response.json() as Record<string, unknown> };
  }

  async function createSession(email: string, role: "ADMIN" | "STUDENT") {
    await server.db.user.create({ data: { email, passwordHash: hashPassword("sync-test-password-123"), role } });
    const response = await fetch(server.baseUrl + "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "sync-test-password-123" }),
    });
    return sessionCookie(response);
  }

  beforeAll(async () => {
    server = await startTestServer(buildApp);
    adminCookie = await createSession("sync-admin@arctester.test", "ADMIN");
    studentCookie = await createSession("sync-student@arctester.test", "STUDENT");
    const student = await server.db.user.findUniqueOrThrow({
      where: { email: "sync-student@arctester.test" }, select: { id: true },
    });
    studentId = student.id;
    const subject = await server.db.subject.create({ data: { name: "Synchronization" } });
    const question = await server.db.question.create({
      data: {
        subjectId: subject.id,
        text: "Concurrent submission integration question",
        options: JSON.stringify(["One", "Two", "Three", "Four"]),
        correctIndex: 1,
        explanation: "Option two is correct.",
        source: "Sync integration test",
        difficulty: "easy",
        questionHash: "sync-concurrent-submission-question",
      },
    });
    questionId = question.id;
  });

  afterAll(async () => { await server.close(); });

  it("returns one persisted result for simultaneous submissions with the same attempt UUID", async () => {
    const created = await request("/admin/exams", "POST", {
      title: "Concurrent submission test",
      description: "",
      instructions: "",
      durationMinutes: 30,
      shuffleQuestions: false,
      shuffleOptions: false,
      questions: [{ questionId, marks: 2, negativeMarks: 0 }],
    }, adminCookie);
    expect(created.status).toBe(201);
    const examId = (created.json.exam as { id: string }).id;
    expect((await request("/admin/exams/" + examId + "/publish", "POST", {}, adminCookie)).status).toBe(200);
    const assigned = await request("/admin/exams/" + examId + "/assign", "POST", { studentIds: [studentId] }, adminCookie);
    expect(assigned.status).toBe(201);
    const assignmentId = ((assigned.json.assignments as Array<{ id: string }>)[0]).id;

    const started = await request("/exams/assignments/" + assignmentId + "/session/start", "POST", {}, studentCookie);
    expect(started.status).toBe(200);
    const session = started.json.session as { startedAt: string };
    const question = await server.db.examVersionQuestion.findFirstOrThrow({
      where: { examVersion: { examId } }, select: { id: true },
    });
    const body = {
      attemptUuid: "f02d65e8-4f6f-4bce-9b5e-70f8e2c5b04c",
      startedAt: session.startedAt,
      submittedAt: new Date().toISOString(),
      answers: [{ examQuestionId: question.id, selectedIndex: 1 }],
    };

    const [first, second] = await Promise.all([
      request("/exams/assignments/" + assignmentId + "/submission", "POST", body, studentCookie),
      request("/exams/assignments/" + assignmentId + "/submission", "POST", body, studentCookie),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    const firstSubmission = first.json.submission as { id: string; score: number };
    const secondSubmission = second.json.submission as { id: string; score: number };
    expect(firstSubmission.id).toBe(secondSubmission.id);
    expect(firstSubmission.score).toBe(2);
    expect(await server.db.examSubmission.count({ where: { assignmentId } })).toBe(1);
    const result = await request("/exams/assignments/" + assignmentId + "/result", "GET", undefined, studentCookie);
    expect(result.status).toBe(200);
    expect((result.json.result as { score: number }).score).toBe(2);
  });
});
