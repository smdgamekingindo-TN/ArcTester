import { useRef, useState } from "react";

export type QuestionImportFormat = "csv" | "json";
export type AdminImportReport = { added: number; duplicates: number; invalid: { row: number; reason: string }[]; total: number };

type AdminQuestionImportProps = {
  uploadText: string;
  uploadFormat: QuestionImportFormat;
  report: AdminImportReport | null;
  previewReady: boolean;
  busy: boolean;
  onUploadTextChange: (value: string) => void;
  onFormatChange: (format: QuestionImportFormat) => void;
  onReadFile: (file: File) => void;
  onLoadExample: () => void;
  onDownloadTemplate: (format: QuestionImportFormat) => void;
  onPreviewImport: () => void;
  onConfirmImport: () => void;
  onCancelPreview: () => void;
};

export default function AdminQuestionImport({ uploadText, uploadFormat, report, previewReady, busy, onUploadTextChange, onFormatChange, onReadFile, onLoadExample, onDownloadTemplate, onPreviewImport, onConfirmImport, onCancelPreview }: AdminQuestionImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  function acceptFile(file?: File) { if (file) onReadFile(file); }

  return (
    <>
      <div className="admin-page-title"><div><p className="eyebrow">BULK QUESTION INGESTION</p><h1>Upload question sets</h1><p>Import thousands of questions, validate every row, and see duplicates before you move on.</p></div></div>
      <div className="admin-two-col import-layout">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><p className="eyebrow">STEP 1 · SOURCE</p><h2>Choose a file</h2></div></div>
          <div className={dragging ? "drop-zone dragging" : "drop-zone"} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(event) => acceptFile(event.target.files?.[0])} />
            <span className="upload-icon">⇧</span><b>Drop CSV or JSON file here</b><small>or click to browse your device</small><em>CSV · JSON · Up to 8 MB</em>
          </div>
          <div className="format-note"><b>CSV columns</b><code>subject, topic, text, optionA, optionB, optionC, optionD, correctIndex, explanation, source, difficulty</code><button className="text-button" onClick={onLoadExample}>Load CSV example</button><div className="template-actions"><button className="ghost" onClick={() => onDownloadTemplate("csv")}>Download CSV template</button><button className="ghost" onClick={() => onDownloadTemplate("json")}>Download JSON template</button></div></div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head"><div><p className="eyebrow">STEP 2 · REVIEW</p><h2>Preview and import</h2></div></div>
          <div className="segmented"><button className={uploadFormat === "csv" ? "chosen" : ""} onClick={() => onFormatChange("csv")}>CSV</button><button className={uploadFormat === "json" ? "chosen" : ""} onClick={() => onFormatChange("json")}>JSON</button></div>
          <textarea className="import-editor" value={uploadText} onChange={(event) => onUploadTextChange(event.target.value)} placeholder="File contents appear here. You can also paste your question data…" />
          <button className="primary full" disabled={!uploadText.trim() || busy} onClick={previewReady ? onConfirmImport : onPreviewImport}>{busy ? (previewReady ? "Importing…" : "Validating…") : previewReady ? "Confirm import" : "Preview import"}</button>
          {previewReady && <button className="ghost full" onClick={onCancelPreview}>Cancel preview</button>}
          {report && <div className="import-report"><div><b>{report.added}</b><small>Added</small></div><div><b>{report.duplicates}</b><small>Duplicates</small></div><div><b>{report.invalid.length}</b><small>Invalid rows</small></div>{report.invalid.slice(0, 12).map((row) => <p key={row.row}>Row {row.row}: {row.reason}</p>)}</div>}
        </section>
      </div>
    </>
  );
}
