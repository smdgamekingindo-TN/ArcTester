import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/auth.js";
import { buildApp } from "../src/index.js";
import { getJson, postJson, signIn, startTestServer, type TestServer } from "./server.js";

let server: TestServer;
let adminCookie = "";
let studentCookie = "";
let adminId = 0;
let studentId = 0;
let questionId = 0;
let examId = "";

async function putJson(url: string, body: unknown, cookie: string) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

describe("question administration route contracts", () => {
  beforeAll(async () => {
    server = await startTestServer(buildApp);
    const admin = await server.db.user.create({
      data: { email: "question-admin@arctester.test", passwordHash: hashPassword("question-admin-password"), role: "ADMIN" },
    });
    const student = await server.db.user.create({
      data: { email: "question-student@arctester.test", passwordHash: hashPassword("question-student-password"), role: "STUDENT" },
    });
    adminId = admin.id;
    studentId = student.id;
    adminCookie = (await signIn(server.baseUrl, admin.email, "question-admin-password")).cookie;
    studentCookie = (await signIn(server.baseUrl, student.email, "question-student-password")).cookie;

    const subject = await server.db.subject.create({ data: { name: "Question Admin Systems" } });
    const topic = await server.db.topic.create({ data: { name: "Route Contracts", subjectId: subject.id } });
    const question = await server.db.question.create({
      data: {
        subjectId: subject.id,
        topicId: topic.id,
        text: "Which queue operation removes the front item?",
        options: JSON.stringify(["enqueue", "dequeue", "peek", "search"]),
        correctIndex: 1,
        explanation: "Dequeue removes the front item.",
        source: "Question admin route tests",
        difficulty: "easy",
        questionHash: "question-admin-route-base-unique",
      },
    });
    questionId = question.id;
  });

  afterAll(async () => {
    await server.close();
  });

  it("lists, filters and paginates the question bank with admin-only access", async () => {
    const response = await getJson(
      `${server.baseUrl}/admin/questions?q=queue&subject=Question%20Admin%20Systems&page=1&limit=10`,
      adminCookie,
    );
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ ok: true, total: 1, page: 1, limit: 10, pages: 1 });
    expect((response.json as { questions: Array<{ id: number; topic: string; correctIndex: number }> }).questions).toMatchObject([
      { id: questionId, topic: "Route Contracts", correctIndex: 1 },
    ]);

    expect((await getJson(`${server.baseUrl}/admin/questions`, studentCookie)).status).toBe(403);
  });

  it("returns the admin question catalog with topic and question counts", async () => {
    const response = await getJson(`${server.baseUrl}/admin/question-catalog`, adminCookie);
    expect(response.status).toBe(200);
    const subject = (response.json as { subjects: Array<{ name: string; count: number; topics: Array<{ name: string; _count: { questions: number } }> }> }).subjects
      .find((item) => item.name === "Question Admin Systems");
    expect(subject).toMatchObject({
      count: 1,
      topics: [{ name: "Route Contracts", _count: { questions: 1 } }],
    });
    expect((await getJson(`${server.baseUrl}/admin/question-catalog`, studentCookie)).status).toBe(403);
  });

  it("updates a question through the admin editor and persists its normalized fields", async () => {
    const response = await putJson(
      `${server.baseUrl}/admin/questions/${questionId}`,
      { text: "Which queue operation removes the front element?", difficulty: "medium" },
      adminCookie,
    );
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      ok: true,
      question: {
        id: questionId,
        text: "Which queue operation removes the front element?",
        difficulty: "medium",
      },
    });
    expect((await putJson(`${server.baseUrl}/admin/questions/${questionId}`, { text: "Student edit" }, studentCookie)).status).toBe(403);
  });

  it("returns an admin-only exam preview and exam-result listing", async () => {
    const created = await postJson(`${server.baseUrl}/admin/exams`, {
      title: "Question Admin Preview Exam",
      description: "Preview contract",
      instructions: "Choose one.",
      durationMinutes: 20,
      shuffleQuestions: false,
      shuffleOptions: false,
      questions: [{ questionId, marks: 2, negativeMarks: 0.5 }],
    }, adminCookie);
    expect(created.status).toBe(201);
    examId = (created.json as { exam: { id: string } }).exam.id;

    const preview = await getJson(`${server.baseUrl}/admin/exams/${examId}/preview`, adminCookie);
    expect(preview.status).toBe(200);
    expect(preview.json).toMatchObject({
      ok: true,
      exam: {
        id: examId,
        status: "DRAFT",
        version: 1,
        questions: [{
          text: "Which queue operation removes the front element?",
          correctIndex: 1,
          marks: 2,
          negativeMarks: 0.5,
        }],
      },
    });
    expect((await getJson(`${server.baseUrl}/admin/exams/${examId}/preview`, studentCookie)).status).toBe(403);

    const publish = await postJson(`${server.baseUrl}/admin/exams/${examId}/publish`, {}, adminCookie);
    expect(publish.status).toBe(200);
    const assigned = await postJson(`${server.baseUrl}/admin/exams/${examId}/assign`, { studentIds: [studentId] }, adminCookie);
    expect(assigned.status).toBe(201);
    const assignmentId = (assigned.json as { assignments: Array<{ id: string }> }).assignments[0].id;
    await server.db.examSubmission.create({
      data: {
        assignmentId,
        attemptUuid: randomUUID(),
        startedAt: new Date(Date.now() - 120_000),
        submittedAt: new Date(Date.now() - 60_000),
        receivedAt: new Date(),
        status: "GRADED",
        score: 2,
        maximumScore: 2,
      },
    });

    const results = await getJson(`${server.baseUrl}/admin/exam-results`, adminCookie);
    expect(results.status).toBe(200);
    expect((results.json as { results: Array<{ status: string; score: number; student: { id: number }; exam: { id: string }; version: number }> }).results)
      .toEqual(expect.arrayContaining([expect.objectContaining({
        status: "GRADED",
        score: 2,
        student: { id: studentId, email: "question-student@arctester.test" },
        exam: { id: examId, title: "Question Admin Preview Exam" },
        version: 1,
      })]));
    expect((await getJson(`${server.baseUrl}/admin/exam-results`, studentCookie)).status).toBe(403);
  });

  it("bulk-deletes only unused questions and reports questions protected by exam snapshots", async () => {
    const subject = await server.db.subject.findUniqueOrThrow({ where: { name: "Question Admin Systems" } });
    const safeQuestion = await server.db.question.create({
      data: {
        subjectId: subject.id,
        text: "Safe-to-delete question for bulk route contract",
        options: JSON.stringify(["A", "B", "C", "D"]),
        correctIndex: 0,
        source: "Question admin route tests",
        difficulty: "easy",
        questionHash: "question-admin-route-safe-delete-unique",
      },
    });
    const deleted = await postJson(`${server.baseUrl}/admin/questions/bulk-delete`, {
      ids: [safeQuestion.id, questionId],
    }, adminCookie);
    expect(deleted.status).toBe(200);
    expect(deleted.json).toMatchObject({ ok: true, deleted: 1, blocked: [questionId] });
    expect(await server.db.question.findUnique({ where: { id: safeQuestion.id } })).toBeNull();
    expect(await server.db.question.findUnique({ where: { id: questionId } })).not.toBeNull();
    expect((await postJson(`${server.baseUrl}/admin/questions/bulk-delete`, { ids: [questionId] }, studentCookie)).status).toBe(403);
  });

  it("imports JSON question rows through the admin route and rejects student access", async () => {
    const payload = [{
      subject: "Imported Route Subject",
      topic: "Imported Route Topic",
      text: "Question imported through the question admin endpoint",
      options: ["A", "B", "C", "D"],
      correctIndex: 3,
      explanation: "Route-level import regression.",
      source: "Question admin route tests",
      difficulty: "medium",
    }];
    const imported = await postJson(`${server.baseUrl}/admin/questions/import`, {
      format: "json",
      content: JSON.stringify(payload),
    }, adminCookie);
    expect(imported.status).toBe(200);
    expect(imported.json).toMatchObject({ ok: true, report: { added: 1, duplicates: 0, total: 1, invalid: [] } });
    expect((await postJson(`${server.baseUrl}/admin/questions/import`, {
      format: "json",
      content: JSON.stringify(payload),
    }, adminCookie)).json).toMatchObject({ report: { added: 0, duplicates: 1, total: 1, invalid: [] } });
    expect((await postJson(`${server.baseUrl}/admin/questions/import`, { format: "json", content: "[]" }, studentCookie)).status).toBe(403);
  });
});
