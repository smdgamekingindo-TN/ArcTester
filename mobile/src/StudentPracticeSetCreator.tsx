import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type DraftQuestion = { subject: string; text: string; options: string[]; correctIndex: number; explanation: string };
type Props = { api: Api; darkMode: boolean; disabled?: boolean; onCreated?: () => void };
const emptyQuestion = (): DraftQuestion => ({ subject: "General", text: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" });
const blue = "#2563eb";

export default function StudentPracticeSetCreator({ api, darkMode, disabled = false, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("20");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const colors = darkMode ? { card: "#172235", border: "#334155", text: "#f1f5f9", muted: "#a7b4c8", surface: "#1e293b" } : { card: "#fff", border: "#e4e8ef", text: "#172033", muted: "#748096", surface: "#f8fafc" };
  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) => setQuestions(current => current.map((q, i) => i === index ? { ...q, ...patch } : q));
  const save = async () => {
    setError("");
    const durationMinutes = Number(duration);
    if (title.trim().length < 2) { setError("Enter an exam title (at least 2 characters)."); return; }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) { setError("Duration must be between 1 and 600 minutes."); return; }
    if (questions.some(q => q.text.trim().length < 2 || q.options.some(option => !option.trim()) || q.options.length < 2)) { setError("Each question needs text and all four answer options."); return; }
    setSaving(true);
    try {
      await api("/student/practice-sets", { method: "POST", body: JSON.stringify({ title: title.trim(), description: description.trim(), durationMinutes, questions: questions.map(q => ({ subject: q.subject.trim() || "General", topic: "General", text: q.text.trim(), options: q.options.map(o => o.trim()), correctIndex: q.correctIndex, explanation: q.explanation.trim(), difficulty: "medium" })) }) });
      setTitle(""); setDescription(""); setDuration("20"); setQuestions([emptyQuestion()]); setOpen(false); onCreated?.();
    } catch (cause) { setError((cause as Error).message || "Could not save your practice exam."); }
    finally { setSaving(false); }
  };
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <TouchableOpacity onPress={() => setOpen(value => !value)} disabled={disabled} style={styles.header}><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.text }]}>Create a practice exam</Text><Text style={[styles.muted, { color: colors.muted }]}>Write your own questions and save them to your practice exam list.</Text></View><Text style={{ color: blue, fontWeight: "900" }}>{open ? "Close" : "＋ Create"}</Text></TouchableOpacity>
    {open ? <>
      <TextInput value={title} onChangeText={setTitle} placeholder="Exam title" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      <TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="Duration in minutes" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
      {questions.map((question, index) => <View key={index} style={[styles.questionCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.header}><Text style={[styles.questionTitle, { color: colors.text }]}>Question {index + 1}</Text>{questions.length > 1 ? <TouchableOpacity onPress={() => setQuestions(current => current.filter((_q, i) => i !== index))}><Text style={{ color: "#b42318", fontWeight: "800" }}>Remove</Text></TouchableOpacity> : null}</View>
        <TextInput value={question.subject} onChangeText={subject => updateQuestion(index, { subject })} placeholder="Subject" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
        <TextInput value={question.text} onChangeText={text => updateQuestion(index, { text })} placeholder="Write the question…" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border }]} />
        {question.options.map((option, optionIndex) => <View key={optionIndex} style={styles.optionRow}><TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: question.correctIndex === optionIndex }} onPress={() => updateQuestion(index, { correctIndex: optionIndex })} style={[styles.answerChoice, { borderColor: question.correctIndex === optionIndex ? blue : colors.border, backgroundColor: question.correctIndex === optionIndex ? (darkMode ? "#1d3b68" : "#eff6ff") : "transparent" }]}><Text style={{ color: question.correctIndex === optionIndex ? blue : colors.muted, fontWeight: "900" }}>{String.fromCharCode(65 + optionIndex)}{question.correctIndex === optionIndex ? " ✓" : ""}</Text></TouchableOpacity><TextInput value={option} onChangeText={value => updateQuestion(index, { options: question.options.map((old, i) => i === optionIndex ? value : old) })} placeholder={"Option " + String.fromCharCode(65 + optionIndex)} placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border }]} /></View>)}
        <TextInput value={question.explanation} onChangeText={explanation => updateQuestion(index, { explanation })} placeholder="Explanation (optional)" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border }]} />
        <Text style={[styles.muted, { color: colors.muted }]}>Tap A/B/C/D to mark the correct answer.</Text>
      </View>)}
      <TouchableOpacity disabled={questions.length >= 100} onPress={() => setQuestions(current => [...current, emptyQuestion()])} style={[styles.secondary, { borderColor: colors.border }]}><Text style={{ color: blue, fontWeight: "800" }}>＋ Add question</Text></TouchableOpacity>
      <TouchableOpacity disabled={saving || disabled} onPress={() => void save()} style={[styles.primary, (saving || disabled) && { opacity: .55 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save practice exam</Text>}</TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 12, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 18, fontWeight: "900" },
  questionTitle: { fontSize: 15, fontWeight: "900" },
  muted: { fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  questionCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 9 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  answerChoice: { borderWidth: 1.5, borderRadius: 9, width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: blue, borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondary: { borderWidth: 1, borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center" },
  error: { color: "#b42318", lineHeight: 20 },
});
