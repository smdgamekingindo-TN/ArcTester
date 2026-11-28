import { useState } from "react";
import { request } from "./apiClient";
export type AdminManagedExam = { id: string; title: string; status: string; versions: { version: number; durationMinutes: number; publishedAt: string | null; _count: { questions: number; assignments: number } }[] };
export type AdminExamStudent = { id: number; email: string; createdAt: string };
export type AdminExamPreview = { version: number; title: string; questions: { id: string; position: number; subject: string; topic: string | null; marks: number; negativeMarks: number; text: string; options: string[]; correctIndex: number; explanation: string | null }[]; durationMinutes: number; instructions: string | null };
type AssignmentAudit = { id: string; title: string; status: string; versions: { id: string; version: number; publishedAt: string; assignments: { id: string; studentId: number; assignedAt: string; availableFrom: string | null; dueAt: string | null; status: string; student: { id: number; fullName: string | null; email: string; registrationNumber: string | null; branchName: string | null; branchCode: string | null; accessStatus: string }; submission: { status: string; submittedAt: string | null; score: number | null; maximumScore: number | null } | null; session: { status: string; startedAt: string | null; lastHeartbeatAt: string | null } | null }[] }[] };
type AdminExamManagementProps = {
  exams: AdminManagedExam[];
  students: AdminExamStudent[];
  assignmentExam: string | null;
  assignedStudents: number[];
  availableFrom: string;
  dueAt: string;
  preview: AdminExamPreview | null;
  busy: boolean;
  onNewExam: () => void;
  onPreview: (id: string) => void;
  onPublish: (id: string) => void;
  onToggleAssignment: (id: string) => void;
  onToggleStudent: (id: number, checked: boolean) => void;
  onAvailableFromChange: (value: string) => void;
  onDueAtChange: (value: string) => void;
  onCancelAssignment: () => void;
  onAssign: () => void;
  onClosePreview: () => void;
};

export default function AdminExamManagement({ exams, students, assignmentExam, assignedStudents, availableFrom, dueAt, preview, busy, onNewExam, onPreview, onPublish, onToggleAssignment, onToggleStudent, onAvailableFromChange, onDueAtChange, onCancelAssignment, onAssign, onClosePreview }: AdminExamManagementProps) {
  const [assignmentReports, setAssignmentReports] = useState<Record<string, AssignmentAudit>>({});
  const [assignmentReportErrors, setAssignmentReportErrors] = useState<Record<string, string>>({});
  const [assignmentReportLoading, setAssignmentReportLoading] = useState<string | null>(null);
  async function inspectAssignments(examId: string) {
    setAssignmentReportLoading(examId);
    setAssignmentReportErrors(current => ({ ...current, [examId]: "" }));
    try {
      const response = await request<{ exam: AssignmentAudit }>(`/admin/exams/${encodeURIComponent(examId)}/assignments`);
      setAssignmentReports(current => ({ ...current, [examId]: response.exam }));
    } catch (cause) {
      setAssignmentReportErrors(current => ({ ...current, [examId]: (cause as Error).message || "Could not load assignment status." }));
    } finally {
      setAssignmentReportLoading(null);
    }
  }

  return (
    <>
      <div className="admin-page-title"><div><p className="eyebrow">PUBLISHED PAPERS &amp; DRAFTS</p><h1>Exam management</h1><p>Review every paper version, inspect its question count, and publish when it is ready.</p></div><button className="primary" onClick={onNewExam}>＋ New mock test</button></div>
      <div className="exam-list">{exams.map((exam) => { const version = exam.versions[0]; return (
        <article className="admin-panel exam-row" key={exam.id}>
          <div><span className={exam.status === "PUBLISHED" ? "status status-used" : "status"}>{exam.status}</span><h3>{exam.title}</h3><p>{version ? `${version._count.questions} questions · ${version.durationMinutes} minutes · ${version._count.assignments} assignments` : "No version"}</p></div>
          <div className="exam-actions"><button className="ghost" onClick={() => onPreview(exam.id)}>Preview paper</button><button className="ghost" disabled={assignmentReportLoading === exam.id} onClick={() => void inspectAssignments(exam.id)}>{assignmentReportLoading === exam.id ? "Checking…" : "Check assignments"}</button>{version && !version.publishedAt ? <button className="primary" onClick={() => onPublish(exam.id)}>Publish version {version.version}</button> : <><span className="success">Published</span><button className="ghost" onClick={() => onToggleAssignment(exam.id)}>Assign students</button></>}</div>
          {assignmentReportErrors[exam.id] ? <p className="error" role="alert">{assignmentReportErrors[exam.id]}</p> : null}
          {assignmentReports[exam.id] ? <div className="assignment-audit-panel">
            <strong>Assignment verification · {assignmentReports[exam.id].versions.reduce((count, item) => count + item.assignments.length, 0)} total</strong>
            {assignmentReports[exam.id].versions.map(versionReport => <section key={versionReport.id}>
              <b>Version {versionReport.version}</b>
              {versionReport.assignments.length ? <ul>{versionReport.assignments.map(assignment => <li key={assignment.id}>
                <span>{assignment.student.fullName || assignment.student.email} · {assignment.student.email}</span>
                <small>Student ID {assignment.studentId}{assignment.student.registrationNumber ? " · Reg " + assignment.student.registrationNumber : ""}{assignment.student.branchName ? " · " + assignment.student.branchName : ""}</small>
                <small>{assignment.submission ? "Submitted · " + assignment.submission.status : assignment.session?.startedAt ? "Started · " + assignment.session.status : "Assigned · " + assignment.status}{assignment.dueAt ? " · Due " + new Date(assignment.dueAt).toLocaleString() : ""}</small>
              </li>)}</ul> : <p>No students assigned to this version.</p>}
            </section>)}
          </div> : null}
          {assignmentExam === exam.id && <div className="assignment-panel"><b>Assign this paper</b><div className="student-picker">{students.map((student) => <label key={student.id}><input type="checkbox" checked={assignedStudents.includes(student.id)} onChange={(event) => onToggleStudent(student.id, event.target.checked)} />{student.email}</label>)}</div><div className="builder-fields"><label>Available from<input type="datetime-local" value={availableFrom} onChange={(event) => onAvailableFromChange(event.target.value)} /></label><label>Due date<input type="datetime-local" value={dueAt} onChange={(event) => onDueAtChange(event.target.value)} /></label></div><div className="editor-actions"><button className="ghost" onClick={onCancelAssignment}>Cancel</button><button className="primary" disabled={!assignedStudents.length || busy} onClick={onAssign}>Assign to {assignedStudents.length} student(s)</button></div></div>}
        </article>
      ); })}{!exams.length && <div className="admin-panel empty-state">No mock tests yet. Start by building your first paper.</div>}</div>
      {preview && <div className="preview-backdrop" onClick={onClosePreview}><section className="preview-modal" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">EXAMINER REVIEW · VERSION {preview.version}</p><h2>{preview.title}</h2><p>{preview.questions.length} questions · {preview.durationMinutes} minutes · {preview.questions.reduce((sum, question) => sum + question.marks, 0)} maximum marks</p></div><button className="icon-button" onClick={onClosePreview}>×</button></header><div className="preview-instructions"><b>Instructions</b><p>{preview.instructions || "No instructions configured."}</p></div><div className="preview-questions">{preview.questions.map((question) => <article key={question.id}><div><b>Q{question.position + 1} · {question.subject}{question.topic ? " / " + question.topic : ""}</b><small>+{question.marks} / −{question.negativeMarks}</small></div><p>{question.text}</p><ol type="A">{question.options.map((option, index) => <li className={index === question.correctIndex ? "preview-correct" : ""} key={index}>{option}{index === question.correctIndex ? " ✓" : ""}</li>)}</ol>{question.explanation && <small className="muted">Explanation: {question.explanation}</small>}</article>)}</div></section></div>}
    </>
  );
}
