import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminWorkspace from "./AdminWorkspace";

function response(body: unknown): Response { return { ok: true, status: 200, json: async () => body } as Response; }
function renderAdmin(fetchMock: ReturnType<typeof vi.fn>, overrides: Record<string, unknown> = {}) {
  vi.stubGlobal("fetch", fetchMock);
  return render(<AdminWorkspace email="admin@example.test" theme="light" setTheme={vi.fn()} signOut={vi.fn()} invitations={[]} createInvitation={vi.fn()} inviteEmail="" setInviteEmail={vi.fn()} createdInvitation={null} revokeInvitation={vi.fn()} busy={false} {...overrides} />);
}
afterEach(() => vi.unstubAllGlobals());

describe("administrator destructive action confirmations", () => {
  it("requires confirmation before deleting selected questions", async () => {
    const question = { id: 4, subject: "Maths", topic: "Algebra", text: "What is 2 + 2?", options: ["1", "2", "3", "4"], correctIndex: 3, explanation: "", source: "", difficulty: "easy" };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/admin/questions" && init?.method === "POST") return Promise.resolve(response({ deleted: 1, blocked: [] }));
      if (url.pathname === "/admin/questions") return Promise.resolve(response({ questions: [question], total: 1, pages: 1 }));
      if (url.pathname === "/admin/question-catalog") return Promise.resolve(response({ subjects: [] }));
      if (url.pathname === "/admin/exams") return Promise.resolve(response({ exams: [] }));
      if (url.pathname === "/admin/students") return Promise.resolve(response({ students: [] }));
      if (url.pathname === "/admin/exam-results") return Promise.resolve(response({ results: [] }));
      if (url.pathname === "/admin/announcements") return Promise.resolve(response({ announcements: [] }));
      return Promise.resolve(response({}));
    });
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirmMock);
    renderAdmin(fetchMock);
    fireEvent.click(screen.getByRole("button", { name: "Question bank" }));
    expect(await screen.findByText("What is 2 + 2?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    const deleteButton = screen.getByRole("button", { name: "Delete selected (1)" });
    fireEvent.click(deleteButton);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    confirmMock.mockReturnValue(true);
    fireEvent.click(deleteButton);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  });

  it("requires confirmation before deleting an announcement", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/admin/announcements" && init?.method === "DELETE") return Promise.resolve(response({ ok: true }));
      if (url.pathname === "/admin/question-catalog") return Promise.resolve(response({ subjects: [] }));
      if (url.pathname === "/admin/questions") return Promise.resolve(response({ questions: [], total: 0 }));
      if (url.pathname === "/admin/exams") return Promise.resolve(response({ exams: [] }));
      if (url.pathname === "/admin/students") return Promise.resolve(response({ students: [] }));
      if (url.pathname === "/admin/exam-results") return Promise.resolve(response({ results: [] }));
      if (url.pathname === "/admin/announcements") return Promise.resolve(response({ announcements: [{ id: "notice-1", title: "Exam update", message: "New schedule", startsAt: "2026-11-10T08:00:00.000Z", expiresAt: null, createdAt: "2026-11-10T08:00:00.000Z", _count: { views: 0 } }] }));
      return Promise.resolve(response({}));
    });
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirmMock);
    renderAdmin(fetchMock);
    fireEvent.click(screen.getByRole("button", { name: "Announcements" }));
    expect(await screen.findByText("Exam update")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirmMock).toHaveBeenCalledWith("Delete this announcement? Students will no longer see it.");
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("/admin/announcements/notice-1") && init?.method === "DELETE")).toBe(false);
    confirmMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("/admin/announcements/notice-1") && init?.method === "DELETE")).toBe(true));
  });

  it("requires confirmation before revoking a pending invitation", () => {
    const fetchMock = vi.fn(() => Promise.resolve(response({})));
    const revokeInvitation = vi.fn();
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirmMock);
    renderAdmin(fetchMock, { invitations: [{ id: "invite-1", email: "candidate@example.test", expiresAt: "2026-11-20T10:00:00.000Z", status: "PENDING" }], revokeInvitation });
    fireEvent.click(screen.getByRole("button", { name: "Student access" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(confirmMock).toHaveBeenCalledWith("Revoke the invitation for candidate@example.test?");
    expect(revokeInvitation).not.toHaveBeenCalled();
    confirmMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(revokeInvitation).toHaveBeenCalledWith("invite-1");
  });
});
