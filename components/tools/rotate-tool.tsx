"use client";

import { useEffect, useState } from "react";
import { RotateCw, Undo2 } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { PageGrid } from "@/components/tools/page-grid";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { addRotation } from "@/lib/pdf/pages";
import { rotatePdf, type PageRotations } from "@/lib/pdf/rotate";
import type { ProcessingResult, RotationAngle } from "@/lib/pdf/types";
import { cn } from "@/lib/cn";
import { getTool } from "@/lib/tools";

const tool = getTool("rotate");

const ANGLES: RotationAngle[] = [90, 180, 270];

export function RotateTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [angle, setAngle] = useState<RotationAngle>(90);
  const [rotations, setRotations] = useState<PageRotations>({});

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  useEffect(() => {
    if (!file || preview.status !== "ready") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize rotation state once previews exist
    setRotations({});
    setSelected(
      new Set(Array.from({ length: preview.pageCount }, (_, index) => index + 1)),
    );
  }, [file, preview.status, preview.pageCount]);

  const pendingCount = Object.values(rotations).filter(
    (value) => (value ?? 0) !== 0,
  ).length;

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
          label="Choose a PDF to rotate"
          hint="Rotation is applied to page orientation. Content is not re-rendered, so text stays selectable."
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
            setRotations({});
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
            rotations={rotations}
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

          <div className="rounded-card border border-white/70 bg-surface p-4 shadow-raised-sm sm:p-5">
            <p className="text-sm font-semibold text-ink">Rotation</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Badges on thumbnails show the rotation that will be applied on top
              of the page&apos;s current orientation.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {ANGLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={angle === option}
                  disabled={job.isWorking}
                  onClick={() => setAngle(option)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                    angle === option
                      ? "bg-accent-strong text-white shadow-raised-sm"
                      : "bg-surface text-ink shadow-raised-xs hover:shadow-raised-sm",
                  )}
                >
                  <RotateCw aria-hidden="true" className="size-4" />
                  {option}&deg;
                </button>
              ))}

              <button
                type="button"
                disabled={selected.size === 0 || job.isWorking}
                onClick={() =>
                  setRotations((current) => {
                    const next: PageRotations = { ...current };
                    for (const page of selected) {
                      next[page] = addRotation(next[page] ?? 0, angle);
                    }
                    return next;
                  })
                }
                className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:opacity-50"
              >
                Apply {angle}&deg; to {selected.size || 0} selected
              </button>

              <button
                type="button"
                disabled={pendingCount === 0 || job.isWorking}
                onClick={() => setRotations({})}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-muted transition hover:text-ink disabled:opacity-40"
              >
                <Undo2 aria-hidden="true" className="size-4" />
                Clear rotations
              </button>
            </div>

            <p className="mt-3 text-xs text-ink-muted">
              {pendingCount === 0
                ? "No rotation queued yet."
                : `${pendingCount} ${pendingCount === 1 ? "page has" : "pages have"} a pending rotation.`}
            </p>
          </div>

          <button
            type="button"
            disabled={pendingCount === 0 || job.isWorking}
            onClick={async () => {
              if (!file) {
                return;
              }

              await job.run((report) =>
                rotatePdf(file.bytes, rotations, file.name, report),
              );
            }}
            className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCw aria-hidden="true" className="size-4" />
            {job.isWorking ? "Rotating…" : "Export rotated PDF"}
          </button>
        </>
      ) : null}

      {job.state.status === "working" ? (
        <ProgressPanel label="Applying rotations" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="Rotation applied"
          summary="The rotated document is ready. The source file was not modified."
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Start over"
          onReset={() => {
            job.reset();
            setFile(null);
            setRotations({});
            setSelected(new Set());
            setErrors([]);
          }}
        />
      ) : null}
    </ToolShell>
  );
}
