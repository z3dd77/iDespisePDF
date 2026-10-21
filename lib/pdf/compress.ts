import { formatBytes } from "@/lib/format";

import { PdfToolkitError } from "./errors";
import { assertRasterPageCount } from "./limits";
import { getCompressionPreset, type CompressionPresetId } from "./presets";
import {
  canvasToBlob,
  openPdfDocument,
  releaseCanvas,
  renderPageToCanvas,
  yieldToUi,
} from "./raster";
import type {
  CompressionOutcome,
  CompressionStatus,
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

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const rendered = await renderPageToCanvas(doc, pageNumber, scale);
      const blob = await canvasToBlob(rendered.canvas, "jpeg", preset.quality);
      const jpegBytes = new Uint8Array(await blob.arrayBuffer());
      releaseCanvas(rendered.canvas);

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

    if (status === "not-smaller") {
      return {
        status,
        originalBytes,
        outputBytes,
        notes: [
          "No smaller file was produced, so nothing is offered for download. The original file is unchanged.",
          sizeNote,
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
