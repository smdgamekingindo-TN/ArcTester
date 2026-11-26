import { useCallback, useEffect, useState } from "react";
import { request } from "./apiClient";

type DraftQuestion = { subject: string; text: string; options: string[]; correctIndex: number; explanation: string };
type PracticeQuestion = { subject?: string; topic?: string; text: string; options: string[]; correctIndex: number; explanation?: string };
type PracticeSet = { id: string; title: string; description: string; durationMinutes: number; questions: PracticeQuestion[]; createdAt: string; updatedAt: string };
type PracticeRun = { correctCount: number; totalQuestions: number; answeredCount: number; percentage: number };
const emptyQuestion = (): DraftQuestion => ({ subject: "General", text: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" });
const blue = "#2563eb";

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
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
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
  useEffect(() => {
    if (active) return;
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [active, refresh]);
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

  function closeExam() {
    setActive(null); setRun(null); setDeadline(null); setQuestionIndex(0);
    if (window.history.state?.arcTesterPracticeExam) window.history.back();
  }
  function start(test: PracticeSet) {
    if (!validSet(test)) { setError("This saved exam has invalid question data. Edit or regenerate it through MCP."); return; }
    setActive(test); setAnswers({}); setMarked({}); setQuestionIndex(0); setRun(null); setError("");
    const end = Date.now() + Math.max(1, test.durationMinutes) * 60_000;
    setDeadline(end); setSeconds(Math.max(1, test.durationMinutes) * 60);
    window.history.pushState({ arcTesterPracticeExam: true }, "", `#practice-exam-${encodeURIComponent(test.id)}`);
  }

  useEffect(() => {
    if (!active) return;
    const onPopState = () => { setActive(null); setRun(null); setDeadline(null); setQuestionIndex(0); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [active]);

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
  const current = active?.questions[questionIndex];
  const isAnswered = current ? answers[questionIndex] !== null && answers[questionIndex] !== undefined : false;
  const timeText = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const panelStyle = { background: "var(--panel, var(--surface, #fff))", border: "1px solid var(--border, #e4e8ef)", borderRadius: 16, padding: 20, boxSizing: "border-box" as const };
  const mutedStyle = { color: "var(--muted, #748096)", margin: 0, lineHeight: 1.55 };
  const actionStyle = { border: "1px solid var(--border, #dbe2ec)", borderRadius: 10, padding: "10px 15px", minHeight: 42, fontWeight: 750, cursor: "pointer", background: "var(--panel, #fff)", color: "var(--text, #172033)" };
  const primaryStyle = { ...actionStyle, borderColor: blue, background: blue, color: "#fff" };

  return <section className="stack saved-practice-exams" aria-label="My practice exams">
    {active ? <main className="saved-exam-take-page" role="main" aria-label="Practice exam" style={{ position: "fixed", inset: 0, zIndex: 1000, overflowY: "auto", background: "var(--background, var(--bg, #f4f7fb))", color: "var(--text, #172033)", padding: "max(14px, env(safe-area-inset-top)) 14px max(20px, env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 1080, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ ...panelStyle, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 20px" }}>
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <p style={{ ...mutedStyle, fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Practice exam</p>
            <h1 style={{ margin: "5px 0", fontSize: "clamp(20px, 3vw, 28px)", lineHeight: 1.25 }}>{active.title}</h1>
            <p style={mutedStyle}>{active.questions.length} questions · {active.durationMinutes} minutes · {answered} answered</p>
          </div>
          {!run ? <div aria-live="polite" style={{ border: `1px solid ${seconds <= 60 ? "#dc2626" : "var(--border, #dbe2ec)"}`, borderRadius: 12, padding: "9px 14px", minWidth: 112, textAlign: "center", background: seconds <= 60 ? "rgba(220,38,38,.08)" : "transparent" }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: seconds <= 60 ? "#dc2626" : "var(--muted, #748096)" }}>TIME LEFT</span>
            <strong style={{ fontSize: 23, fontVariantNumeric: "tabular-nums", color: seconds <= 60 ? "#dc2626" : "inherit" }}>{timeText}</strong>
          </div> : null}
          <button type="button" style={actionStyle} onClick={closeExam}>Exit exam</button>
        </header>

        {error ? <p className="error" role="alert">{error}</p> : null}
        {run ? <section style={{ ...panelStyle, display: "grid", gap: 16 }}>
          <div><p style={{ ...mutedStyle, fontWeight: 800 }}>RESULT</p><h2 style={{ margin: "5px 0" }}>{run.correctCount} / {run.totalQuestions} correct · {run.percentage}%</h2><p style={mutedStyle}>Your result has been saved to practice history.</p></div>
          {active.questions.map((q, i) => { const selected = answers[i]; return <article key={i} style={{ border: "1px solid var(--border, #e4e8ef)", borderRadius: 12, padding: 16, display: "grid", gap: 10 }}><strong>Q{i + 1}. {q.text}</strong><p style={mutedStyle}>Your answer: {selected == null ? "Unanswered" : q.options[selected]}</p><p style={mutedStyle}>Correct answer: {q.options[q.correctIndex]}</p>{q.explanation ? <p style={mutedStyle}>{q.explanation}</p> : null}</article>})}
          <button type="button" style={primaryStyle} onClick={closeExam}>Back to practice exams</button>
        </section> : <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
          <section style={{ ...panelStyle, display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><p style={{ ...mutedStyle, fontWeight: 800, fontSize: 12 }}>QUESTION {questionIndex + 1} OF {active.questions.length}</p><p style={{ ...mutedStyle, fontSize: 13 }}>{current?.subject ?? "General"}</p></div>
              <button type="button" style={{ ...actionStyle, borderColor: marked[questionIndex] ? "#d97706" : "var(--border, #dbe2ec)", color: marked[questionIndex] ? "#d97706" : "inherit" }} onClick={() => setMarked(value => ({ ...value, [questionIndex]: !value[questionIndex] }))}>{marked[questionIndex] ? "★ Marked for review" : "☆ Mark for review"}</button>
            </div>
            <div style={{ width: "100%", height: 7, borderRadius: 99, background: "var(--border, #e4e8ef)", overflow: "hidden" }}><div style={{ width: `${((questionIndex + 1) / active.questions.length) * 100}%`, height: "100%", background: blue, borderRadius: 99 }} /></div>
            <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", lineHeight: 1.5, margin: 0, overflowWrap: "anywhere" }}>{current?.text}</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {current?.options.map((option, j) => { const selected = answers[questionIndex] === j; return <button key={j} type="button" aria-pressed={selected} onClick={() => setAnswers(value => ({ ...value, [questionIndex]: j }))} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 14, textAlign: "left", border: `${selected ? 2 : 1}px solid ${selected ? blue : "var(--border, #dbe2ec)"}`, borderRadius: 13, padding: "15px 17px", background: selected ? "rgba(37,99,235,.09)" : "var(--panel, #fff)", color: "var(--text, #172033)", cursor: "pointer", boxSizing: "border-box", lineHeight: 1.55 }}>
                <span style={{ flex: "0 0 30px", width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, border: `1px solid ${selected ? blue : "var(--border, #dbe2ec)"}`, background: selected ? blue : "transparent", color: selected ? "#fff" : "var(--text, #172033)", fontWeight: 850 }}>{String.fromCharCode(65 + j)}</span>
                <span style={{ flex: 1, paddingTop: 3, overflowWrap: "anywhere" }}>{option}</span><span aria-hidden="true" style={{ color: blue, fontWeight: 900 }}>{selected ? "✓" : ""}</span>
              </button>})}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", borderTop: "1px solid var(--border, #e4e8ef)", paddingTop: 16 }}>
              <button type="button" style={actionStyle} disabled={questionIndex === 0} onClick={() => setQuestionIndex(i => Math.max(0, i - 1))}>← Previous</button>
              {questionIndex < active.questions.length - 1 ? <button type="button" style={primaryStyle} onClick={() => setQuestionIndex(i => Math.min(active.questions.length - 1, i + 1))}>{isAnswered ? "Save & next →" : "Next question →"}</button> : <button type="button" style={primaryStyle} disabled={busy} onClick={() => void finish()}>{busy ? "Submitting…" : "Submit exam"}</button>}
            </div>
          </section>
          <aside style={{ ...panelStyle, display: "grid", gap: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><h2 style={{ margin: 0, fontSize: 17 }}>Question paper</h2><span style={mutedStyle}>{answered}/{active.questions.length}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(42px, 1fr))", gap: 9 }}>
              {active.questions.map((_q, i) => { const done = answers[i] !== null && answers[i] !== undefined; const review = !!marked[i]; const currentQuestion = questionIndex === i; return <button key={i} type="button" aria-label={`Question ${i + 1}${done ? ", answered" : ", unanswered"}${review ? ", marked for review" : ""}`} aria-current={currentQuestion ? "step" : undefined} onClick={() => setQuestionIndex(i)} style={{ minWidth: 0, minHeight: 42, border: `2px solid ${currentQuestion ? blue : review ? "#d97706" : done ? "#16a34a" : "var(--border, #dbe2ec)"}`, borderRadius: 10, background: currentQuestion ? "rgba(37,99,235,.12)" : done ? "rgba(22,163,74,.09)" : "var(--panel, #fff)", color: "var(--text, #172033)", fontWeight: 850, cursor: "pointer", position: "relative" }}>{i + 1}{review ? <span aria-hidden="true" style={{ position: "absolute", top: -6, right: -4, color: "#d97706", fontSize: 13 }}>★</span> : null}</button>})}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--muted, #748096)" }}>
              <span>🟦 Current</span><span>🟩 Answered</span><span>⬜ Unanswered</span><span>★ Review</span>
            </div>
            <button type="button" style={{ ...primaryStyle, width: "100%" }} disabled={busy} onClick={() => void finish()}>{busy ? "Submitting…" : `Submit exam · ${answered}/${active.questions.length}`}</button>
          </aside>
        </div>}
      </div>
    </main> : <>
      <header className="section-head"><div><p className="eyebrow">YOUR PRIVATE EXAM LIBRARY</p><h2>My practice exams</h2><p className="muted">Exams you create here and exams saved by your connected MCP appear in this same list.</p></div><button type="button" className="button button-secondary" onClick={() => void refresh()} disabled={loading}>Refresh</button></header>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <article className="panel stack" style={{ padding: 20, gap: 16 }}>
        <div className="row"><div style={{ flex: 1, minWidth: 0 }}><h3>Create a practice exam</h3><p className="muted">Add your own questions, choose the correct answers, and save it for later.</p></div><button type="button" className="button button-secondary" onClick={() => setCreateOpen(value => !value)}>{createOpen ? "Close" : "＋ Create exam"}</button></div>
        {createOpen ? <>
          <label>Exam title<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Data Structures revision" maxLength={120} /></label>
          <label>Description (optional)<textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} maxLength={2000} /></label>
          <label>Duration in minutes<input type="number" min={1} max={600} value={duration} onChange={event => setDuration(event.target.value)} /></label>
          {draftQuestions.map((q, index) => <div className="panel stack" style={{ padding: 18, gap: 14 }} key={index}>
            <div className="row"><h3 style={{ flex: 1 }}>Question {index + 1}</h3>{draftQuestions.length > 1 ? <button type="button" className="button button-secondary" onClick={() => setDraftQuestions(current => current.filter((_item, i) => i !== index))}>Remove</button> : null}</div>
            <label>Subject<input value={q.subject} onChange={event => updateQuestion(index, { subject: event.target.value })} maxLength={100} /></label>
            <label>Question<textarea value={q.text} onChange={event => updateQuestion(index, { text: event.target.value })} rows={3} maxLength={5000} placeholder="Write the question" /></label>
            {q.options.map((option, optionIndex) => <div className="row" key={optionIndex}><label style={{ flex: 1, minWidth: 0 }}>Option {String.fromCharCode(65 + optionIndex)}<input value={option} onChange={event => updateQuestion(index, { options: q.options.map((old, i) => i === optionIndex ? event.target.value : old) })} maxLength={1000} /></label><label>Correct<input type="radio" name={`correct-${index}`} checked={q.correctIndex === optionIndex} onChange={() => updateQuestion(index, { correctIndex: optionIndex })} /></label></div>)}
            <label>Explanation (optional)<textarea value={q.explanation} onChange={event => updateQuestion(index, { explanation: event.target.value })} rows={2} maxLength={5000} /></label>
          </div>)}
          <div className="row"><button type="button" className="button button-secondary" disabled={draftQuestions.length >= 100} onClick={() => setDraftQuestions(current => [...current, emptyQuestion()])}>＋ Add question</button><button type="button" className="primary" disabled={busy} onClick={() => void saveExam()}>{busy ? "Saving…" : "Save exam"}</button></div>
        </> : null}
      </article>
      {loading ? <div className="panel" style={{ padding: 20 }}>Loading saved exams…</div> : tests.length === 0 ? <div className="panel empty-state" style={{ padding: 20 }}><h3>No practice exams yet</h3><p>Create one above, or use your connected MCP to call <code>create_my_practice_test</code>. It will show up here after refreshing.</p></div> : <div className="stack"><p className="muted">{tests.length} saved practice exam{tests.length === 1 ? "" : "s"}</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>{tests.map(test => <article className="panel stack" style={{ padding: 20, gap: 14, minWidth: 0 }} key={test.id}><div style={{ display: "grid", gap: 8 }}><h3 style={{ margin: 0, overflowWrap: "anywhere" }}>{test.title}</h3>{test.description ? <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>{test.description}</p> : null}<p className="muted" style={{ margin: 0 }}>{Array.isArray(test.questions) ? test.questions.length : 0} questions · {test.durationMinutes} min</p><p className="muted" style={{ margin: 0, fontSize: 12 }}>Updated {new Date(test.updatedAt).toLocaleDateString()}</p></div><button type="button" className="primary" style={{ width: "100%" }} disabled={busy} onClick={() => start(test)}>Open exam →</button></article>)}</div></div>}
    </>}
  </section>;
}
