import type { ReactNode } from "react";

export type ExamQuestionNavigationProps = {
  questionCount: number;
  currentIndex: number;
  answered: boolean[];
  marked?: boolean[];
  onSelect: (index: number) => void;
  heading?: ReactNode;
};

/** Compact, reusable question palette shared by assigned and saved practice exams. */
export default function ExamQuestionNavigation({ questionCount, currentIndex, answered, marked = [], onSelect, heading = "Question paper" }: ExamQuestionNavigationProps) {
  const count = Math.max(0, questionCount);
  const answeredCount = answered.slice(0, count).filter(Boolean).length;
  return <div className="exam-question-navigation" aria-label="Question paper navigation">
    <div className="exam-question-navigation-heading"><strong>{heading}</strong><span className="muted">{answeredCount}/{count}</span></div>
    <div className="exam-question-navigation-grid">
      {Array.from({ length: count }, (_, index) => {
        const isAnswered = Boolean(answered[index]);
        const isMarked = Boolean(marked[index]);
        const isCurrent = index === currentIndex;
        return <button key={index} type="button" className={`exam-question-number${isCurrent ? " is-current" : ""}${isAnswered ? " is-answered" : ""}${isMarked ? " is-marked" : ""}`} aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ", unanswered"}${isMarked ? ", marked for review" : ""}`} aria-current={isCurrent ? "step" : undefined} onClick={() => onSelect(index)}>{index + 1}{isMarked ? " ★" : ""}</button>;
      })}
    </div>
    <p className="muted exam-question-navigation-legend">Current · Answered · Marked for review</p>
  </div>;
}
