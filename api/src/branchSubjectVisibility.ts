import { isContentAudienceVisible, type AcademicAudienceProfile, type ContentAudience } from "./contentAudience.js";

type BranchTaggedQuestion = ContentAudience & { subjectId: number };

/** MPC subjects are shared across diploma branches; their question audience still applies. */
export function isCommonMpcSubject(name: string): boolean {
  const normalized = name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^(mpc|maths?|mathematics|physics|chemistry)(?:[ivx]+|[123])?$/.test(normalized);
}

/**
 * If a subject contains branch-targeted rows, consider the subject branch-owned.
 * This also hides legacy ALL-scoped rows in that same subject from other branches.
 * Content audience rules remain authoritative for every individual question.
 */
export function filterBranchSubjectQuestions<T extends BranchTaggedQuestion>(
  questions: T[],
  subjectNames: Map<number, string>,
  profile: AcademicAudienceProfile,
): T[] {
  const branchScopedSubjectIds = new Set(questions
    .filter((question) => question.audienceScope === "BRANCH" && (question.targetBranchCode || question.targetBranchName))
    .filter((question) => !isCommonMpcSubject(subjectNames.get(question.subjectId) ?? ""))
    .map((question) => question.subjectId));
  const branchVisibleSubjectIds = new Set(questions
    .filter((question) => question.audienceScope === "BRANCH" && isContentAudienceVisible(question, profile))
    .map((question) => question.subjectId));

  return questions.filter((question) => {
    const subjectName = subjectNames.get(question.subjectId) ?? "";
    const commonMpc = isCommonMpcSubject(subjectName);
    if (!commonMpc && branchScopedSubjectIds.has(question.subjectId) && !branchVisibleSubjectIds.has(question.subjectId)) return false;
    // Branch tags do not split the common MPC subjects. College/student scope
    // restrictions still apply when a branch-scoped row also has a college target.
    if (commonMpc && question.audienceScope === "BRANCH" && !question.targetCollegeCode && !question.targetCollegeName) return true;
    return isContentAudienceVisible(question, profile);
  });
}
