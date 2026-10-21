import type { PDFDocument } from "@cantoo/pdf-lib";

import { savePdf } from "./read";

/** Build a fresh document from a subset of pages, preserving page content. */
export async function buildPdfFromPages(
  source: PDFDocument,
  zeroBasedIndices: readonly number[],
): Promise<Uint8Array> {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, [...zeroBasedIndices]);
  copied.forEach((page) => output.addPage(page));
  return savePdf(output);
}
