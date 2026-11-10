import { describe, expect, it, vi } from "vitest";
import {
  buildAssignedExamAnswerPayload,
  mergeAssignedExamAnswers,
  stableExamAttemptUuid,
} from "./assignedExamSync";

describe("assigned exam offline synchronization", () => {
  it("restores server answers after reload but lets the local backup win for the same question", () => {
    const restored = mergeAssignedExamAnswers(
      { "question-1": 0, "question-2": 2 },
      { "question-1": 3 },
    );
    expect(restored).toEqual({ "question-1": 3, "question-2": 2 });
  });

  it("retains local answers through an offline period and builds a complete reconnect save", () => {
    const localBackup = { "question-1": 1, "question-3": 0 };
    const recovered = mergeAssignedExamAnswers({ "question-1": 0, "question-2": 2 }, localBackup);
    expect(buildAssignedExamAnswerPayload(["question-1", "question-2", "question-3"], recovered)).toEqual([
      { examQuestionId: "question-1", selectedIndex: 1 },
      { examQuestionId: "question-2", selectedIndex: 2 },
      { examQuestionId: "question-3", selectedIndex: 0 },
    ]);
  });

  it("reuses the same attempt UUID for concurrent or retried submit operations", () => {
    const create = vi.fn(() => "new-attempt-id");
    expect(stableExamAttemptUuid("original-attempt-id", create)).toBe("original-attempt-id");
    expect(stableExamAttemptUuid("original-attempt-id", create)).toBe("original-attempt-id");
    expect(create).not.toHaveBeenCalled();
  });
});
