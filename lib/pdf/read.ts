import type { PDFDocument } from "@cantoo/pdf-lib";

import { PdfToolkitError, isPdfToolkitError } from "./errors";
import { MAX_PAGE_COUNT } from "./limits";
import { assertPdfBytes } from "./validate";

/**
 * The single entry point for opening a PDF. Every library failure is mapped to
 * a PdfToolkitError here so components never see raw pdf-lib messages.
 */

export type LoadedPdf = {
  doc: PDFDocument;
  pageCount: number;
};

export function toPdfToolkitError(error: unknown): PdfToolkitError {
  if (isPdfToolkitError(error)) {
    return error;
  }

  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);

  if (/encrypted\s+pdf/i.test(message) || /pdf\s+is\s+encrypted/i.test(message) || name === "EncryptedPdfError") {
    return new PdfToolkitError("encrypted", "library reported encryption");
  }

  if (/password/i.test(message)) {
    return new PdfToolkitError("wrong-password", "password rejected");
  }

  if (/invalid|trailer|header|parse|unexpected|expected instance|eof/i.test(message)) {
    return new PdfToolkitError("corrupt", name || "parse failure");
  }

  // Details are kept short and structural: never document content.
  return new PdfToolkitError("unknown", name || message.slice(0, 120));
}

export async function loadPdf(
  bytes: Uint8Array,
  options: { password?: string } = {},
): Promise<LoadedPdf> {
  assertPdfBytes("file", bytes);

  const { PDFDocument } = await import("@cantoo/pdf-lib");

  let doc: PDFDocument;

  try {
    doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      password: options.password,
    });
  } catch (error) {
    throw toPdfToolkitError(error);
  }

  if (doc.isEncrypted && !options.password) {
    throw new PdfToolkitError("encrypted");
  }

  let pageCount: number;

  try {
    // A damaged page tree can survive load() and fail here instead.
    pageCount = doc.getPageCount();
  } catch (error) {
    throw new PdfToolkitError(
      "corrupt",
      error instanceof Error ? error.name : "unreadable page tree",
    );
  }

  if (pageCount < 1) {
    throw new PdfToolkitError("empty-file", "document has no pages");
  }

  if (pageCount > MAX_PAGE_COUNT) {
    throw new PdfToolkitError(
      "too-many-pages",
      `${pageCount} pages exceeds ${MAX_PAGE_COUNT}`,
    );
  }

  return { doc, pageCount };
}

export async function savePdf(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}
