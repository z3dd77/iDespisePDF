"use client";

import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { OptionGroup } from "@/components/tools/option-group";
import { PageGrid } from "@/components/tools/page-grid";
import { PageRangeInput } from "@/components/tools/page-range-input";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { deletePages } from "@/lib/pdf/delete-pages";


import { formatPageRanges } from "@/lib/pdf/pages";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("delete-pages");

export function DeletePagesTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [rangesText, setRangesText] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  // Initialise selection & range text once a preview is ready
  useEffect(() => {
    if (!file || preview.status !== "ready") {
      return;
    }
    // default to no pages selected (user must choose) – keep range text empty
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
      setRangeError(null);
    }
  }

  async function runDelete() {
    if (!file || !file.bytes || preview.status !== "ready") {
      return;
    }
    if (selected.size === 0) {
      setRangeError("Select at least one page to delete.");
      return;
    }
    setRangeError(null);

    // Convert selected set to array of page numbers
    const pagesToDelete = Array.from(selected);
    await job.run((report) => deletePages(file.bytes, pagesToDelete, file.name, report));
  }

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addFiles}
          label="Choose a PDF to delete pages from"
          hint="One PDF at a time. Page previews are rendered locally so you can inspect before deletion."
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
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(page)) {
                  next.delete(page);
                } else {
                  next.add(page);
                }
                return next;
              })
            }
            onSelectAll={() =>
              setSelected(
                new Set(
                  Array.from({ length: preview.pageCount }, (_, i) => i + 1),
                ),
              )
            }
            onClear={() => setSelected(new Set())}
            onInvert={() =>
              setSelected((current) => {
                const next = new Set<number>();
                for (let p = 1; p <= preview.pageCount; p++) {
                  if (!current.has(p)) next.add(p);
                }
                return next;
              })
            }
            toolbarExtra={
              <button
                type="button"
                disabled={selected.size === 0 || job.isWorking}
                onClick={() => setRangesText(formatPageRanges([...selected]))}
                className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-accent-strong shadow-raised-xs transition hover:shadow-raised-sm disabled:opacity-40"
              >
                Use selection as ranges
              </button>
            }
          />

          <OptionGroup
            legend="Delete mode"
            name="delete-mode"
            value="selection"
            options={[{ value: "selection" as const, label: "Select pages", description: "Choose pages to delete via grid or range" }]}
            onChange={() => {}}
            disabled={job.isWorking}
          />

          <PageRangeInput
            id="delete-ranges"
            value={rangesText}
            onChange={setRangesText}
            error={rangeError}
            disabled={job.isWorking}
            hint="Enter page ranges (e.g. 1-3,5) or use the grid selection button above."
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={job.isWorking}
              onClick={runDelete}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scissors aria-hidden="true" className="size-4" />
              {job.isWorking ? "Deleting…" : "Delete Pages"}
            </button>
            <p className="text-xs text-ink-muted">
              The source file remains unchanged; a new PDF without the selected pages will be downloaded.
            </p>
          </div>
        </>
      ) : null}

      {job.state.status === "working" ? (
        <ProgressPanel label="Building output PDF" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="Pages deleted"
          summary={`${job.state.result.files[0].pageCount} pages remain after deleting ${selected.size} page(s).`}
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
      ) : null}
    </ToolShell>
  );
}
