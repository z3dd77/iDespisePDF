
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { PdfToolkitError } from "./errors";
import type { PDFDocument } from "@cantoo/pdf-lib";

/** Unlock a password‑protected PDF (requires correct password). */
export async function unlockPdf(
  bytes: Uint8Array,
  password: string,
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  // pdf-lib can load with password
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { password });
  } catch (e) {
    throw new PdfToolkitError("wrong-password", "Password is incorrect or PDF is not encrypted");
  }
  // Re‑save without encryption
  const output = await doc.save();
  onProgress?.({ completed: 1, total: 1 });
  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-unlocked.pdf`,
        mimeType: "application/pdf",
        bytes: new Uint8Array(output),
        pageCount: doc.getPageCount(),
      },
    ],
    notes: [
      `PDF decrypted using provided password.`,
    ],
  };
}
