import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type PracticeQuestion = { subject?: string; topic?: string; text: string; options: string[]; correctIndex: number; explanation?: string };
type PracticeSet = { id: string; title: string; description: string; durationMinutes: number; questions: PracticeQuestion[]; updatedAt: string };
type PracticeRun = { correctCount: number; totalQuestions: number; answeredCount: number; percentage: number };
type Props = { api: Api; darkMode: boolean; disabled?: boolean };
const blue = "#2563eb";

export default function StudentAiPracticeTests({ api, darkMode, disabled = false }: Props) {
  const [tests, setTests] = useState<PracticeSet[]>([]);
  const [active, setActive] = useState<PracticeSet | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [run, setRun] = useState<PracticeRun | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const autoFinishTriggered = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const colors = darkMode
    ? { card: "#172235", border: "#334155", text: "#f1f5f9", muted: "#a7b4c8", surface: "#1e293b" }
    : { card: "#fff", border: "#e4e8ef", text: "#172033", muted: "#748096", surface: "#f8fafc" };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api<{ practiceTests: PracticeSet[] }>("/student/practice-sets");
      setTests(Array.isArray(response.practiceTests) ? response.practiceTests : []);
    } catch (cause) {
      setError((cause as Error).message || "Could not load your saved practice exams.");
    } finally { setLoading(false); }
  }, [api]);
  useEffect(() => { void refresh(); }, [refresh]);
  // MCP-created practice tests are shared with the student library; refresh while the exam center is open.
  useEffect(() => { const timer = setInterval(() => void refresh(), 20_000); return () => clearInterval(timer); }, [refresh]);

  const current = active?.questions[index];
  useEffect(() => { if (deadline === null || run) return; const tick = () => setSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [deadline, run]);
  const answered = useMemo(() => Object.values(answers).filter(value => value !== null && value !== undefined).length, [answers]);

  const start = (test: PracticeSet) => {
    if (disabled) return;
    if (!Array.isArray(test.questions) || !test.questions.length || test.questions.some(q => !Array.isArray(q.options) || q.options.length < 2 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length)) {
      setError("This saved test has invalid question data. Ask Claude to edit or regenerate it.");
      return;
    }
    setActive(test); setIndex(0); setAnswers({}); setRun(null); setError(""); autoFinishTriggered.current = false; const nextDeadline = Date.now() + Math.max(1, test.durationMinutes) * 60_000; setDeadline(nextDeadline); setSecondsRemaining(Math.max(1, test.durationMinutes) * 60);
  };

  const finish = async () => {
    if (!active || busy || run) return;
    setBusy(true); setError("");
    try {
      const response = await api<{ run: PracticeRun }>(`/student/practice-sets/${encodeURIComponent(active.id)}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: active.questions.map((_q, i) => answers[i] ?? null) }),
      });
      setRun(response.run);
      setDeadline(null);
      if (autoFinishTriggered.current) Alert.alert("Time is up", "Your practice test was submitted automatically.");
      await refresh();
    } catch (cause) { setError((cause as Error).message || "Could not save your practice result."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!active || run || deadline === null || secondsRemaining > 0 || busy || autoFinishTriggered.current) return;
    autoFinishTriggered.current = true;
    void finish();
  }, [active, run, deadline, secondsRemaining, busy, answers, finish]);

  if (active) {
    return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.text }]}>{active.title}</Text><Text style={[styles.muted, { color: colors.muted }]}>{active.questions.length} questions · {active.durationMinutes} min · AI practice · {Math.floor(secondsRemaining / 60).toString().padStart(2, "0")}:{(secondsRemaining % 60).toString().padStart(2, "0")} left</Text></View><TouchableOpacity onPress={() => { setActive(null); setRun(null); setAnswers({}); setIndex(0); }}><Text style={{ color: blue, fontWeight: "800" }}>Close</Text></TouchableOpacity></View>
      {run ? <>
        <Text style={[styles.result, { color: colors.text }]}>{run.correctCount} / {run.totalQuestions} correct · {run.percentage}%</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>Result saved to your private practice history.</Text>
        {active.questions.map((q, i) => <View key={i} style={[styles.questionReview, { borderColor: colors.border }]}><Text style={[styles.question, { color: colors.text }]}>Q{i + 1}. {q.text}</Text><Text style={[styles.muted, { color: colors.muted }]}>Your answer: {answers[i] == null ? "Unanswered" : q.options[answers[i]!]}</Text><Text style={[styles.muted, { color: colors.muted }]}>Correct answer: {q.options[q.correctIndex]}</Text>{q.explanation ? <Text style={[styles.muted, { color: colors.muted }]}>{q.explanation}</Text> : null}</View>)}
      </> : current ? <>
        <Text style={[styles.muted, { color: colors.muted }]}>Question {index + 1} / {active.questions.length} · {answered} answered</Text>
        <View style={[styles.progress, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${100 * answered / active.questions.length}%` }]} /></View>
        <Text style={[styles.meta, { color: colors.muted }]}>{current.subject ?? "General"}{current.topic ? " · " + current.topic : ""}</Text>
        <Text style={[styles.question, { color: colors.text }]}>{current.text}</Text>
        {current.options.map((option, optionIndex) => {
          const selected = answers[index] === optionIndex;
          return <TouchableOpacity key={optionIndex} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setAnswers(previous => ({ ...previous, [index]: optionIndex }))} style={[styles.option, { borderColor: selected ? blue : colors.border, borderWidth: selected ? 2.5 : 1.5, backgroundColor: selected ? (darkMode ? "#1d3b68" : "#eff6ff") : colors.surface }]}><Text style={{ color: selected ? blue : colors.text, fontWeight: selected ? "800" : "500" }}>{String.fromCharCode(65 + optionIndex)}. {option}</Text></TouchableOpacity>;
        })}
        <View style={styles.actions}><TouchableOpacity disabled={index === 0 || busy} onPress={() => setIndex(i => i - 1)} style={[styles.secondary, { borderColor: colors.border, opacity: index === 0 ? .45 : 1 }]}><Text style={{ color: colors.text, fontWeight: "700" }}>Previous</Text></TouchableOpacity>{index < active.questions.length - 1 ? <TouchableOpacity onPress={() => setIndex(i => i + 1)} style={styles.primary}><Text style={styles.primaryText}>Next question →</Text></TouchableOpacity> : <TouchableOpacity disabled={busy} onPress={() => Alert.alert("Submit practice test?", `You answered ${answered} of ${active.questions.length} questions. Unanswered questions will be marked incorrect.`, [{ text: "Keep writing", style: "cancel" }, { text: "Submit", onPress: () => void finish() }])} style={[styles.primary, busy && { opacity: .5 }]}><Text style={styles.primaryText}>{busy ? "Submitting…" : "Submit test"}</Text></TouchableOpacity>}</View>
      </> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>;
  }

  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.header}><Text style={[styles.title, { color: colors.text, flex: 1 }]}>My practice exams</Text><TouchableOpacity onPress={() => void refresh()}><Text style={{ color: blue, fontWeight: "800" }}>Refresh</Text></TouchableOpacity></View>
    <Text style={[styles.muted, { color: colors.muted }]}>Practice exams you create here or save through your connected MCP are private to your student account and appear in this same library. These are practice exams, not official assigned exams.</Text>
    {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : error ? <Text style={styles.error}>{error}</Text> : tests.length === 0 ? <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text, fontWeight: "800" }}>No practice exams yet</Text><Text style={[styles.muted, { color: colors.muted, textAlign: "center" }]}>Create a practice exam above, or use your MCP to call create_my_practice_test. New MCP exams appear here automatically.</Text></View> : tests.map(test => <View key={test.id} style={[styles.testRow, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.testTitle, { color: colors.text }]}>{test.title}</Text>{test.description ? <Text style={[styles.muted, { color: colors.muted }]}>{test.description}</Text> : null}<Text style={[styles.meta, { color: colors.muted }]}>{test.questions.length} questions · {test.durationMinutes} min</Text><TouchableOpacity disabled={disabled} onPress={() => start(test)} style={[styles.primary, disabled && { opacity: .5 }]}><Text style={styles.primaryText}>Write test</Text></TouchableOpacity></View>)}
    {error && tests.length > 0 ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 12, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 20, fontWeight: "900" },
  testTitle: { fontSize: 16, fontWeight: "900" },
  muted: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  question: { fontSize: 17, lineHeight: 25, fontWeight: "800", marginTop: 10, marginBottom: 4 },
  result: { fontSize: 22, fontWeight: "900", marginTop: 8 },
  questionReview: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  progress: { height: 6, borderRadius: 8, overflow: "hidden", marginTop: 4 },
  progressFill: { height: "100%", backgroundColor: blue, borderRadius: 8 },
  option: { borderWidth: 1.5, borderRadius: 12, padding: 14, marginTop: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  primary: { flex: 1, backgroundColor: blue, borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, marginTop: 8 },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: { borderWidth: 1, borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 8 },
  empty: { borderWidth: 1, borderRadius: 12, alignItems: "center", padding: 18, marginTop: 12, gap: 8 },
  testRow: { borderWidth: 1, borderRadius: 13, padding: 13, marginTop: 12 },
  error: { color: "#b42318", lineHeight: 20, marginTop: 8 },
});
