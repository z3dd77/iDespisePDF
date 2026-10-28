"use client";

import { useState, useEffect } from "react";
import { Scissors } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { OptionGroup } from "@/components/tools/option-group";
import { PageGrid } from "@/components/tools/page-grid";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";

import { addPageNumbers } from "@/lib/pdf/add-page-numbers";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("add-page-numbers");

type Placement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type Format = "plain" | "ofTotal" | "pageOfTotal";

const FORMAT_OPTIONS = [
  { value: "plain" as const, label: "1", description: "Simple page number" },
  { value: "ofTotal" as const, label: "1 of N", description: "Number with total count" },
  { value: "pageOfTotal" as const, label: "Page 1 of N", description: "Full descriptor" },
];

const PLACEMENT_OPTIONS = [
  { value: "top-left" as const, label: "Top‑left" },
  { value: "top-center" as const, label: "Top‑center" },
  { value: "top-right" as const, label: "Top‑right" },
  { value: "bottom-left" as const, label: "Bottom‑left" },
  { value: "bottom-center" as const, label: "Bottom‑center" },
  { value: "bottom-right" as const, label: "Bottom‑right" },
];

export function AddPageNumbersTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);


  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangesText, setRangesText] = useState("");

  // options state
  const [format, setFormat] = useState<Format>("plain");
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  const [startNumber, setStartNumber] = useState(1);
  const [offset, setOffset] = useState(0);
  const [fontSize, setFontSize] = useState(12);
  const [margin, setMargin] = useState(10);
  const [color, setColor] = useState("#000000");

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  // initialise selection once preview ready
  useEffect(() => {
    if (!file || preview.status !== "ready") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRangesText("");
  }, [file, preview.status, preview.pageCount]);

  async function addFiles(incoming: File[]) {
    job.reset();
    const result = await readPdfFiles(incoming);
    setErrors(result.errors);
    if (result.accepted[0]) {
      setFile(result.accepted[0]);

    }
  }

  async function runAddNumbers() {
    if (!file || !file.bytes || preview.status !== "ready") return;
    if (selected.size === 0) {

      return;
    }


    const opts = {
      format,
      placement,
      startNumber,
      offset,
      fontSize,
      color,
      margin,
    } as const;
    await job.run((report) => addPageNumbers(file.bytes, opts, file.name, report));
  }

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addFiles}
          label="Choose a PDF to add page numbers"
          hint="One PDF at a time. Page previews are rendered locally so you can verify before applying numbers."
        />
      ) : (
        <SelectedFileCard
          name={file.name}
          size={file.size}
          pageCount={preview.status === "ready" ? preview.pageCount : undefined}
          disabled={job.isWorking}
          onRemove={() => {
            job.reset();
            setFile(null);
            setErrors([]);
            setRangesText("");
            setSelected(new Set());
          }}
        />
      )}

      <ErrorList messages={errors} />

      {preview.status === "loading" ? (
        <ProgressPanel label="Rendering page previews" progress={preview.progress} />
      ) : null}

      {preview.status === "error" ? <ErrorNotice message={preview.message} /> : null}

      {file && preview.status === "ready" ? (
        <>
          <PageGrid
            pageCount={preview.pageCount}
            thumbnails={preview.thumbnails}
            truncated={preview.truncated}
            selected={selected}
            disabled={job.isWorking}
            onToggle={(page) =>
              setSelected((cur) => {
                const next = new Set(cur);
                if (next.has(page)) next.delete(page);
                else next.add(page);
                return next;
              })
            }
            onSelectAll={() =>
              setSelected(new Set(Array.from({ length: preview.pageCount }, (_, i) => i + 1)))
            }
            onClear={() => setSelected(new Set())}
            onInvert={() =>
              setSelected((cur) => {
                const next = new Set<number>();
                for (let p = 1; p <= preview.pageCount; p++) {
                  if (!cur.has(p)) next.add(p);
                }
                return next;
              })
            }
            toolbarExtra={
              <button
                type="button"
                disabled={selected.size === 0 || job.isWorking}
                onClick={() => setRangesText(selected.size ? `${Array.from(selected).join(",")}` : "")}
                className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-accent-strong shadow-raised-xs transition hover:shadow-raised-sm disabled:opacity-40"
              >
                Use selection as ranges
              </button>
            }
          />

          {/* Options */}
          <OptionGroup
            legend="Number format"
            name="num-format"
            value={format}
            options={FORMAT_OPTIONS}
            onChange={(v) => setFormat(v)}
            disabled={job.isWorking}
          />

          <OptionGroup
            legend="Placement"
            name="placement"
            value={placement}
            options={PLACEMENT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            onChange={(v) => setPlacement(v as Placement)}
            disabled={job.isWorking}
          />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">Start number</span>
              <input
                type="number"
                min={1}
                value={startNumber}
                disabled={job.isWorking}
                onChange={(e) => setStartNumber(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Offset</span>
              <input
                type="number"
                value={offset}
                disabled={job.isWorking}
                onChange={(e) => setOffset(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Font size (pt)</span>
              <input
                type="number"
                min={1}
                value={fontSize}
                disabled={job.isWorking}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Margin (pt)</span>
              <input
                type="number"
                min={0}
                value={margin}
                disabled={job.isWorking}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block col-span-2">
              <span className="text-sm font-medium text-ink">Colour</span>
              <input
                type="color"
                value={color}
                disabled={job.isWorking}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-16 rounded-control border border-line/70 bg-sunken p-1"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              type="button"
              disabled={job.isWorking}
              onClick={runAddNumbers}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scissors aria-hidden="true" className="size-4" />
              {job.isWorking ? "Adding…" : "Add Page Numbers"}
            </button>
            <p className="text-xs text-ink-muted">The source file is unchanged; a new PDF will be downloaded.</p>
          </div>
        </>
      ) : null}

      {job.state.status === "working" && (
        <ProgressPanel label="Adding page numbers" progress={job.state.progress} />
      )}

      {job.state.status === "error" && <ErrorNotice message={job.state.message} />}

      {job.state.status === "done" && (
        <ResultPanel
          title="Page numbers added"
          summary={`${job.state.result.files[0].pageCount} pages with numbers.
          `}
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Choose another file"
          onReset={() => {
            job.reset();
            setFile(null);
            setSelected(new Set());
            setErrors([]);
            setRangesText("");
          }}
        />
      )}
    </ToolShell>
  );
}
