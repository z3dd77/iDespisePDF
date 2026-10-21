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
import { isPdfToolkitError } from "@/lib/pdf/errors";
import { formatPageRanges, parsePageRanges } from "@/lib/pdf/pages";
import {
  splitPdfByRanges,
  splitPdfEachPage,
  splitPdfEveryN,
} from "@/lib/pdf/split";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("split");

type SplitMode = "ranges" | "every" | "each";

const MODE_OPTIONS = [
  {
    value: "ranges" as const,
    label: "Page ranges",
    description: "One output file per range you enter.",
  },
  {
    value: "every" as const,
    label: "Every N pages",
    description: "Fixed-size chunks, last one may be smaller.",
  },
  {
    value: "each" as const,
    label: "One per page",
    description: "Every page becomes its own PDF.",
  },
];

export function SplitTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [rangesText, setRangesText] = useState("");
  const [perFile, setPerFile] = useState("2");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  useEffect(() => {
    if (!file || preview.status !== "ready") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize the selection once previews exist
    setSelected(
      new Set(Array.from({ length: preview.pageCount }, (_, index) => index + 1)),
    );
    setRangesText(`1-${preview.pageCount}`);
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

  async function runSplit() {
    if (!file || !file.bytes || preview.status !== "ready") {
      return;
    }

    setRangeError(null);

    if (mode === "ranges") {
      try {
        const ranges = parsePageRanges(rangesText, preview.pageCount);
        await job.run((report) =>
          splitPdfByRanges(file.bytes, ranges, file.name, report),
        );
      } catch (error) {
        setRangeError(
          isPdfToolkitError(error) ? error.message : "Those ranges aren't valid.",
        );
      }

      return;
    }

    if (mode === "every") {
      const size = Number.parseInt(perFile, 10);

      if (!Number.isInteger(size) || size < 1) {
        setRangeError("Enter a group size of 1 or more pages.");
        return;
      }

      await job.run((report) => splitPdfEveryN(file.bytes, size, file.name, report));
      return;
    }

    await job.run((report) => splitPdfEachPage(file.bytes, file.name, report));
  }

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addFiles}
          label="Choose a PDF to split"
          hint="One PDF at a time. Page previews are rendered locally so you can check the document before splitting."
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
            toolbarExtra={
              <button
                type="button"
                disabled={selected.size === 0 || job.isWorking}
                onClick={() =>
                  setRangesText(formatPageRanges([...selected]))
                }
                className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-accent-strong shadow-raised-xs transition hover:shadow-raised-sm disabled:opacity-40"
              >
                Use selection as ranges
              </button>
            }
          />

          <OptionGroup
            legend="How should the document be split?"
            name="split-mode"
            value={mode}
            options={MODE_OPTIONS}
            onChange={(next) => {
              setMode(next);
              setRangeError(null);
            }}
            disabled={job.isWorking}
          />

          {mode === "ranges" ? (
            <PageRangeInput
              id="split-ranges"
              value={rangesText}
              onChange={setRangesText}
              error={rangeError}
              disabled={job.isWorking}
              hint="Each range becomes its own PDF. Use a comma between ranges, for example 1-3, 4-8, 9."
            />
          ) : null}

          {mode === "every" ? (
            <div>
              <label htmlFor="split-every" className="text-sm font-semibold text-ink">
                Pages per file
              </label>
              <input
                id="split-every"
                type="number"
                min={1}
                max={preview.pageCount}
                value={perFile}
                disabled={job.isWorking}
                onChange={(event) => setPerFile(event.target.value)}
                className="mt-2 w-32 rounded-control border border-line/70 bg-sunken px-4 py-2.5 text-sm text-ink shadow-inset-sm focus-visible:border-accent disabled:opacity-60"
              />
              {rangeError ? (
                <p role="alert" className="mt-1.5 text-xs font-medium text-planned-ink">
                  {rangeError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={job.isWorking}
              onClick={runSplit}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scissors aria-hidden="true" className="size-4" />
              {job.isWorking ? "Splitting…" : "Split PDF"}
            </button>
            <p className="text-xs text-ink-muted">
              The source file is read only; nothing is overwritten.
            </p>
          </div>
        </>
      ) : null}

      {job.state.status === "working" ? (
        <ProgressPanel label="Building split files" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="Split complete"
          summary={`${job.state.result.files.length} files were produced from ${preview.pageCount} pages.`}
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
