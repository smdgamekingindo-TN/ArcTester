import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminQuestionImport, { type AdminImportReport, type QuestionImportFormat } from "./AdminQuestionImport";

const report: AdminImportReport = { added: 8, duplicates: 2, invalid: [{ row: 5, reason: "Expected four options." }], total: 11 };
function renderImport(overrides: Partial<React.ComponentProps<typeof AdminQuestionImport>> = {}) {
  const props = { uploadText: "subject,text", uploadFormat: "csv" as QuestionImportFormat, report: null, previewReady: false, busy: false, onUploadTextChange: vi.fn(), onFormatChange: vi.fn(), onReadFile: vi.fn(), onLoadExample: vi.fn(), onDownloadTemplate: vi.fn(), onPreviewImport: vi.fn(), onConfirmImport: vi.fn(), onCancelPreview: vi.fn(), ...overrides };
  render(<AdminQuestionImport {...props} />);
  return props;
}

describe("AdminQuestionImport", () => {
  it("renders the source and preview workflow", () => {
    renderImport();
    expect(screen.getByRole("heading", { name: "Upload question sets" })).toBeTruthy();
    expect(screen.getByText("Drop CSV or JSON file here")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview import" })).toBeTruthy();
  });

  it("delegates text editing, format selection, preview and template actions", () => {
    const props = renderImport();
    fireEvent.change(screen.getByPlaceholderText(/File contents appear here/), { target: { value: "new data" } });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    fireEvent.click(screen.getByRole("button", { name: "Load CSV example" }));
    fireEvent.click(screen.getByRole("button", { name: "Download CSV template" }));
    fireEvent.click(screen.getByRole("button", { name: "Download JSON template" }));
    expect(props.onUploadTextChange).toHaveBeenCalledWith("new data");
    expect(props.onFormatChange).toHaveBeenCalledWith("json");
    expect(props.onPreviewImport).toHaveBeenCalledTimes(1);
    expect(props.onLoadExample).toHaveBeenCalledTimes(1);
    expect(props.onDownloadTemplate).toHaveBeenNthCalledWith(1, "csv");
    expect(props.onDownloadTemplate).toHaveBeenNthCalledWith(2, "json");
  });

  it("shows validation report and delegates confirmation or cancellation", () => {
    const props = renderImport({ report, previewReady: true });
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Row 5: Expected four options.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel preview" }));
    expect(props.onConfirmImport).toHaveBeenCalledTimes(1);
    expect(props.onCancelPreview).toHaveBeenCalledTimes(1);
  });

  it("reads selected files and disables preview while busy", () => {
    const props = renderImport({ busy: true });
    const file = new File(["subject,text"], "questions.csv", { type: "text/csv" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onReadFile).toHaveBeenCalledWith(file);
    expect(screen.getByRole("button", { name: "Validating…" }).hasAttribute("disabled")).toBe(true);
  });
});
