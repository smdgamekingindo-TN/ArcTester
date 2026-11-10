export type ExamAnswerMap = Record<string, number | null>;

export function mergeAssignedExamAnswers(
  serverAnswers: ExamAnswerMap,
  localBackup: ExamAnswerMap | null | undefined
): ExamAnswerMap {
  return { ...serverAnswers, ...(localBackup ?? {}) };
}

export function buildAssignedExamAnswerPayload(
  questionIds: string[],
  answers: ExamAnswerMap
): Array<{ examQuestionId: string; selectedIndex: number | null }> {
  return questionIds.map((examQuestionId) => ({
    examQuestionId,
    selectedIndex: answers[examQuestionId] ?? null,
  }));
}

/** Keep the original attempt identity when restoring or retrying a submission. */
export function stableExamAttemptUuid(
  existing: string | null | undefined,
  create: () => string
): string {
  return existing || create();
}
