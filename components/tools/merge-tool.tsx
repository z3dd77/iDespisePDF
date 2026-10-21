"use client";

import { useMemo, useState } from "react";
import { Combine } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { FileList } from "@/components/tools/file-list";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { ToolShell } from "@/components/tools/tool-shell";
import { useFileThumbnails } from "@/hooks/use-file-thumbnails";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { formatCount, formatBytes } from "@/lib/format";
import { moveItem } from "@/lib/pdf/pages";
import { mergePdfs } from "@/lib/pdf/merge";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("merge");

export function MergeTool() {
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const job = useToolJob<ProcessingResult>();
  const covers = useFileThumbnails(files);

  const totalBytes = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files],
  );

  async function addFiles(incoming: File[]) {
    job.reset();
    const result = await readPdfFiles(incoming);

    if (result.accepted.length > 0) {
      setFiles((current) => [...current, ...result.accepted]);
      setErrors(result.errors);
    } else {
      setErrors(result.errors);
    }
  }

  return (
    <ToolShell tool={tool}>
      <section aria-labelledby="merge-files" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="merge-files" className="text-sm font-semibold text-ink">
            Files, in merge order
          </h2>
          <p className="text-xs text-ink-muted">
            {formatCount(files.length, "file")} · {formatBytes(totalBytes)}
          </p>
        </div>

        <FileDropZone
          accept="pdf"
          multiple
          onFiles={addFiles}
          label="Add PDF files"
          hint="Drop PDFs here or choose files. At least two files are needed. Add them in the order you want them joined, then adjust."
          disabled={job.isWorking}
        />

        <ErrorList messages={errors} />

        {files.length > 0 ? (
          <FileList
            items={files.map((file) => {
              const cover = covers[file.id];

              return {
                id: file.id,
                label: file.name,
                size: file.size,
                thumbnailUrl: cover?.dataUrl,
                detail: cover
                  ? `${cover.pageCount} ${
                      cover.pageCount === 1 ? "page" : "pages"
                    }`
                  : undefined,
              };
            })}
            disabled={job.isWorking}
            onRemove={(id) => {
              job.reset();
              setFiles((current) => current.filter((file) => file.id !== id));
            }}
            onReorder={(from, to) => {
              job.reset();
              setFiles((current) => moveItem(current, from, to));
            }}
          />
        ) : null}

        <ErrorNotice
          message={
            files.length === 1
              ? "Add one more PDF to merge."
              : null
          }
        />

        <button
          type="button"
          disabled={files.length < 2 || job.isWorking}
          onClick={async () => {
            await job.run(async (report) => {
              return mergePdfs(
                files.map((file) => ({ name: file.name, bytes: file.bytes })),
                report,
              );
            });
          }}
          className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Combine aria-hidden="true" className="size-4" />
          {job.isWorking ? "Merging…" : `Merge ${files.length || ""} PDFs`.trim()}
        </button>
      </section>

      {job.state.status === "working" ? (
        <ProgressPanel label="Merging PDFs" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? (
        <ErrorNotice message={job.state.message} />
      ) : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="Merged"
          summary="The merged document is ready. Your source files are untouched."
          files={job.state.result.files}
          notes={job.state.result.notes}
          onReset={() => {
            job.reset();
            setFiles([]);
            setErrors([]);
          }}
        />
      ) : null}
    </ToolShell>
  );
}
