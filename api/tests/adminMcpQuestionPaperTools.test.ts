import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/index.js";
import { startTestServer, type TestServer } from "./server.js";

let server: TestServer;
let bearer = "";
let adminId = 0;
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function callTool(name: string, args: Record<string, unknown>) {
  const response = await fetch(server.baseUrl + "/mcp/admin", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + bearer },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = await response.json() as { result?: { content?: Array<{ text?: string }>; isError?: boolean }; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error("MCP request failed (" + response.status + "): " + JSON.stringify(body));
  const text = body.result?.content?.[0]?.text ?? "";
  if (body.result?.isError) throw new Error(text);
  return JSON.parse(text) as Record<string, any>;
}

describe("administrator MCP question and exam paper intelligence", () => {
  beforeAll(async () => {
    server = await startTestServer(buildApp);
    const admin = await server.db.user.create({ data: { email: "admin-question-paper-tools@arctester.test", passwordHash: "test-only", role: "ADMIN" } });
    adminId = admin.id;
    bearer = "arc_admin_" + randomBytes(32).toString("base64url");
    await server.db.adminMcpKey.create({ data: {
      userId: admin.id, name: "question-paper-tools-test", keyHash: digest(bearer),
      scopes: ["questions:read", "questions:review", "papers:read"],
    } });
  });
  afterAll(async () => { await server.close(); });

  it("lists and executes question bank and paper inspection tools with useful quality findings", async () => {
    const subject = await server.db.subject.create({ data: { name: "MCP Quality Tool Fixture" } });
    const topic = await server.db.topic.create({ data: { subjectId: subject.id, name: "Exam Paper Audit" } });
    const firstText = "Which networking protocol reliably delivers ordered data between applications?";
    const questions = await Promise.all([0, 1].map((n) => server.db.question.create({ data: {
      subjectId: subject.id, topicId: topic.id, text: firstText + (n ? " " : ""),
      questionType: "mcq", promptData: "{}", answerData: "{}", options: JSON.stringify(["TCP", "UDP", "IP", "ARP"]),
      correctIndex: 0, explanation: n ? "" : "TCP provides reliable, ordered delivery.",
      source: n ? "" : "Computer Networks syllabus, transport layer", difficulty: n ? "medium" : "easy",
      reviewStatus: "APPROVED", audienceScope: "ALL", targetStudentIdsJson: "[]",
      questionHash: digest("mcp-question-paper-fixture-" + n),
    } })));
    const student = await server.db.user.create({ data: { email: "paper-tool-student@arctester.test", passwordHash: "test-only", role: "STUDENT", accessStatus: "APPROVED" } });
    const exam = await server.db.exam.create({ data: { title: "MCP Paper Audit Fixture", description: "Test paper", createdById: adminId, status: "PUBLISHED" } });
    const version = await server.db.examVersion.create({ data: { examId: exam.id, version: 1, durationMinutes: 2, instructions: "Answer all questions.", sebKeys: [], publishedAt: new Date() } });
    const snapshots = await Promise.all(questions.map((q, position) => server.db.examVersionQuestion.create({ data: {
      examVersionId: version.id, sourceQuestionId: q.id, position, subject: subject.name, topic: topic.name,
      text: q.text, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation, marks: 2, negativeMarks: 0.5,
    } })));
    await server.db.examAssignment.create({ data: { examVersionId: version.id, studentId: student.id, assignedById: adminId } });

    const listed = await fetch(server.baseUrl + "/mcp/admin", {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + bearer },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }).then(r => r.json()) as { result?: { tools?: Array<{ name: string }> } };
    const names = listed.result?.tools?.map(t => t.name) ?? [];
    expect(names).toEqual(expect.arrayContaining(["get_question_details", "analyze_question_bank_quality", "get_question_paper_details", "analyze_question_paper", "edit_question", "delete_questions", "restore_questions", "permanently_delete_questions"]));

    const detail = await callTool("get_question_details", { ids: [questions[0].id, 99999999] });
    expect(detail.questions[0]).toMatchObject({ id: questions[0].id, subject: subject.name, correctIndex: 0, source: "Computer Networks syllabus, transport layer" });
    expect(detail.questions[1]).toMatchObject({ id: 99999999, missing: true });

    const edited = await callTool("edit_question", { id: questions[0].id, patch: { explanation: "Revised: TCP provides reliable, ordered delivery." } });
    expect(edited.question).toMatchObject({ id: questions[0].id, reviewStatus: "APPROVED" });
    await callTool("delete_questions", { ids: [questions[0].id], confirm: true });
    const trash = await callTool("search_question_bank", { reviewStatus: "DELETED", limit: 10 });
    expect(trash.questions).toEqual(expect.arrayContaining([expect.objectContaining({ id: questions[0].id, reviewStatus: "DELETED" })]));
    const restored = await callTool("restore_questions", { ids: [questions[0].id], reviewStatus: "APPROVED", confirm: true });
    expect(restored).toMatchObject({ restored: 1, reviewStatus: "APPROVED" });

    const disposable = await server.db.question.create({ data: {
      subjectId: subject.id, topicId: topic.id, text: "Which protocol resolves a domain name into an IP address?",
      questionType: "mcq", promptData: "{}", answerData: "{}", options: JSON.stringify(["DNS", "DHCP", "ARP", "SMTP"]),
      correctIndex: 0, explanation: "DNS maps names to IP addresses.", source: "Computer Networks reference",
      difficulty: "easy", reviewStatus: "DRAFT", audienceScope: "ALL", targetStudentIdsJson: "[]",
      questionHash: digest("mcp-permanent-delete-fixture"),
    } });
    await callTool("delete_questions", { ids: [disposable.id], confirm: true });
    const permanentlyDeleted = await callTool("permanently_delete_questions", { ids: [disposable.id], confirm: true });
    expect(permanentlyDeleted).toMatchObject({ permanentlyDeleted: 1 });
    expect(await server.db.question.findUnique({ where: { id: disposable.id }, select: { id: true } })).toBeNull();

    const bankQuality = await callTool("analyze_question_bank_quality", { subject: subject.name, limit: 20 });
    expect(bankQuality).toMatchObject({ scanned: 2, metrics: { missingSource: 1, missingExplanation: 1, duplicateGroups: 1 } });

    const paper = await callTool("get_question_paper_details", { examId: exam.id, version: 1 });
    expect(paper.exam.versions[0]).toMatchObject({ questionCount: 2, assignmentCount: 1, assignmentStatuses: { ASSIGNED: 1 } });
    expect(paper.exam.versions[0].questions).toEqual(expect.arrayContaining([expect.objectContaining({ id: snapshots[0].id, correctIndex: 0 })]));

    const audit = await callTool("analyze_question_paper", { examId: exam.id, version: 1 });
    expect(audit).toMatchObject({ version: { number: 1, questionCount: 2 }, quality: { totalMarks: 4, totalNegativeMarks: 1, missingExplanation: 1, duplicatePromptGroups: 1, durationMayBeTight: true }, delivery: { assignments: 1, assignmentStatuses: { ASSIGNED: 1 } } });

    await server.db.exam.delete({ where: { id: exam.id } });
    await server.db.user.delete({ where: { id: student.id } });
    await server.db.question.deleteMany({ where: { id: { in: questions.map(q => q.id) } } });
    await server.db.topic.delete({ where: { id: topic.id } });
    await server.db.subject.delete({ where: { id: subject.id } });
  });
});
