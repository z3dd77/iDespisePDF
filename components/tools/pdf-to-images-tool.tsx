"use client";

import { useEffect, useState } from "react";
import { Images } from "lucide-react";

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
import { MAX_RASTER_PAGES } from "@/lib/pdf/limits";
import { pdfToImages } from "@/lib/pdf/pdf-to-images";
import { RASTER_SCALES } from "@/lib/pdf/presets";
import { formatPageRanges } from "@/lib/pdf/pages";
import type { ProcessingResult, RasterFormat } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("pdf-to-images");

const FORMAT_OPTIONS = [
  {
    value: "png" as const,
    label: "PNG",
    description: "Lossless, larger files. Best for sharp text and diagrams.",
  },
  {
    value: "jpeg" as const,
    label: "JPEG",
    description: "Smaller files with some compression artifacts.",
  },
];

const SCALE_OPTIONS = RASTER_SCALES.map((scale) => ({
  value: String(scale.value),
  label: scale.label,
  description: scale.description,
}));

export function PdfToImagesTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<RasterFormat>("png");
  const [scale, setScale] = useState("2");

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  useEffect(() => {
    if (!file || preview.status !== "ready") {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- default to every page once previews exist
    setSelected(
      new Set(Array.from({ length: preview.pageCount }, (_, index) => index + 1)),
    );
  }, [file, preview.status, preview.pageCount]);

  const orderedSelection = [...selected].sort((left, right) => left - right);
  const tooManySelected = orderedSelection.length > MAX_RASTER_PAGES;

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
          label="Choose a PDF to render"
          hint="Pages are rendered to images in this tab. Up to 120 pages per run."
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
                onClick={() => setSelected(new Set(orderedSelection.slice(0, MAX_RASTER_PAGES)))}
                className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-accent-strong shadow-raised-xs transition hover:shadow-raised-sm disabled:opacity-40"
              >
                Limit to first {MAX_RASTER_PAGES}
              </button>
            }
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <OptionGroup
              legend="Output format"
              name="raster-format"
              value={format}
              options={FORMAT_OPTIONS}
              onChange={setFormat}
              disabled={job.isWorking}
              columns={2}
            />
            <OptionGroup
              legend="Resolution"
              name="raster-scale"
              value={scale}
              options={SCALE_OPTIONS}
              onChange={setScale}
              disabled={job.isWorking}
            />
          </div>

          {tooManySelected ? (
            <ErrorNotice
              message={`${orderedSelection.length} pages are selected. Rendering is capped at ${MAX_RASTER_PAGES} pages per run to avoid exhausting browser memory.`}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                orderedSelection.length === 0 || tooManySelected || job.isWorking
              }
              onClick={async () => {
                if (!file) {
                  return;
                }

                await job.run((report) =>
                  pdfToImages(
                    file.bytes,
                    {
                      pages: orderedSelection,
                      format,
                      scale: Number.parseInt(scale, 10),
                    },
                    report,
                  ),
                );
              }}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Images aria-hidden="true" className="size-4" />
              {job.isWorking
                ? "Rendering…"
                : `Render ${orderedSelection.length || 0} ${
                    orderedSelection.length === 1 ? "page" : "pages"
                  }`}
            </button>

            <p className="text-xs text-ink-muted">
              Selected: {formatPageRanges(orderedSelection) || "none"}
            </p>
          </div>
        </>
      ) : null}

      {job.state.status === "working" ? (
        <ProgressPanel label="Rendering pages to images" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="Images ready"
          summary="Each selected page was rendered at the chosen resolution."
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Start over"
          onReset={() => {
            job.reset();
            setFile(null);
            setSelected(new Set());
            setErrors([]);
          }}
        />
      ) : null}
    </ToolShell>
  );
}
