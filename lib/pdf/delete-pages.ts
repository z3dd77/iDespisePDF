import { loadPdf } from "./read";
import { buildPdfFromPages } from "./build";
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { normalizeSelection } from "./pages";
import { PdfToolkitError } from "./errors";

/**
 * Remove selected pages from a PDF.
 * The output contains all pages that were **not** listed for deletion.
 */
export async function deletePages(
  bytes: Uint8Array,
  pagesToDelete: readonly number[],
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);

  // Build a set of pages to delete for fast lookup
  const toDeleteSet = new Set<number>(pagesToDelete);

  // Determine pages to keep (1‑based numbering)
  const keep: number[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    if (!toDeleteSet.has(page)) {
      keep.push(page);
    }
  }

  if (keep.length === 0) {
    // Prevent producing an empty PDF – report a clear error.
    throw new PdfToolkitError(
      "empty-selection",
      "cannot delete all pages; at least one page must remain",
    );
  }

  // Normalise (de‑duplicate & sort) just in case the caller passed duplicates/out‑of‑order.
  const selected = normalizeSelection(keep, pageCount);

  onProgress?.({ completed: 0, total: 1 });

  const output = await buildPdfFromPages(
    doc,
    selected.map((page) => page - 1),
  );

  onProgress?.({ completed: 1, total: 1 });

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-deleted.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount: selected.length,
      },
    ],
    notes: [
      `Deleted ${pagesToDelete.length} page(s) from the original ${pageCount} page document. ${selected.length} page(s) remain.`,
      "The source file is unchanged.",
    ],
  };
}
