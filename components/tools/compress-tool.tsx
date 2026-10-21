"use client";

import { useState } from "react";
import { Info, Minimize2 } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { OptionGroup } from "@/components/tools/option-group";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { compressPdf } from "@/lib/pdf/compress";
import { MAX_RASTER_PAGES } from "@/lib/pdf/limits";
import {
  COMPRESSION_PRESETS,
  COMPRESSION_WARNINGS,
  type CompressionPresetId,
} from "@/lib/pdf/presets";
import type { CompressionOutcome } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("compress");

const PRESET_OPTIONS = COMPRESSION_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
  description: preset.description,
}));

export function CompressTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preset, setPreset] = useState<CompressionPresetId>("balanced");

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<CompressionOutcome>();

  const pageCount = preview.status === "ready" ? preview.pageCount : 0;
  const tooManyPages = pageCount > MAX_RASTER_PAGES;

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
          label="Choose a PDF to compress"
          hint="One PDF at a time. Processing is capped at 120 pages because every page has to be rendered."
        />
      ) : (
        <SelectedFileCard
          name={file.name}
          size={file.size}
          pageCount={preview.status === "ready" ? preview.pageCount : undefined}
          thumbnailUrl={
            preview.status === "ready" ? preview.thumbnails[0] : undefined
          }
          disabled={job.isWorking}
          onRemove={() => {
            job.reset();
            setFile(null);
            setErrors([]);
          }}
        />
      )}

      <ErrorList messages={errors} />

      {preview.status === "loading" ? (
        <ProgressPanel label="Reading the document" progress={preview.progress} />
      ) : null}

      {preview.status === "error" ? <ErrorNotice message={preview.message} /> : null}

      <section
        aria-labelledby="compress-tradeoff"
        className="rounded-card border border-planned-ink/25 bg-planned-bg/50 p-5 sm:p-6"
      >
        <h2
          id="compress-tradeoff"
          className="flex items-center gap-2 text-sm font-semibold text-planned-ink"
        >
          <Info aria-hidden="true" className="size-4" />
          What compression costs
        </h2>
        <ul role="list" className="mt-3 space-y-2">
          {COMPRESSION_WARNINGS.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2 text-xs leading-relaxed text-planned-ink/90"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-planned-ink"
              />
              {warning}
            </li>
          ))}
        </ul>
      </section>

      <OptionGroup
        legend="Quality preset"
        name="compression-preset"
        value={preset}
        options={PRESET_OPTIONS}
        onChange={setPreset}
        disabled={job.isWorking}
        hint="Lower resolution and quality produce smaller files and looser detail."
      />

      {tooManyPages ? (
        <ErrorNotice
          message={`This document has ${pageCount} pages. Compression is limited to ${MAX_RASTER_PAGES} pages per run because each page is rendered in memory.`}
        />
      ) : null}

      <button
        type="button"
        disabled={!file || preview.status !== "ready" || tooManyPages || job.isWorking}
        onClick={async () => {
          if (!file) {
            return;
          }

          await job.run((report) =>
            compressPdf(file.bytes, preset, file.name, report),
          );
        }}
        className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Minimize2 aria-hidden="true" className="size-4" />
        {job.isWorking ? "Compressing…" : "Compress PDF"}
      </button>

      {job.state.status === "working" ? (
        <ProgressPanel
          label="Rendering and rebuilding pages"
          progress={job.state.progress}
        />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" && job.state.result.status === "smaller" ? (
        <ResultPanel
          title="Smaller file ready"
          summary="The rebuilt document is smaller than the original. The original file was not modified."
          files={[job.state.result.file]}
          notes={job.state.result.notes}
          comparison={{
            before: job.state.result.originalBytes,
            after: job.state.result.outputBytes,
          }}
          resetLabel="Try another file"
          onReset={() => {
            job.reset();
            setFile(null);
            setErrors([]);
          }}
        />
      ) : null}

      {job.state.status === "done" && job.state.result.status === "not-smaller" ? (
        <ResultPanel
          tone="warning"
          title="No smaller file was produced"
          summary="The rebuilt document was the same size or larger, so it is not offered as a download. Nothing was replaced or altered. Try a lower preset, or keep the original."
          files={[]}
          notes={job.state.result.notes}
          comparison={{
            before: job.state.result.originalBytes,
            after: job.state.result.outputBytes,
          }}
          resetLabel="Try another preset"
          onReset={() => job.reset()}
        />
      ) : null}
    </ToolShell>
  );
}
