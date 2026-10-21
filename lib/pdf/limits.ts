import { PdfToolkitError } from "./errors";

/**
 * Ceilings applied before any file reaches a PDF library.
 *
 * Browser memory is the real limit, and it is not predictable across devices.
 * These are deliberately conservative starting values: validation is cheaper
 * than letting a tab run out of memory mid-operation.
 */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
export const MAX_PAGE_COUNT = 2000;

/** Image intake is a separate, tighter budget than PDF intake. */
export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_IMAGE_COUNT = 60;

/** Rasterizing a whole document is the most memory-hungry operation. */
export const MAX_RASTER_PAGES = 120;
export const MAX_OUTPUT_PIXELS = 24_000_000;

/** Thumbnails stop at this count; selection still works past it. */
export const MAX_THUMBNAIL_PAGES = 200;
export const THUMBNAIL_WIDTH = 150;

/** Download URLs are revoked after this delay, not immediately. */
export const DOWNLOAD_URL_TTL_MS = 60_000;

export function assertWithinSizeLimit(bytes: number): void {
  if (bytes > MAX_FILE_BYTES) {
    throw new PdfToolkitError(
      "too-large",
      `${bytes} bytes exceeds ${MAX_FILE_BYTES} bytes`,
    );
  }
}

export function assertTotalSize(totalBytes: number): void {
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new PdfToolkitError(
      "too-large",
      `total ${totalBytes} exceeds ${MAX_TOTAL_BYTES} bytes`,
    );
  }
}

export function assertPageCount(pageCount: number): void {
  if (pageCount > MAX_PAGE_COUNT) {
    throw new PdfToolkitError(
      "too-many-pages",
      `${pageCount} pages exceeds ${MAX_PAGE_COUNT}`,
    );
  }
}

export function assertRasterPageCount(pageCount: number): void {
  if (pageCount > MAX_RASTER_PAGES) {
    throw new PdfToolkitError(
      "too-many-pages",
      `${pageCount} pages exceeds the ${MAX_RASTER_PAGES} page rasterization limit`,
    );
  }
}

export function assertImageCount(count: number): void {
  if (count > MAX_IMAGE_COUNT) {
    throw new PdfToolkitError(
      "too-many-files",
      `${count} images exceeds ${MAX_IMAGE_COUNT}`,
    );
  }
}
