"use client";

import { useState } from "react";
import { FileOutput } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { PageGrid } from "@/components/tools/page-grid";
import { PageRangeInput } from "@/components/tools/page-range-input";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { isPdfToolkitError } from "@/lib/pdf/errors";
import { extractPages } from "@/lib/pdf/extract";
import { formatPageRanges, parsePageSelection } from "@/lib/pdf/pages";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("extract-pages");

export function ExtractTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangesText, setRangesText] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  async function addFiles(incoming: File[]) {
    job.reset();
    const result = await readPdfFiles(incoming);
    setErrors(result.errors);

    if (result.accepted[0]) {
      setFile(result.accepted[0]);
      setSelected(new Set());
      setRangesText("");
      setRangeError(null);
    }
  }

  function applyRanges() {
    if (preview.status !== "ready") {
      return;
    }

    try {
      const pages = parsePageSelection(rangesText, preview.pageCount);
      setSelected(new Set(pages));
      setRangeError(null);
    } catch (error) {
      setRangeError(
        isPdfToolkitError(error) ? error.message : "Those page numbers aren't valid.",
      );
    }
  }

  const orderedSelection = [...selected].sort((left, right) => left - right);

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addFiles}
          label="Choose a PDF to extract from"
          hint="Select pages from the preview or type a range. The source file is never modified."
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
            setSelected(new Set());
            setRangesText("");
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
          <div className="rounded-card border border-white/70 bg-surface p-4 shadow-raised-sm sm:p-5">
            <PageRangeInput
              id="extract-ranges"
              value={rangesText}
              onChange={(value) => {
                setRangesText(value);
                setRangeError(null);
              }}
              error={rangeError}
              disabled={job.isWorking}
              hint="Type the pages you want, then apply. For example: 1-3, 5, 8-10."
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={job.isWorking || rangesText.trim().length === 0}
                onClick={applyRanges}
                className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:opacity-50"
              >
                Apply range to selection
              </button>
              <button
                type="button"
                disabled={job.isWorking || selected.size === 0}
                onClick={() => setRangesText(formatPageRanges(orderedSelection))}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-accent-strong shadow-raised-xs transition hover:shadow-raised-sm disabled:opacity-40"
              >
                Show selection as ranges
              </button>
            </div>
          </div>

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
                  Array.from({ length: preview.pageCount }, (_, index) => index + 1),
                ),
              )
            }
            onClear={() => setSelected(new Set())}
            onInvert={() =>
              setSelected((current) => {
                const next = new Set<number>();
                for (let page = 1; page <= preview.pageCount; page += 1) {
                  if (!current.has(page)) {
                    next.add(page);
                  }
                }
                return next;
              })
            }
          />

          <button
            type="button"
            disabled={selected.size === 0 || job.isWorking}
            onClick={async () => {
              if (!file) {
                return;
              }

              await job.run((report) =>
                extractPages(file.bytes, orderedSelection, file.name, report),
              );
            }}
            className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileOutput aria-hidden="true" className="size-4" />
            {job.isWorking
              ? "Extracting…"
              : `Extract ${selected.size || 0} ${selected.size === 1 ? "page" : "pages"}`}
          </button>
        </>
      ) : null}

      {job.state.status === "working" ? (
        <ProgressPanel label="Building the new PDF" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="Pages extracted"
          summary="The new document contains only the pages you selected, in document order."
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Start over"
          onReset={() => {
            job.reset();
            setFile(null);
            setSelected(new Set());
            setRangesText("");
            setErrors([]);
          }}
        />
      ) : null}
    </ToolShell>
  );
}
