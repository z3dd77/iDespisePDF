import { expect } from "vitest";

import { isPdfToolkitError, type PdfErrorCode } from "@/lib/pdf/errors";

export function expectPdfErrorSync(
  task: () => unknown,
  code: PdfErrorCode,
): void {
  try {
    task();
  } catch (error) {
    expect(isPdfToolkitError(error)).toBe(true);

    if (isPdfToolkitError(error)) {
      expect(error.code).toBe(code);
    }

    return;
  }

  throw new Error(`Expected PdfToolkitError(${code}) but the call succeeded`);
}

export async function expectPdfError(
  task: () => Promise<unknown>,
  code: PdfErrorCode,
): Promise<void> {
  try {
    await task();
  } catch (error) {
    expect(isPdfToolkitError(error)).toBe(true);

    if (isPdfToolkitError(error)) {
      expect(error.code).toBe(code);
    }

    return;
  }

  throw new Error(`Expected PdfToolkitError(${code}) but the call resolved`);
}
