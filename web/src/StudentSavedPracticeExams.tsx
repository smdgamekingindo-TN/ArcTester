import { useCallback, useEffect, useState } from "react";
import { request } from "./apiClient";

type DraftQuestion = { subject: string; text: string; options: string[]; correctIndex: number; explanation: string };
type PracticeQuestion = { subject?: string; topic?: string; text: string; options: string[]; correctIndex: number; explanation?: string };
type PracticeSet = { id: string; title: string; description: string; durationMinutes: number; questions: PracticeQuestion[]; createdAt: string; updatedAt: string };
type PracticeRun = { correctCount: number; totalQuestions: number; answeredCount: number; percentage: number };
const emptyQuestion = (): DraftQuestion => ({ subject: "General", text: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" });

function validSet(test: PracticeSet) {
  return Array.isArray(test.questions) && test.questions.length > 0 && test.questions.every(q =>
    typeof q.text === "string" && Array.isArray(q.options) && q.options.length >= 2 &&
    Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length
  );
}

export default function StudentSavedPracticeExams() {
  const [tests, setTests] = useState<PracticeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("20");
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [active, setActive] = useState<PracticeSet | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [run, setRun] = useState<PracticeRun | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await request<{ practiceTests: PracticeSet[] }>("/student/practice-sets");
      setTests(Array.isArray(response.practiceTests) ? response.practiceTests : []);
    } catch (cause) { setError((cause as Error).message || "Could not load your practice exams."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 20_000); return () => window.clearInterval(timer); }, [refresh]);
  useEffect(() => {
    if (deadline === null || run) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, run]);

  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) =>
    setDraftQuestions(current => current.map((q, i) => i === index ? { ...q, ...patch } : q));

  async function saveExam() {
    setError("");
    const durationMinutes = Number(duration);
    if (title.trim().length < 2) { setError("Enter an exam title with at least 2 characters."); return; }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) { setError("Duration must be between 1 and 600 minutes."); return; }
    if (draftQuestions.some(q => q.text.trim().length < 2 || q.options.some(option => !option.trim()))) { setError("Every question needs text and all four answer options."); return; }
    setBusy(true);
    try {
      await request("/student/practice-sets", { method: "POST", body: JSON.stringify({
        title: title.trim(), description: description.trim(), durationMinutes,
        questions: draftQuestions.map(q => ({ subject: q.subject.trim() || "General", topic: "General", text: q.text.trim(), options: q.options.map(o => o.trim()), correctIndex: q.correctIndex, explanation: q.explanation.trim(), difficulty: "medium" })),
      }) });
      setTitle(""); setDescription(""); setDuration("20"); setDraftQuestions([emptyQuestion()]); setCreateOpen(false);
      await refresh();
    } catch (cause) { setError((cause as Error).message || "Could not save your practice exam."); }
    finally { setBusy(false); }
  }

  function start(test: PracticeSet) {
    if (!validSet(test)) { setError("This saved exam has invalid question data. Edit or regenerate it through MCP."); return; }
    setActive(test); setActiveQuestionIndex(0); setAnswers({}); setRun(null); setError("");
    const end = Date.now() + Math.max(1, test.durationMinutes) * 60_000;
    setDeadline(end); setSeconds(Math.max(1, test.durationMinutes) * 60);
  }

  const finish = useCallback(async () => {
    if (!active || busy || run) return;
    setBusy(true); setError("");
    try {
      const response = await request<{ run: PracticeRun }>(`/student/practice-sets/${encodeURIComponent(active.id)}/submit`, {
        method: "POST", body: JSON.stringify({ answers: active.questions.map((_q, i) => answers[i] ?? null) }),
      });
      setRun(response.run); setDeadline(null); await refresh();
    } catch (cause) { setError((cause as Error).message || "Could not submit your practice exam."); }
    finally { setBusy(false); }
  }, [active, busy, run, answers, refresh]);
  useEffect(() => {
    if (active && !run && deadline !== null && seconds <= 0 && !busy) void finish();
  }, [active, run, deadline, seconds, busy, finish]);

  const answered = Object.values(answers).filter(value => value !== null && value !== undefined).length;
  const currentQuestion = active ? active.questions[activeQuestionIndex] : null;
  return <section className="stack saved-practice-exams" aria-label="My practice exams">
    <header className="section-head"><div><p className="eyebrow">YOUR PRIVATE EXAM LIBRARY</p><h2>My practice exams</h2><p className="muted">Exams you create here and exams saved by your connected MCP appear in this same list.</p></div><button type="button" className="button button-secondary" onClick={() => void refresh()} disabled={loading}>Refresh</button></header>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {active ? <article className="panel stack">
      <div className="row"><div style={{ flex: 1 }}><h3>{active.title}</h3><p className="muted">{active.questions.length} questions · {active.durationMinutes} min · {deadline !== null && !run ? `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")} remaining` : "Practice review"}</p></div><button type="button" className="button button-secondary" onClick={() => { setActive(null); setRun(null); setDeadline(null); }}>Close</button></div>
      {run ? <><h3>{run.correctCount} / {run.totalQuestions} correct · {run.percentage}%</h3><p className="muted">Result saved to your practice history.</p>{active.questions.map((q, i) => <div className="panel" key={i}><strong>Q{i + 1}. {q.text}</strong><p className="muted">Your answer: {answers[i] == null ? "Unanswered" : q.options[answers[i]!]}</p><p className="muted">Correct answer: {q.options[q.correctIndex]}</p>{q.explanation ? <p className="muted">{q.explanation}</p> : null}</div>)}</> : <>
      <p className="muted">{answered} of {active.questions.length} answered</p>
      {currentQuestion ? <div className="panel stack" key={activeQuestionIndex}>
        <p className="eyebrow">QUESTION {activeQuestionIndex + 1} · {currentQuestion.subject ?? "General"}</p>
        <h3>{currentQuestion.text}</h3>
        {currentQuestion.options.map((option, j) => <label className="row" key={j} style={{ gap: 10, border: answers[activeQuestionIndex] === j ? "2px solid #2563eb" : "1px solid var(--border, #e4e8ef)", borderRadius: 12, padding: 12, backgroundColor: answers[activeQuestionIndex] === j ? "rgba(37, 99, 235, 0.08)" : "transparent", cursor: "pointer" }}><input type="radio" name={`saved-exam-${activeQuestionIndex}`} checked={answers[activeQuestionIndex] === j} onChange={() => setAnswers(current => ({ ...current, [activeQuestionIndex]: j }))} /><span>{String.fromCharCode(65 + j)}. {option}</span></label>)}
        <div className="row saved-practice-question-navigation">
          <button type="button" className="button button-secondary" disabled={activeQuestionIndex === 0} onClick={() => setActiveQuestionIndex(index => Math.max(0, index - 1))}>Previous question</button>
          <span className="muted" aria-live="polite">Question {activeQuestionIndex + 1} of {active.questions.length}</span>
          <button type="button" className="button button-secondary" disabled={activeQuestionIndex >= active.questions.length - 1} onClick={() => setActiveQuestionIndex(index => Math.min(active.questions.length - 1, index + 1))}>Next question</button>
        </div>
      </div> : null}}
      <button type="button" className="primary" disabled={busy} onClick={() => void finish()}>{busy ? "Submitting…" : "Submit practice exam"}</button>
      </>}
    </article> : <>
      <article className="panel stack">
        <div className="row"><div style={{ flex: 1 }}><h3>Create a practice exam</h3><p className="muted">Add your own questions, choose the correct answers, and save it for later.</p></div><button type="button" className="button button-secondary" onClick={() => setCreateOpen(value => !value)}>{createOpen ? "Close" : "＋ Create exam"}</button></div>
        {createOpen ? <>
          <label>Exam title<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Data Structures revision" maxLength={120} /></label>
          <label>Description (optional)<textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} maxLength={2000} /></label>
          <label>Duration in minutes<input type="number" min={1} max={600} value={duration} onChange={event => setDuration(event.target.value)} /></label>
          {draftQuestions.map((q, index) => <div className="panel stack" key={index}>
            <div className="row"><h3 style={{ flex: 1 }}>Question {index + 1}</h3>{draftQuestions.length > 1 ? <button type="button" className="button button-secondary" onClick={() => setDraftQuestions(current => current.filter((_item, i) => i !== index))}>Remove</button> : null}</div>
            <label>Subject<input value={q.subject} onChange={event => updateQuestion(index, { subject: event.target.value })} maxLength={100} /></label>
            <label>Question<textarea value={q.text} onChange={event => updateQuestion(index, { text: event.target.value })} rows={3} maxLength={5000} placeholder="Write the question" /></label>
            {q.options.map((option, optionIndex) => <div className="row" key={optionIndex}><label style={{ flex: 1 }}>Option {String.fromCharCode(65 + optionIndex)}<input value={option} onChange={event => updateQuestion(index, { options: q.options.map((old, i) => i === optionIndex ? event.target.value : old) })} maxLength={1000} /></label><label>Correct<input type="radio" name={`correct-${index}`} checked={q.correctIndex === optionIndex} onChange={() => updateQuestion(index, { correctIndex: optionIndex })} /></label></div>)}
            <label>Explanation (optional)<textarea value={q.explanation} onChange={event => updateQuestion(index, { explanation: event.target.value })} rows={2} maxLength={5000} /></label>
          </div>)}
          <div className="row"><button type="button" className="button button-secondary" disabled={draftQuestions.length >= 100} onClick={() => setDraftQuestions(current => [...current, emptyQuestion()])}>＋ Add question</button><button type="button" className="primary" disabled={busy} onClick={() => void saveExam()}>{busy ? "Saving…" : "Save exam"}</button></div>
        </> : null}
      </article>
      {loading ? <div className="panel">Loading saved exams…</div> : tests.length === 0 ? <div className="panel empty-state"><h3>No practice exams yet</h3><p>Create one above, or use your connected MCP to call <code>create_my_practice_test</code>. It will show up here after refreshing.</p></div> : <div className="stack"><p className="muted">{tests.length} saved practice exam{tests.length === 1 ? "" : "s"}</p>{tests.map(test => <article className="panel row" key={test.id}><div style={{ flex: 1 }}><h3>{test.title}</h3>{test.description ? <p className="muted">{test.description}</p> : null}<p className="muted">{Array.isArray(test.questions) ? test.questions.length : 0} questions · {test.durationMinutes} min · Updated {new Date(test.updatedAt).toLocaleDateString()}</p></div><button type="button" className="primary" disabled={busy} onClick={() => start(test)}>Start exam</button></article>)}</div>}
    </>}
  </section>;
}
