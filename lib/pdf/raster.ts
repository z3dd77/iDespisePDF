import { PdfToolkitError } from "./errors";
import {
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
};

export async function renderPageToCanvas(
  doc: PdfJsDocument,
  pageNumber: number,
  scale: number,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);

  try {
    const viewport = page.getViewport({ scale });
    const pixels = viewport.width * viewport.height;

    if (pixels > MAX_OUTPUT_PIXELS) {
      throw new PdfToolkitError(
        "render-failed",
        `page ${pageNumber} needs ${Math.round(pixels)} pixels`,
      );
    }

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

    return {
      canvas,
      widthPt: viewport.width / scale,
      heightPt: viewport.height / scale,
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
