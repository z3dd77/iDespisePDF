import { PdfToolkitError } from "./errors";
import { assertRasterPageCount } from "./limits";
import { normalizeSelection } from "./pages";
import { JPEG_QUALITY } from "./presets";
import {
  canvasToBlob,
  openPdfDocument,
  releaseCanvas,
  renderPageToCanvas,
  yieldToUi,
} from "./raster";
import type {
  ProcessedFile,
  ProcessingResult,
  ProgressReporter,
  RasterFormat,
} from "./types";

export type PdfToImagesOptions = {
  pages: readonly number[];
  format: RasterFormat;
  scale: number;
  quality?: number;
};

const EXTENSIONS: Record<RasterFormat, string> = {
  png: "png",
  jpeg: "jpg",
};

const MIME_TYPES: Record<RasterFormat, "image/png" | "image/jpeg"> = {
  png: "image/png",
  jpeg: "image/jpeg",
};

/** Render selected pages to PNG or JPEG files. */
export async function pdfToImages(
  bytes: Uint8Array,
  options: PdfToImagesOptions,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount, destroy } = await openPdfDocument(bytes);

  try {
    const selected = normalizeSelection(options.pages, pageCount);
    assertRasterPageCount(selected.length);

    const quality = options.quality ?? JPEG_QUALITY;
    const files: ProcessedFile[] = [];
    let reducedPages = 0;
    const digits = String(selected[selected.length - 1]).length;

    for (const [index, pageNumber] of selected.entries()) {
      const rendered = await renderPageToCanvas(doc, pageNumber, options.scale);
      const blob = await canvasToBlob(rendered.canvas, options.format, quality);
      releaseCanvas(rendered.canvas);

      if (rendered.scaledDown) {
        reducedPages += 1;
      }

      files.push({
        fileName: `page-${String(pageNumber).padStart(digits, "0")}.${
          EXTENSIONS[options.format]
        }`,
        mimeType: MIME_TYPES[options.format],
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });

      onProgress?.({ completed: index + 1, total: selected.length });
      await yieldToUi();
    }

    return {
      files,
      notes: [
        `Rendered ${files.length} ${files.length === 1 ? "page" : "pages"} at ${Math.round(
          options.scale * 72,
        )} dpi as ${options.format === "png" ? "PNG" : "JPEG"}.`,
        ...(reducedPages > 0
          ? [
              `${reducedPages} ${
                reducedPages === 1 ? "large page was" : "large pages were"
              } rendered below the requested resolution to stay within browser canvas limits.`,
            ]
          : []),
        "Images are raster output: text in them is no longer selectable.",
        files.length > 1
          ? "Multiple downloads are triggered one at a time. Your browser may ask permission for multiple files."
          : "One file was produced.",
      ],
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
