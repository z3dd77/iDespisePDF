"use client";

import { useEffect, useState } from "react";
import { ListOrdered, Undo2 } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { PageOrderGrid } from "@/components/tools/page-order-grid";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { moveItem } from "@/lib/pdf/pages";
import { reorderPdf } from "@/lib/pdf/reorder";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("reorder");

export function ReorderTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]);

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  useEffect(() => {
    if (!file || preview.status !== "ready") {
      return;
    }

    const visibleCount = preview.truncated
      ? preview.thumbnails.length
      : preview.pageCount;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- order must match the newly rendered previews
    setOrder(Array.from({ length: visibleCount }, (_, index) => index + 1));
  }, [file, preview.status, preview.pageCount, preview.truncated, preview.thumbnails.length]);

  const incomplete =
    preview.status === "ready" && order.length !== preview.pageCount;

  async function addFiles(incoming: File[]) {
    job.reset();
    const result = await readPdfFiles(incoming);
    setErrors(result.errors);

    if (result.accepted[0]) {
      setFile(result.accepted[0]);
    }
  }

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addFiles}
          label="Choose a PDF to reorder"
          hint="Pages are shown as thumbnails. Drag them, or use the arrow buttons, then export the new order."
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
            setOrder([]);
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
          {incomplete ? (
            <ErrorNotice
              message={`This document has ${preview.pageCount} pages. Reordering needs a thumbnail for every page, and previews stop at ${preview.thumbnails.length}. Use Extract pages or Split for larger documents.`}
            />
          ) : null}

          <PageOrderGrid
            thumbnails={preview.thumbnails}
            order={order}
            truncated={preview.truncated}
            disabled={job.isWorking || incomplete}
            onMove={(from, to) => setOrder((current) => moveItem(current, from, to))}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                job.isWorking || incomplete || order.length === 0
              }
              onClick={async () => {
                if (!file) {
                  return;
                }

                await job.run((report) =>
                  reorderPdf(file.bytes, order, file.name, report),
                );
              }}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ListOrdered aria-hidden="true" className="size-4" />
              {job.isWorking ? "Rebuilding…" : "Export new order"}
            </button>

            <button
              type="button"
              disabled={job.isWorking || order.length === 0}
              onClick={() =>
                setOrder(
                  Array.from({ length: order.length }, (_, index) => index + 1),
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-muted transition hover:text-ink disabled:opacity-40"
            >
              <Undo2 aria-hidden="true" className="size-4" />
              Reset order
            </button>
          </div>
        </>
      ) : null}

      {job.state.status === "working" ? (
        <ProgressPanel label="Writing pages in the new order" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="New page order ready"
          summary="The reordered document is ready. The source file was not modified."
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Start over"
          onReset={() => {
            job.reset();
            setFile(null);
            setOrder([]);
            setErrors([]);
          }}
        />
      ) : null}
    </ToolShell>
  );
}
