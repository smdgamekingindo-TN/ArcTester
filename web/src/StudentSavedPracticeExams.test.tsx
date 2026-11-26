import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./apiClient";
import StudentSavedPracticeExams from "./StudentSavedPracticeExams";

vi.mock("./apiClient", () => ({ request: vi.fn() }));

const practiceTests = [{
  id: "practice-1",
  title: "Algebra revision",
  description: "Two sample questions",
  durationMinutes: 20,
  questions: [
    { subject: "Mathematics", topic: "Algebra", text: "Question one?", options: ["A1", "A2", "A3", "A4"], correctIndex: 1 },
    { subject: "Physics", topic: "Motion", text: "Question two?", options: ["B1", "B2", "B3", "B4"], correctIndex: 2 },
  ],
  createdAt: "2026-11-27T00:00:00.000Z",
  updatedAt: "2026-11-27T00:00:00.000Z",
}];

describe("StudentSavedPracticeExams", () => {
  beforeEach(() => {
    vi.mocked(request).mockResolvedValue({ practiceTests } as never);
  });

  it("shows only the current question and navigates one question at a time", async () => {
    render(<StudentSavedPracticeExams />);
    fireEvent.click(await screen.findByRole("button", { name: "Start exam" }));

    expect(screen.getByRole("heading", { name: "Question one?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Question two?" })).toBeNull();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.queryByRole("heading", { name: "Question one?" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Question two?" })).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByRole("heading", { name: "Question one?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Question two?" })).toBeNull();
  });

  it("keeps answers attached to their question while navigating", async () => {
    render(<StudentSavedPracticeExams />);
    fireEvent.click(await screen.findByRole("button", { name: "Start exam" }));
    fireEvent.click(screen.getByRole("radio", { name: "B. A2" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.click(screen.getByRole("radio", { name: "C. B3" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByRole("radio", { name: "B. A2" })).toBeChecked();
  });
});
