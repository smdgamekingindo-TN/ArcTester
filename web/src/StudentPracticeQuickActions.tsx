interface StudentPracticeQuickActionsProps {
  disabled: boolean;
  onStartMock: () => void;
  onReviewMistakes: () => void;
}

export default function StudentPracticeQuickActions({
  disabled,
  onStartMock,
  onReviewMistakes,
}: StudentPracticeQuickActionsProps) {
  return (
    <div className="practice-side-actions practice-action-rail">
      <article className="panel action-card practice-action-card">
        <span className="action-icon" aria-hidden="true">◈</span><p className="practice-action-kicker">FULL-LENGTH</p>
        <h3>ECET mock test</h3>
        <p className="muted">Take a full-length paper using the configured AP ECET test pattern.</p>
        <button className="ghost" disabled={disabled} onClick={onStartMock}>Start mock test</button>
      </article>
      <article className="panel action-card practice-action-card">
        <span className="action-icon" aria-hidden="true">↻</span><p className="practice-action-kicker">SMART REVIEW</p>
        <h3>Review mistakes</h3>
        <p className="muted">Revisit questions you have answered incorrectly.</p>
        <button className="ghost" disabled={disabled} onClick={onReviewMistakes}>Review mistakes</button>
      </article>
    </div>
  );
}
