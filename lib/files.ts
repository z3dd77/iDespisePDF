import { PdfToolkitError } from "./pdf/errors";
import { MAX_IMAGE_COUNT, MAX_TOTAL_BYTES } from "./pdf/limits";
import { assertImageBytes, assertPdfBytes } from "./pdf/validate";

export type IntakeFile = {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
};

export type IntakeResult = {
  accepted: IntakeFile[];
  errors: string[];
};

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readAll(
  files: readonly File[],
  kind: "pdf" | "image",
): Promise<IntakeResult> {
  const accepted: IntakeFile[] = [];
  const errors: string[] = [];
  let totalBytes = 0;

  for (const file of files) {
    try {
      if (kind === "image" && accepted.length >= MAX_IMAGE_COUNT) {
        throw new PdfToolkitError(
          "too-many-files",
          `more than ${MAX_IMAGE_COUNT} images`,
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());

      if (kind === "pdf") {
        assertPdfBytes(file.name, bytes);
      } else {
        assertImageBytes(file.name, bytes);
      }

      totalBytes += bytes.length;

      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new PdfToolkitError("too-large", "total upload budget exceeded");
      }

      accepted.push({
        id: createId(),
        name: file.name,
        size: bytes.length,
        bytes,
      });
    } catch (error) {
      const message =
        error instanceof PdfToolkitError
          ? error.message
          : "This file couldn't be read.";
      errors.push(`${file.name}: ${message}`);
    }
  }

  return { accepted, errors };
}

export function readPdfFiles(files: readonly File[]): Promise<IntakeResult> {
  return readAll(files, "pdf");
}

export function readImageFiles(files: readonly File[]): Promise<IntakeResult> {
  return readAll(files, "image");
}
