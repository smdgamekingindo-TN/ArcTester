import { isContentAudienceVisible, type AcademicAudienceProfile, type ContentAudience } from "./contentAudience.js";

type BranchTaggedQuestion = ContentAudience & { subjectId: number };

/** MPC subjects are shared across diploma branches; their question audience still applies. */
export function isCommonMpcSubject(name: string): boolean {
  const normalized = name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
  const mathematics = /^(?:engineering)?maths?(?:ematics)?(?:i|ii|iii|[123])?$/.test(normalized);
  const physics = /^(?:engineering)?physics(?:lab)?$/.test(normalized);
  const chemistry = /^(?:engineering)?chemistry(?:lab|andenvironmentalstudies)?$/.test(normalized);
  return normalized === "mpc" || mathematics || physics || chemistry;
}

const CME_CORE_SUBJECTS = new Set([
  "computernetworks", "datastructures", "dbms", "javaprogramming",
  "operatingsystems", "programminginc", "webtechnologies",
  "computerorganization", "softwareengineering", "pythonprogramming",
  "androidprogramming", "bigdatacloudcomputing", "internetofthings",
]);

function isCmeBranch(profile: AcademicAudienceProfile): boolean {
  const code = (profile.branchCode ?? "").normalize("NFKC").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = (profile.branchName ?? "").normalize("NFKC").trim().toLowerCase();
  return ["CM", "CME", "CSE", "CS"].includes(code) || /computer engineering|computer science/.test(name);
}

function isKnownCmeCoreSubject(name: string): boolean {
  const normalized = name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
  return CME_CORE_SUBJECTS.has(normalized);
}

const MEC_CORE_SUBJECTS = new Set([
  "engineeringmechanics", "basicmanufacturingprocesses", "engineeringdrawing",
  "basicworkshoppractices", "engineeringmaterials", "strengthofmaterials",
  "thermalengineering", "thermalengineeringi", "thermalengineeringii",
  "productiontechnology", "productiontechnologyi", "productiontechnologyii",
  "machinedrawing", "hydraulicsfluidpowersystems", "heatpowerengineering",
  "heatpowerengineeringi", "heatpowerengineeringii", "designofmachinemembers",
  "theoryofmachines", "refrigerationandairconditioning",
  "industrialengineeringandestimationcosting", "computeraidedmanufacturingsystems",
  "energysourcesandpowerplantengineering", "appliedelectricalelectronics",
  "manufacturingtechnology", "engineeringthermodynamics",
]);

function isMecBranch(profile: AcademicAudienceProfile): boolean {
  const code = (profile.branchCode ?? "").normalize("NFKC").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = (profile.branchName ?? "").normalize("NFKC").trim().toLowerCase();
  return ["M", "MEC", "ME", "DME"].includes(code) || /mechanical engineering/.test(name);
}

function isKnownMecCoreSubject(name: string): boolean {
  const normalized = name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
  return MEC_CORE_SUBJECTS.has(normalized);
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
    // The current live catalog's CME core subjects were imported as ALL. Keep
    // those known subjects limited to Computer Engineering even before their
    // older question rows are backfilled with BRANCH audience tags.
    if (!commonMpc && isKnownCmeCoreSubject(subjectName) && !isCmeBranch(profile)) return false;
    if (!commonMpc && isKnownMecCoreSubject(subjectName) && !isMecBranch(profile)) return false;
    if (!commonMpc && branchScopedSubjectIds.has(question.subjectId) && !branchVisibleSubjectIds.has(question.subjectId)) return false;
    // Branch tags do not split the common MPC subjects. College/student scope
    // restrictions still apply when a branch-scoped row also has a college target.
    if (commonMpc && question.audienceScope === "BRANCH" && !question.targetCollegeCode && !question.targetCollegeName) return true;
    return isContentAudienceVisible(question, profile);
  });
}
