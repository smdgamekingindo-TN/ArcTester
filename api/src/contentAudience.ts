export type ContentAudienceScope = "ALL" | "COLLEGE" | "BRANCH" | "STUDENTS";

export type ContentAudience = {
  audienceScope?: string | null;
  targetCollegeCode?: string | null;
  targetCollegeName?: string | null;
  targetBranchCode?: string | null;
  targetBranchName?: string | null;
  targetStudentIdsJson?: string | null;
};

export type AcademicAudienceProfile = {
  id?: number | null;
  collegeCode?: string | null;
  collegeName?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function matchesOneOf(profileValues: Array<string | null | undefined>, targetValues: Array<string | null | undefined>): boolean {
  const targets = targetValues.map(normalize).filter(Boolean);
  if (targets.length === 0) return false;
  return profileValues.map(normalize).filter(Boolean).some((value) => targets.includes(value));
}

function normalizeBranchCode(value: string | null | undefined): string {
  const code = (value ?? "").normalize("NFKC").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (["CM", "CME"].includes(code)) return "CME";
  if (["CS", "CSE"].includes(code)) return "CSE";
  if (["M", "ME", "MEC", "DME"].includes(code)) return "MEC";
  if (["EC", "ECE"].includes(code)) return "ECE";
  if (["EE", "EEE"].includes(code)) return "EEE";
  return code;
}

function normalizeBranchName(value: string | null | undefined): string {
  return normalize(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bdiploma in\b/g, " ")
    .replace(/\bbranch\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchesBranch(
  profile: AcademicAudienceProfile,
  audience: ContentAudience,
): boolean {
  const profileCode = normalizeBranchCode(profile.branchCode);
  const targetCode = normalizeBranchCode(audience.targetBranchCode);
  if (profileCode && targetCode && profileCode === targetCode) return true;

  const profileName = normalizeBranchName(profile.branchName);
  const targetName = normalizeBranchName(audience.targetBranchName);
  return Boolean(profileName && targetName && profileName === targetName);
}

function matchesSelectedStudent(audience: ContentAudience, profile: AcademicAudienceProfile): boolean {
  if (!Number.isSafeInteger(profile.id) || !profile.id || !audience.targetStudentIdsJson) return false;
  try {
    const parsed: unknown = JSON.parse(audience.targetStudentIdsJson);
    return Array.isArray(parsed) && parsed.some((id) => Number.isSafeInteger(id) && id === profile.id);
  } catch {
    return false;
  }
}

/**
 * Fail closed for institution/branch/student-scoped content. Missing or legacy
 * student profile fields can see only global material, never another student's content.
 */
export function isContentAudienceVisible(
  audience: ContentAudience,
  profile: AcademicAudienceProfile,
): boolean {
  const scope = audience.audienceScope ?? "ALL";
  if (scope === "ALL") return true;

  if (scope === "STUDENTS") return matchesSelectedStudent(audience, profile);

  const collegeMatches = () => matchesOneOf(
    [profile.collegeCode, profile.collegeName],
    [audience.targetCollegeCode, audience.targetCollegeName],
  );

  if (scope === "COLLEGE") return collegeMatches();
  if (scope === "BRANCH") {
    const branchMatches = matchesBranch(profile, audience);
    const hasCollegeTarget = Boolean(normalize(audience.targetCollegeCode) || normalize(audience.targetCollegeName));
    return branchMatches && (!hasCollegeTarget || collegeMatches());
  }

  // Unknown scope values are not public.
  return false;
}
