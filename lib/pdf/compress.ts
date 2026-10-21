import { formatBytes } from "@/lib/format";

import {
  PDF_ERROR_MESSAGES,
  PdfToolkitError,
  isPdfToolkitError,
} from "./errors";
import { MAX_RASTER_PAGES, assertRasterPageCount } from "./limits";
import { getCompressionPreset, type CompressionPresetId } from "./presets";
import {
  canvasToBlob,
  openPdfDocument,
  releaseCanvas,
  renderPageToCanvas,
  yieldToUi,
} from "./raster";
import type {
  CompressionBatchOutcome,
  CompressionOutcome,
  CompressionSkip,
  CompressionStatus,
  PdfInput,
  ProcessedFile,
  ProgressReporter,
} from "./types";
import { stripExtension } from "./validate";

/**
 * Compression by re-rasterization.
 *
 * This is the only browser-side method that reliably reduces size, and it has a
 * real cost: text, links, annotations, and accessibility data are replaced by
 * pixels. The UI states that before running, and the outcome refuses to call a
 * larger file "compressed".
 */

export function decideCompression(
  originalBytes: number,
  outputBytes: number,
): CompressionStatus {
  return outputBytes < originalBytes ? "smaller" : "not-smaller";
}

const DESTRUCTIVE_NOTES: readonly string[] = [
  "Selectable text, links, annotations, form fields, and bookmarks were replaced by page images.",
  "Accessibility information such as reading order and alt text did not survive.",
];

export async function compressPdf(
  bytes: Uint8Array,
  presetId: CompressionPresetId,
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<CompressionOutcome> {
  const preset = getCompressionPreset(presetId);
  const originalBytes = bytes.length;
  const { doc, pageCount, destroy } = await openPdfDocument(bytes);

  try {
    assertRasterPageCount(pageCount);

    const { PDFDocument } = await import("@cantoo/pdf-lib");
    const output = await PDFDocument.create();
    const scale = preset.dpi / 72;
    let reducedPageCount = 0;
    let lowestDpi = preset.dpi;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const rendered = await renderPageToCanvas(doc, pageNumber, scale);
      const blob = await canvasToBlob(rendered.canvas, "jpeg", preset.quality);
      const jpegBytes = new Uint8Array(await blob.arrayBuffer());
      releaseCanvas(rendered.canvas);

      if (rendered.scaledDown) {
        reducedPageCount += 1;
        lowestDpi = Math.min(lowestDpi, rendered.effectiveDpi);
      }

      const image = await output.embedJpg(jpegBytes);
      const page = output.addPage([rendered.widthPt, rendered.heightPt]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: rendered.widthPt,
        height: rendered.heightPt,
      });

      onProgress?.({ completed: pageNumber, total: pageCount });
      await yieldToUi();
    }

    const outputBytes = (await output.save({ useObjectStreams: true })).length;
    const status = decideCompression(originalBytes, outputBytes);
    const sizeNote = `Original ${formatBytes(originalBytes)}, rebuilt at ${preset.dpi} dpi ${formatBytes(outputBytes)}.`;
    const resolutionNote =
      reducedPageCount > 0
        ? `${reducedPageCount} large ${
            reducedPageCount === 1 ? "page was" : "pages were"
          } rendered below ${preset.dpi} dpi (lowest ${Math.round(
            lowestDpi,
          )} dpi) to stay within browser canvas limits; ${
            reducedPageCount === 1 ? "that page has" : "those pages have"
          } less detail.`
        : null;

    if (status === "not-smaller") {
      return {
        status,
        originalBytes,
        outputBytes,
        notes: [
          "No smaller file was produced, so nothing is offered for download. The original file is unchanged.",
          sizeNote,
          ...(resolutionNote ? [resolutionNote] : []),
          ...DESTRUCTIVE_NOTES,
        ],
      };
    }

    const saved = originalBytes - outputBytes;
    const percent = Math.round((saved / originalBytes) * 100);

    return {
      status,
      originalBytes,
      outputBytes,
      notes: [
        `Reduced by ${formatBytes(saved)} (${percent}% smaller).`,
        sizeNote,
        ...(resolutionNote ? [resolutionNote] : []),
        ...DESTRUCTIVE_NOTES,
      ],
      file: {
        fileName: `${stripExtension(fileName)}-compressed.pdf`,
        mimeType: "application/pdf",
        bytes: await output.save({ useObjectStreams: true }),
        pageCount,
      },
    };
  } catch (error) {
    if (error instanceof PdfToolkitError) {
      throw error;
    }

    const { toPdfToolkitError } = await import("./read");
    throw toPdfToolkitError(error);
  } finally {
    await destroy();
  }
}

/** Kept for the tool UI to describe the pipeline without running it. */
export function compressionSummary(presetId: CompressionPresetId): string {
  const preset = getCompressionPreset(presetId);
  return `${preset.label}: ${preset.dpi} dpi, JPEG quality ${Math.round(
    preset.quality * 100,
  )}%.`;
}

function describeCompressionFailure(error: unknown): string {
  if (!isPdfToolkitError(error)) {
    return PDF_ERROR_MESSAGES.unknown;
  }

  if (error.code === "too-many-pages") {
    return `This file exceeds the ${MAX_RASTER_PAGES}-page compression limit.`;
  }

  return error.message;
}

function uniqueOutputName(fileName: string, used: Set<string>): string {
  const key = fileName.toLowerCase();

  if (!used.has(key)) {
    used.add(key);
    return fileName;
  }

  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";
  let counter = 2;

  while (used.has(`${stem} (${counter})${extension}`.toLowerCase())) {
    counter += 1;
  }

  const next = `${stem} (${counter})${extension}`;
  used.add(next.toLowerCase());
  return next;
}

function buildBatchNotes({
  files,
  skipped,
  inputCount,
  processedCount,
  before,
  after,
}: {
  files: readonly ProcessedFile[];
  skipped: readonly CompressionSkip[];
  inputCount: number;
  processedCount: number;
  before: number;
  after: number;
}): string[] {
  const notes: string[] = [];

  if (files.length > 0) {
    notes.push(
      `Compressed ${files.length} of ${inputCount} files (${formatBytes(
        before,
      )} → ${formatBytes(after)}).`,
    );
  } else if (processedCount > 0) {
    notes.push(`None of the ${inputCount} files produced a smaller output.`);
  } else {
    notes.push("No files could be compressed.");
  }

  for (const skip of skipped) {
    notes.push(`${skip.fileName}: ${skip.reason}`);
  }

  if (files.length > 0) {
    notes.push(...DESTRUCTIVE_NOTES);

    if (skipped.length > 0) {
      notes.push(
        "Size totals cover only the files that produced a smaller output. Skipped files were not modified.",
      );
    }

    if (files.length > 1) {
      notes.push(
        "Downloads are triggered one at a time; your browser may ask permission for multiple files.",
      );
    }
  } else {
    notes.push("Nothing was replaced or altered.");
  }

  return notes;
}

/**
 * Compresses files sequentially with one preset. A file that fails or cannot
 * shrink is recorded and the run continues, so one bad input never discards
 * the successful outputs.
 */
export async function compressPdfs(
  inputs: readonly PdfInput[],
  presetId: CompressionPresetId,
  onProgress?: ProgressReporter,
): Promise<CompressionBatchOutcome> {
  const preset = getCompressionPreset(presetId);
  const files: ProcessedFile[] = [];
  const skipped: CompressionSkip[] = [];
  const usedNames = new Set<string>();
  let before = 0;
  let after = 0;
  let processedCount = 0;
  let singleNotes: readonly string[] | null = null;

  for (const [index, input] of inputs.entries()) {
    if (inputs.length > 1) {
      onProgress?.({ completed: index, total: inputs.length });
    }

    try {
      const outcome = await compressPdf(
        input.bytes,
        presetId,
        input.name,
        inputs.length === 1 ? onProgress : undefined,
      );
      processedCount += 1;

      if (outcome.status === "smaller") {
        before += outcome.originalBytes;
        after += outcome.outputBytes;
        files.push({
          ...outcome.file,
          fileName: uniqueOutputName(outcome.file.fileName, usedNames),
        });
      } else {
        skipped.push({
          fileName: input.name,
          reason: `Not smaller at ${preset.label}; the original is unchanged.`,
        });
      }

      if (inputs.length === 1) {
        singleNotes = outcome.notes;
      }
    } catch (error) {
      const reason = describeCompressionFailure(error);
      skipped.push({ fileName: input.name, reason });

      if (inputs.length === 1) {
        singleNotes = [reason];
      }
    }

    if (inputs.length > 1) {
      onProgress?.({ completed: index + 1, total: inputs.length });
    }

    await yieldToUi();
  }

  return {
    files,
    skipped,
    inputCount: inputs.length,
    processedCount,
    comparison: files.length > 0 ? { before, after } : null,
    notes:
      singleNotes ??
      buildBatchNotes({
        files,
        skipped,
        inputCount: inputs.length,
        processedCount,
        before,
        after,
      }),
  };
}

