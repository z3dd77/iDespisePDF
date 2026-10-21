import { addRotation } from "./pages";
import { loadPdf, savePdf } from "./read";
import type { ProcessingResult, ProgressReporter, RotationAngle } from "./types";
import { stripExtension } from "./validate";

/** Rotations keyed by 1-based page number. Missing pages are left untouched. */
export type PageRotations = Partial<Record<number, RotationAngle>>;

/**
 * Rotate pages without re-rendering. Rotation is additive against any
 * orientation the page already carries.
 */
export async function rotatePdf(
  bytes: Uint8Array,
  rotations: PageRotations,
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);
  const { degrees } = await import("@cantoo/pdf-lib");

  const entries = Object.entries(rotations)
    .map(([page, angle]) => ({ page: Number(page), angle: angle ?? 0 }))
    .filter((entry) => entry.angle !== 0);

  if (entries.length === 0) {
    const { PdfToolkitError } = await import("./errors");
    throw new PdfToolkitError("empty-selection", "no rotation requested");
  }

  let changed = 0;

  for (const entry of entries) {
    if (entry.page < 1 || entry.page > pageCount) {
      const { PdfToolkitError } = await import("./errors");
      throw new PdfToolkitError(
        "out-of-range",
        `page ${entry.page} exceeds ${pageCount}`,
      );
    }

    const page = doc.getPage(entry.page - 1);
    const next = addRotation(page.getRotation().angle, entry.angle);
    page.setRotation(degrees(next));
    changed += 1;
  }

  onProgress?.({ completed: changed, total: entries.length });

  const output = await savePdf(doc);

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-rotated.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      `Rotated ${changed} ${changed === 1 ? "page" : "pages"}. Existing page orientation was preserved and combined with the new angle.`,
      "Page content was not re-encoded, so text and vectors are unchanged.",
    ],
  };
}
