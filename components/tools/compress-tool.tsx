"use client";

import { useMemo, useState } from "react";
import { Info, Minimize2 } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { FileList } from "@/components/tools/file-list";
import { OptionGroup } from "@/components/tools/option-group";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { ToolShell } from "@/components/tools/tool-shell";
import { useFileThumbnails } from "@/hooks/use-file-thumbnails";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { formatBytes, formatCount } from "@/lib/format";
import { compressPdfs } from "@/lib/pdf/compress";
import { MAX_RASTER_PAGES } from "@/lib/pdf/limits";
import { moveItem } from "@/lib/pdf/pages";
import {
  COMPRESSION_PRESETS,
  COMPRESSION_WARNINGS,
  type CompressionPresetId,
} from "@/lib/pdf/presets";
import type { CompressionBatchOutcome } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("compress");

const PRESET_OPTIONS = COMPRESSION_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
  description: preset.description,
}));

export function CompressTool() {
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [preset, setPreset] = useState<CompressionPresetId>("balanced");

  const covers = useFileThumbnails(files);
  const job = useToolJob<CompressionBatchOutcome>();

  const totalBytes = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files],
  );

  const oversizedNames = files
    .filter((file) => (covers[file.id]?.pageCount ?? 0) > MAX_RASTER_PAGES)
    .map((file) => file.name);

  const oversizedMessage =
    oversizedNames.length === 0
      ? null
      : oversizedNames.length === 1
        ? `${oversizedNames[0]} exceeds the ${MAX_RASTER_PAGES}-page limit and will be skipped.`
        : `${oversizedNames.length} files exceed the ${MAX_RASTER_PAGES}-page limit and will be skipped.`;

  const currentFile =
    job.state.status === "working" && files.length > 1
      ? files[job.state.progress?.completed ?? 0]?.name
      : undefined;

  const result = job.state.status === "done" ? job.state.result : null;
  const single = result?.inputCount === 1;
  const nothingProcessed = result !== null && result.processedCount === 0;

  async function addFiles(incoming: File[]) {
    job.reset();
    const intake = await readPdfFiles(incoming);
    setErrors(intake.errors);

    if (intake.accepted.length > 0) {
      setFiles((current) => [...current, ...intake.accepted]);
    }
  }

  return (
    <ToolShell tool={tool}>
      <section aria-labelledby="compress-files" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="compress-files" className="text-sm font-semibold text-ink">
            Files to compress
          </h2>
          <p className="text-xs text-ink-muted">
            {formatCount(files.length, "file")} · {formatBytes(totalBytes)}
          </p>
        </div>

        <FileDropZone
          accept="pdf"
          multiple
          onFiles={addFiles}
          label="Add PDFs to compress"
          hint={`Each file is compressed separately with the same preset. Processing is capped at ${MAX_RASTER_PAGES} pages per file.`}
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

        <ErrorNotice message={oversizedMessage} />
      </section>

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
        hint="The preset applies to every file in this run. Lower resolution and quality produce smaller files and looser detail."
      />

      <button
        type="button"
        disabled={files.length === 0 || job.isWorking}
        onClick={async () => {
          await job.run((report) =>
            compressPdfs(
              files.map((file) => ({ name: file.name, bytes: file.bytes })),
              preset,
              report,
            ),
          );
        }}
        className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Minimize2 aria-hidden="true" className="size-4" />
        {job.isWorking
          ? "Compressing…"
          : files.length > 1
            ? `Compress ${files.length} PDFs`
            : "Compress PDF"}
      </button>

      {job.state.status === "working" ? (
        <ProgressPanel
          label={
            currentFile
              ? `Compressing ${currentFile}`
              : "Rendering and rebuilding pages"
          }
          progress={job.state.progress}
        />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {result ? (
        result.files.length === 0 ? (
          <ResultPanel
            tone="warning"
            title={
              nothingProcessed
                ? single
                  ? "No file could be compressed"
                  : "No files could be compressed"
                : single
                  ? "No smaller file was produced"
                  : "No smaller files were produced"
            }
            summary={
              nothingProcessed
                ? "None of the selected files could be processed. Nothing was replaced or altered. The reasons are listed below."
                : single
                  ? "The rebuilt document was the same size or larger, so it is not offered as a download. Nothing was replaced or altered. Try a lower preset, or keep the original."
                  : "None of the rebuilt documents were smaller, so no downloads are offered. Nothing was replaced or altered. Try a lower preset, or keep the originals."
            }
            files={[]}
            notes={result.notes}
            resetLabel="Try another preset"
            onReset={() => job.reset()}
          />
        ) : (
          <ResultPanel
            title={
              result.files.length === 1
                ? "Smaller file ready"
                : `${result.files.length} smaller files ready`
            }
            summary={
              result.files.length === 1
                ? "The rebuilt document is smaller than the original. The original file was not modified."
                : "Each rebuilt document is smaller than its original. Original files were not modified. Files that could not shrink are listed below."
            }
            files={result.files}
            notes={result.notes}
            comparison={result.comparison}
            resetLabel={single ? "Try another file" : "Compress more files"}
            onReset={() => {
              job.reset();
              setFiles([]);
              setErrors([]);
            }}
          />
        )
      ) : null}
    </ToolShell>
  );
}
