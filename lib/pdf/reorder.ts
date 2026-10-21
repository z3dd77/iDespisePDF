import { buildPdfFromPages } from "./build";
import { assertPermutation } from "./pages";
import { loadPdf } from "./read";
import type { ProcessingResult, ProgressReporter } from "./types";
import { stripExtension } from "./validate";

/**
 * Rewrite page order. `order` is a full permutation of 1..pageCount.
 */
export async function reorderPdf(
  bytes: Uint8Array,
  order: readonly number[],
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);
  assertPermutation(order, pageCount);

  onProgress?.({ completed: 0, total: 1 });

  const output = await buildPdfFromPages(
    doc,
    order.map((page) => page - 1),
  );

  onProgress?.({ completed: 1, total: 1 });

  const changed = order.some((page, index) => page !== index + 1);

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-reordered.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      changed
        ? `Reordered ${pageCount} pages. Page content was copied, not re-rendered.`
        : `The order was unchanged, so the new file matches the original page sequence.`,
    ],
  };
}
