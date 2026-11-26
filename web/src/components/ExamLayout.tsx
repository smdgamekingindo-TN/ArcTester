import type { ReactNode } from "react";

type ExamLayoutProps = {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  headerActions?: ReactNode;
  status?: ReactNode;
  currentIndex: number;
  questionCount: number;
  answeredCount: number;
  previousLabel?: string;
  nextLabel?: string;
  submitLabel: string;
  submitDisabled?: boolean;
  busy?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

/** Shared, non-floating exam shell for assigned, generated and saved practice exams. */
export default function ExamLayout({
  title, eyebrow = "EXAM SESSION", meta, headerActions, status,
  currentIndex, questionCount, answeredCount,
  previousLabel = "Previous", nextLabel = "Next question",
  submitLabel, submitDisabled = false, busy = false,
  onPrevious, onNext, onSubmit, children,
}: ExamLayoutProps) {
  const safeCount = Math.max(0, questionCount);
  const safeAnswered = Math.min(safeCount, Math.max(0, answeredCount));
  const safeIndex = safeCount ? Math.min(safeCount - 1, Math.max(0, currentIndex)) : 0;
  return <section className="exam-layout">
    <header className="exam-layout-header">
      <div className="exam-layout-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {meta ? <p className="muted exam-layout-meta">{meta}</p> : null}
      </div>
      {headerActions ? <div className="exam-layout-header-actions">{headerActions}</div> : null}
    </header>
    {status ? <div className="exam-layout-status">{status}</div> : null}
    <div className="exam-layout-progress">
      <div className="exam-layout-progress-copy">
        <strong>Question {safeCount ? safeIndex + 1 : 0} of {safeCount}</strong>
        <span>{safeAnswered} answered · {Math.max(0, safeCount - safeAnswered)} remaining</span>
      </div>
      <div className="exam-progress-track" role="progressbar" aria-label="Answered questions" aria-valuemin={0} aria-valuemax={safeCount} aria-valuenow={safeAnswered}>
        <span style={{ width: (safeCount ? safeAnswered / safeCount * 100 : 0) + "%" }} />
      </div>
    </div>
    <div className="exam-layout-question">{children}</div>
    <footer className="exam-layout-footer">
      <button type="button" className="button button-secondary exam-layout-nav" disabled={safeIndex === 0 || busy} onClick={onPrevious}>{previousLabel}</button>
      <span className="exam-layout-index" aria-live="polite">{safeCount ? safeIndex + 1 : 0} / {safeCount}</span>
      <button type="button" className="button button-secondary exam-layout-nav" disabled={safeIndex >= safeCount - 1 || busy} onClick={onNext}>{nextLabel}</button>
      <button type="button" className="primary exam-layout-submit" disabled={submitDisabled || busy || safeCount === 0} onClick={onSubmit}>{busy ? "Submitting…" : submitLabel}</button>
    </footer>
  </section>;
}
