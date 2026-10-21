/**
 * Validation and failure vocabulary for PDF work.
 *
 * Every expected failure mode gets a code and a message written for a person,
 * so the UI never has to invent copy or surface a raw library error.
 */

export type PdfErrorCode =
  | "unsupported-type"
  | "not-a-pdf"
  | "not-an-image"
  | "encrypted"
  | "wrong-password"
  | "corrupt"
  | "empty-file"
  | "too-large"
  | "too-many-pages"
  | "too-many-files"
  | "not-enough-files"
  | "empty-selection"
  | "out-of-range"
  | "invalid-range"
  | "unsupported-image"
  | "protection-failed"
  | "render-failed"
  | "no-result"
  | "unknown";

export const PDF_ERROR_MESSAGES: Record<PdfErrorCode, string> = {
  "unsupported-type": "That file type isn't supported by this tool.",
  "not-a-pdf": "This file isn't a valid PDF.",
  "not-an-image": "That file isn't a PNG or JPEG image.",
  encrypted:
    "This PDF is password protected. Remove the password first, then try again.",
  "wrong-password": "That password doesn't open this PDF.",
  corrupt: "This PDF appears to be damaged and couldn't be read.",
  "empty-file": "That file is empty.",
  "too-large": "This file is too large to process safely in the browser.",
  "too-many-pages":
    "This document has more pages than this tool can handle safely.",
  "too-many-files": "That's more files than this tool accepts in one run.",
  "not-enough-files": "Add at least two PDF files to merge.",
  "empty-selection": "Select at least one page to continue.",
  "out-of-range": "The selected pages don't exist in this document.",
  "invalid-range":
    "Use page numbers or ranges like 1-3, 5, 8-10. Pages must be within the document.",
  "unsupported-image": "Use a PNG or JPEG image for this tool.",
  "protection-failed": "This PDF couldn't be encrypted. Nothing was changed.",
  "render-failed": "A page couldn't be rendered for preview or export.",
  "no-result": "No output was produced.",
  unknown: "Something went wrong while processing this file.",
};

export class PdfToolkitError extends Error {
  readonly code: PdfErrorCode;
  readonly detail?: string;

  constructor(code: PdfErrorCode, detail?: string) {
    super(PDF_ERROR_MESSAGES[code]);
    this.name = "PdfToolkitError";
    this.code = code;
    this.detail = detail;
  }
}

export function isPdfToolkitError(value: unknown): value is PdfToolkitError {
  return value instanceof PdfToolkitError;
}
