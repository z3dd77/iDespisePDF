import { loadPdf, savePdf } from "./read";
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { PdfToolkitError } from "./errors";
import { StandardFonts, rgb } from "@cantoo/pdf-lib";

/**
 * Read and optionally edit PDF metadata.
 * `updates` may contain any of the standard fields; undefined fields are left untouched.
 */
export async function editMetadata(
  bytes: Uint8Array,
  updates: {
    title?: string | null;
    author?: string | null;
    subject?: string | null;
    keywords?: string | null;
  },
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);

  // Apply updates if provided
  if (updates.title !== undefined) {
    if (updates.title === null) doc.setTitle(""); else doc.setTitle(updates.title);
  }
  if (updates.author !== undefined) {
    if (updates.author === null) doc.setAuthor(""); else doc.setAuthor(updates.author);
  }
  if (updates.subject !== undefined) {
    if (updates.subject === null) doc.setSubject(""); else doc.setSubject(updates.subject);
  }
  if (updates.keywords !== undefined) {
    if (updates.keywords === null) doc.setKeywords([]); else doc.setKeywords(updates.keywords.split(","));
  }

  const output = await savePdf(doc);

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-metadata.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      `Metadata updated.`,
    ],
  };
}

/** Helper to fetch existing metadata values */
export async function readMetadata(bytes: Uint8Array): Promise<{
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
}> {
  const { doc } = await loadPdf(bytes);
  return {
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
  };
}
