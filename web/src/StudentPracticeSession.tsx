import { useState } from "react";
import type { ReactNode } from "react";
import ExamLayout from "./components/ExamLayout";
export type PracticeSessionTest={attemptId:number;mode:string;deadline:string|null;serverNow?:string;questions:{id:number;subject:string;topic:string|null;text:string;options:string[];questionType?:string;promptData?:Record<string,unknown>}[];warnings:string[]};
type Props={test:PracticeSessionTest;answers:Record<number,unknown>;remainingSeconds:number|null;busy:boolean;isOnline?:boolean;syncStatus?:"idle"|"saving"|"saved"|"pending";localSaveAvailable?:boolean;onLeave:()=>void;onSelectAnswer:(questionId:number,response:unknown)=>void;onSubmit:()=>void};
const hasAnswer=(value:unknown)=>value!==undefined&&value!==null&&value!==""&&(!Array.isArray(value)||value.some(item=>item!==null&&item!==undefined));
export default function StudentPracticeSession({test,answers,remainingSeconds,busy,isOnline=true,localSaveAvailable=true,syncStatus="idle",onLeave,onSelectAnswer,onSubmit}:Props){
 const [activeQuestionIndex,setActiveQuestionIndex]=useState(0);const [markedForReview,setMarkedForReview]=useState<Set<number>>(new Set());const [showSubmitReview,setShowSubmitReview]=useState(false);const isFullMock=test.mode==="mock";const answeredCount=test.questions.filter(q=>hasAnswer(answers[q.id])).length;const current=test.questions[activeQuestionIndex];
 const timer:ReactNode=remainingSeconds!==null?<> · <strong className={remainingSeconds<300?"timer-warning":"exam-countdown"}>{Math.floor(remainingSeconds/60).toString().padStart(2,"0")}:{(remainingSeconds%60).toString().padStart(2,"0")} remaining</strong></>:null;
 function goToQuestion(index:number){const next=Math.max(0,Math.min(index,test.questions.length-1));setActiveQuestionIndex(next);const q=test.questions[next];if(q)document.getElementById(`practice-question-${q.id}`)?.scrollIntoView?.({behavior:"smooth",block:"start"});}
 function renderAnswer(q:PracticeSessionTest["questions"][number]){
  const type=q.questionType||"mcq",value=answers[q.id];
  if(type==="fill_blank")return <label className="practice-answer-input">Your answer<input aria-label="Your answer" type="text" value={typeof value==="string"?value:""} onChange={e=>onSelectAnswer(q.id,e.target.value)} /></label>;
  if(type==="numeric")return <label className="practice-answer-input">Numeric answer<input aria-label="Numeric answer" type="number" inputMode="decimal" value={typeof value==="number"?String(value):""} onChange={e=>onSelectAnswer(q.id,e.target.value===""?null:Number(e.target.value))} /></label>;
  if(type==="matching"){
   const left=Array.isArray(q.promptData?.left)?q.promptData!.left as string[]:[],right=Array.isArray(q.promptData?.right)?q.promptData!.right as string[]:[];
   const selected=Array.isArray(value)?value as unknown[]:[];
   return <div className="matching-answers">{left.map((item,index)=><label key={index}>{item}<select aria-label={`Match ${item}`} value={Number.isInteger(selected[index])?String(selected[index]):""} onChange={e=>{const next=[...selected];next[index]=e.target.value===""?null:Number(e.target.value);onSelectAnswer(q.id,next);}}><option value="">Choose match</option>{right.map((choice,i)=><option key={i} value={i}>{choice}</option>)}</select></label>)}</div>;
  }
  const options=q.options||[];
  if(type==="multi_select"){
   const selected=Array.isArray(value)?value as number[]:[];
   return <div className="options">{options.map((option,index)=>{const active=selected.includes(index);return <button type="button" key={index} aria-pressed={active} className={active?"option selected":"option"} onClick={()=>onSelectAnswer(q.id,active?selected.filter(i=>i!==index):[...selected,index].sort((a,b)=>a-b))}><span>{active?"✓":String.fromCharCode(65+index)}</span>{option}</button>;})}</div>;
  }
  return <div className="options">{options.map((option,index)=><button type="button" key={index} aria-pressed={value===index} className={value===index?"option selected":"option"} onClick={()=>onSelectAnswer(q.id,index)}><span>{String.fromCharCode(65+index)}</span>{option}</button>)}</div>;
 }
 function renderQuestionCard(q:PracticeSessionTest["questions"][number],index:number){
  const marked=markedForReview.has(q.id);
  return <article id={`practice-question-${q.id}`} className="panel question-card" key={q.id}>
   <p className="eyebrow">QUESTION {index+1} · {q.subject}{q.topic?` · ${q.topic}`:""} · {(q.questionType||"mcq").replace("_"," ").toUpperCase()}</p>
   <div className="current-question-heading"><h2>{q.text}</h2><button type="button" className={marked?"button button-secondary marked-for-review":"button button-secondary"} aria-pressed={marked} onClick={()=>setMarkedForReview(previous=>{const next=new Set(previous);if(next.has(q.id))next.delete(q.id);else next.add(q.id);return next;})}>{marked?"Remove review mark":"Mark for review"}</button></div>
   {renderAnswer(q)}
  </article>;
 }
 return <ExamLayout
  title={isFullMock?"Full mock test":"Stay focused."}
  eyebrow={isFullMock?"AP ECET FULL MOCK":"PRACTICE SESSION"}
  meta={<>{test.questions.length} questions · {answeredCount} answered{timer}</>}
  headerActions={<button type="button" className="ghost" disabled={busy} onClick={onLeave}>Leave session</button>}
  status={<>
    <p className={localSaveAvailable?"practice-save-status":"practice-save-status unavailable"} role="status">{!localSaveAvailable?"Local recovery is unavailable. Keep this tab open and submit before closing it.":isOnline?syncStatus==="saving"?"Saving answers to the server…":syncStatus==="saved"?"Answers synced to the server and saved on this device.":syncStatus==="pending"?"Server sync pending. Answers remain saved on this device; retrying on your next edit or reconnection.":"Saved on this device. Server synchronization is automatic.":"Offline — answers are saved on this device and will sync when you reconnect."}</p>
    {test.warnings.map(w=><p className="notice" key={w}>{w}</p>)}
  </>}
  currentIndex={activeQuestionIndex}
  questionCount={test.questions.length}
  answeredCount={answeredCount}
  submitLabel={isFullMock?"Review and submit full mock":"Submit practice"}
  submitDisabled={busy}
  busy={busy}
  onPrevious={()=>goToQuestion(activeQuestionIndex-1)}
  onNext={()=>goToQuestion(activeQuestionIndex+1)}
  onSubmit={()=>isFullMock?setShowSubmitReview(true):onSubmit()}
 >
  {isFullMock?<div className="ecet-preset-summary" role="note"><strong>AP ECET CSE preset</strong><span>Mathematics 50 · Physics 25 · Chemistry 25 · CSE 100</span><span>180 minutes · +1 correct · 0 negative marking · official section order</span></div>:null}
  {current?renderQuestionCard(current,activeQuestionIndex):<p className="panel muted">No questions are available in this session.</p>}
  {showSubmitReview&&isFullMock?<div className="announcement-overlay"><section className="announcement-popup panel" role="dialog" aria-modal="true" aria-labelledby="full-mock-submit-title"><p className="eyebrow">FINAL CHECK</p><h2 id="full-mock-submit-title">Submit your full mock?</h2><p>You answered <strong>{answeredCount} of {test.questions.length}</strong> questions.</p><p>{test.questions.length-answeredCount} question{test.questions.length-answeredCount===1?" is":"s are"} unanswered and will be counted as unanswered. You cannot change answers after submission.</p><p className="muted">The 180-minute timer continues while you review this confirmation.</p><div className="row"><button type="button" className="button button-secondary" disabled={busy} onClick={()=>setShowSubmitReview(false)}>Continue reviewing</button><button type="button" className="primary" disabled={busy} onClick={onSubmit}>{busy?"Submitting…":"Submit full mock"}</button></div></section></div>:null}
 </ExamLayout>;

}
