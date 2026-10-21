import { buildPdfFromPages } from "./build";
import { normalizeSelection } from "./pages";
import { loadPdf } from "./read";
import type { ProcessingResult, ProgressReporter } from "./types";
import { stripExtension } from "./validate";

/**
 * Keep selected pages in a new document. Selection order is normalized to
 * document order so the output reads like the source.
 */
export async function extractPages(
  bytes: Uint8Array,
  pages: readonly number[],
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);
  const selected = normalizeSelection(pages, pageCount);

  onProgress?.({ completed: 0, total: 1 });

  const output = await buildPdfFromPages(
    doc,
    selected.map((page) => page - 1),
  );

  onProgress?.({ completed: 1, total: 1 });

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-extracted.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount: selected.length,
      },
    ],
    notes: [
      `Extracted ${selected.length} of ${pageCount} pages in document order. The source file was not modified.`,
    ],
  };
}
