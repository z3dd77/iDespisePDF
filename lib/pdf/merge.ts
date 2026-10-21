import { PdfToolkitError } from "./errors";
import { assertTotalSize } from "./limits";
import { loadPdf, savePdf } from "./read";
import type { PdfInput, ProcessingResult, ProgressReporter } from "./types";
import { stripExtension } from "./validate";

/**
 * Concatenate documents. Pages are copied, not re-encoded, so text and vectors
 * survive intact.
 */
export async function mergePdfs(
  inputs: readonly PdfInput[],
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  if (inputs.length < 2) {
    throw new PdfToolkitError("not-enough-files");
  }

  assertTotalSize(inputs.reduce((total, input) => total + input.bytes.length, 0));

  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const output = await PDFDocument.create();

  let pageTotal = 0;

  for (const [index, input] of inputs.entries()) {
    const { doc } = await loadPdf(input.bytes);
    const copied = await output.copyPages(doc, doc.getPageIndices());
    copied.forEach((page) => output.addPage(page));
    pageTotal += copied.length;
    onProgress?.({ completed: index + 1, total: inputs.length });
  }

  const bytes = await savePdf(output);

  return {
    files: [
      {
        fileName: `${stripExtension(inputs[0].name)}-merged.pdf`,
        mimeType: "application/pdf",
        bytes,
        pageCount: pageTotal,
      },
    ],
    notes: [
      `Merged ${inputs.length} files into a ${pageTotal} page PDF.`,
      "Pages were copied without re-encoding, so their text and vectors are unchanged.",
    ],
  };
}
