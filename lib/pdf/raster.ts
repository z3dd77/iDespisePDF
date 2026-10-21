import { PdfToolkitError } from "./errors";
import {
  MAX_CANVAS_SIDE,
  MAX_OUTPUT_PIXELS,
  MAX_THUMBNAIL_PAGES,
  THUMBNAIL_WIDTH,
} from "./limits";
import type { JobProgress, RasterFormat } from "./types";

/**
 * Browser-only rasterization via PDF.js.
 *
 * PDF.js is imported lazily and its worker is served from /pdf.worker.min.mjs,
 * which scripts/sync-pdf-assets.mjs copies out of node_modules. Nothing here
 * touches the network with document bytes.
 */

type PdfJsModule = typeof import("pdfjs-dist");
type PdfJsDocument = Awaited<
  ReturnType<PdfJsModule["getDocument"]>["promise"]
>;

let pdfJsPromise: Promise<PdfJsModule> | null = null;

export function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }

  return pdfJsPromise;
}

function mapRenderError(error: unknown): PdfToolkitError {
  if (error instanceof PdfToolkitError) {
    return error;
  }

  const name = error instanceof Error ? error.name : "";

  if (name === "PasswordException") {
    return new PdfToolkitError("encrypted", "PDF.js requires a password");
  }

  if (name === "InvalidPDFException") {
    return new PdfToolkitError("corrupt", "PDF.js rejected the document");
  }

  return new PdfToolkitError("render-failed", name || "render failure");
}

export type OpenRasterDocument = {
  doc: PdfJsDocument;
  pageCount: number;
  destroy: () => Promise<void>;
};

export async function openPdfDocument(
  bytes: Uint8Array,
): Promise<OpenRasterDocument> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableAutoFetch: true,
  });

  try {
    const doc = await loadingTask.promise;
    return {
      doc,
      pageCount: doc.numPages,
      destroy: async () => {
        await loadingTask.destroy().catch(() => undefined);
      },
    };
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    throw mapRenderError(error);
  }
}

export type RenderedPage = {
  canvas: HTMLCanvasElement;
  /** Page size in PDF points, independent of the render scale. */
  widthPt: number;
  heightPt: number;
  /** DPI actually used after fitting the canvas budgets. */
  effectiveDpi: number;
  /** True when the requested scale had to be reduced for this page. */
  scaledDown: boolean;
};

/**
 * Fits a requested scale inside the canvas area and side budgets.
 *
 * Pages that exceed a budget are rendered at a lower effective resolution
 * instead of failing the whole job. That is what keeps very large pages from
 * producing blank canvases on browsers with tighter limits than Chrome.
 */
export function clampRenderScale(
  widthPt: number,
  heightPt: number,
  requestedScale: number,
): number {
  const width = Math.max(1, widthPt);
  const height = Math.max(1, heightPt);
  const areaScale = Math.sqrt(MAX_OUTPUT_PIXELS / (width * height));
  const sideScale = MAX_CANVAS_SIDE / Math.max(width, height);

  return Math.min(requestedScale, areaScale, sideScale);
}

let contentOperatorCodes: Set<number> | null = null;

/**
 * Text and image operators only. A page whose sole content is a white fill is
 * a legitimate blank page, so paint operators are not enough to call a blank
 * canvas a failed render.
 */
function getContentOperatorCodes(ops: PdfJsModule["OPS"]): Set<number> {
  contentOperatorCodes ??= new Set([
    ops.showText,
    ops.showSpacedText,
    ops.nextLineShowText,
    ops.nextLineSetSpacingShowText,
    ops.paintImageXObject,
    ops.paintImageXObjectRepeat,
    ops.paintXObject,
    ops.paintInlineImageXObject,
    ops.paintInlineImageXObjectGroup,
    ops.paintImageMaskXObject,
    ops.paintImageMaskXObjectRepeat,
    ops.paintImageMaskXObjectGroup,
  ]);

  return contentOperatorCodes;
}

/**
 * Cheap content probe: downscaling averages the page, so a single glyph or a
 * thin line is still visible as a non-white pixel. A page that comes back pure
 * white despite having paint operators is a failed render, not a blank page.
 */
function canvasHasContent(canvas: HTMLCanvasElement): boolean {
  const probe = document.createElement("canvas");
  probe.width = 64;
  probe.height = 64;

  const context = probe.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return true;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, probe.width, probe.height);
  context.drawImage(canvas, 0, 0, probe.width, probe.height);

  const { data } = context.getImageData(0, 0, probe.width, probe.height);
  releaseCanvas(probe);

  for (let index = 0; index < data.length; index += 4) {
    if (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250) {
      return true;
    }
  }

  return false;
}

export async function renderPageToCanvas(
  doc: PdfJsDocument,
  pageNumber: number,
  scale: number,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);

  try {
    const baseViewport = page.getViewport({ scale: 1 });
    const widthPt = baseViewport.width;
    const heightPt = baseViewport.height;
    const effectiveScale = clampRenderScale(widthPt, heightPt, scale);
    const viewport = page.getViewport({ scale: effectiveScale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new PdfToolkitError("render-failed", "no 2d context");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const operatorList = await page.getOperatorList().catch(() => null);
    await page.render({ canvas, viewport }).promise;

    if (operatorList) {
      const { OPS } = await loadPdfJs();
      const contentCodes = getContentOperatorCodes(OPS);
      const hasContent = operatorList.fnArray.some((code) =>
        contentCodes.has(code),
      );

      if (hasContent && !canvasHasContent(canvas)) {
        throw new PdfToolkitError(
          "render-failed",
          `page ${pageNumber} rendered blank`,
        );
      }
    }

    return {
      canvas,
      widthPt,
      heightPt,
      effectiveDpi: effectiveScale * 72,
      scaledDown: effectiveScale < scale - 1e-9,
    };
  } finally {
    page.cleanup();
  }
}

export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: RasterFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new PdfToolkitError("render-failed", "canvas encoding failed"));
        }
      },
      format === "jpeg" ? "image/jpeg" : "image/png",
      quality,
    );
  });
}

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export type ThumbnailResult = {
  pageCount: number;
  /** Data URLs. Empty beyond MAX_THUMBNAIL_PAGES. */
  thumbnails: string[];
  truncated: boolean;
};

type PdfJsPage = Awaited<ReturnType<PdfJsDocument["getPage"]>>;

async function pageToThumbnail(page: PdfJsPage): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = THUMBNAIL_WIDTH / base.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new PdfToolkitError("render-failed", "no 2d context");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
  releaseCanvas(canvas);

  return dataUrl;
}

export async function renderThumbnails(
  bytes: Uint8Array,
  onProgress?: (progress: JobProgress) => void,
): Promise<ThumbnailResult> {
  const { doc, pageCount, destroy } = await openPdfDocument(bytes);
  const total = Math.min(pageCount, MAX_THUMBNAIL_PAGES);
  const thumbnails: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);

      try {
        thumbnails.push(await pageToThumbnail(page));
      } finally {
        page.cleanup();
      }

      onProgress?.({ completed: pageNumber, total });
      await yieldToUi();
    }
  } finally {
    await destroy();
  }

  return { pageCount, thumbnails, truncated: pageCount > total };
}

export type CoverThumbnail = {
  pageCount: number;
  dataUrl: string;
};

/**
 * Renders only page 1. Merge uses this per input file, where rendering every
 * page would multiply work by files x pages.
 */
export async function renderCoverThumbnail(
  bytes: Uint8Array,
): Promise<CoverThumbnail> {
  const { doc, pageCount, destroy } = await openPdfDocument(bytes);

  try {
    const page = await doc.getPage(1);

    try {
      return { pageCount, dataUrl: await pageToThumbnail(page) };
    } finally {
      page.cleanup();
    }
  } finally {
    await destroy();
  }
}
