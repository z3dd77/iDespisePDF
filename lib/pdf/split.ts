import { buildPdfFromPages } from "./build";
import { PdfToolkitError } from "./errors";
import { assertPageLimit, chunkPageRanges, expandRanges, normalizeSelection } from "./pages";
import { loadPdf } from "./read";
import type { PageRange, ProcessedFile, ProcessingResult, ProgressReporter } from "./types";
import { stripExtension } from "./validate";

/**
 * Split a document into several new documents. The source is only ever read.
 */

function fileLabel(baseName: string, pages: readonly number[]): string {
  const first = pages[0];
  const last = pages[pages.length - 1];
  return first === last
    ? `${baseName}-page-${first}.pdf`
    : `${baseName}-pages-${first}-${last}.pdf`;
}

async function splitIntoGroups(
  bytes: Uint8Array,
  baseName: string,
  groups: readonly (readonly number[])[],
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  if (groups.length === 0) {
    throw new PdfToolkitError("empty-selection", "no groups to split");
  }

  const { doc, pageCount } = await loadPdf(bytes);
  assertPageLimit(pageCount);

  const normalized = groups.map((group) => normalizeSelection(group, pageCount));
  const files: ProcessedFile[] = [];

  for (const [index, group] of normalized.entries()) {
    const output = await buildPdfFromPages(
      doc,
      group.map((page) => page - 1),
    );

    files.push({
      fileName: fileLabel(baseName, group),
      mimeType: "application/pdf",
      bytes: output,
      pageCount: group.length,
    });

    onProgress?.({ completed: index + 1, total: normalized.length });
  }

  return {
    files,
    notes: [
      `Produced ${files.length} files. The original document was not modified.`,
    ],
  };
}

export async function splitPdfByRanges(
  bytes: Uint8Array,
  ranges: readonly PageRange[],
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  if (ranges.length === 0) {
    throw new PdfToolkitError("empty-selection", "no ranges supplied");
  }

  const groups = ranges.map((range) => expandRanges([range]));
  return splitIntoGroups(bytes, stripExtension(fileName), groups, onProgress);
}

export async function splitPdfEveryN(
  bytes: Uint8Array,
  perFile: number,
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { pageCount } = await loadPdf(bytes);
  const ranges = chunkPageRanges(pageCount, perFile);
  return splitIntoGroups(
    bytes,
    stripExtension(fileName),
    ranges.map((range) => expandRanges([range])),
    onProgress,
  );
}

export async function splitPdfEachPage(
  bytes: Uint8Array,
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { pageCount } = await loadPdf(bytes);
  const groups = Array.from({ length: pageCount }, (_, index) => [index + 1]);
  return splitIntoGroups(bytes, stripExtension(fileName), groups, onProgress);
}
