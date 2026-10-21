import { PdfToolkitError } from "./errors";
import {
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  assertWithinSizeLimit,
} from "./limits";

/**
 * Untrusted input checks. File extensions and MIME types are hints supplied by
 * the browser; the leading bytes are the actual evidence.
 */

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

/** A PDF header is allowed to appear within the first 1 KB of the file. */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const window = bytes.subarray(0, Math.min(bytes.length, 1024));

  for (let index = 0; index <= window.length - PDF_SIGNATURE.length; index += 1) {
    if (PDF_SIGNATURE.every((byte, offset) => window[index + offset] === byte)) {
      return true;
    }
  }

  return false;
}

export function detectImageKind(bytes: Uint8Array): "png" | "jpeg" | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "png";
  }

  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "jpeg";
  }

  return null;
}

export function assertPdfBytes(name: string, bytes: Uint8Array): void {
  if (bytes.length === 0) {
    throw new PdfToolkitError("empty-file", `${name} is empty`);
  }

  assertWithinSizeLimit(bytes.length);

  if (!hasPdfSignature(bytes)) {
    throw new PdfToolkitError("not-a-pdf", `${name} has no PDF signature`);
  }
}

export function assertImageBytes(
  name: string,
  bytes: Uint8Array,
): "png" | "jpeg" {
  if (bytes.length === 0) {
    throw new PdfToolkitError("empty-file", `${name} is empty`);
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new PdfToolkitError(
      "too-large",
      `${name} exceeds the ${MAX_IMAGE_BYTES} byte image limit`,
    );
  }

  const kind = detectImageKind(bytes);

  if (!kind) {
    throw new PdfToolkitError("not-an-image", `${name} is not PNG or JPEG`);
  }

  return kind;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** PDF intake is capped per file; images have their own smaller ceiling. */
export function fileSizeLimitFor(kind: "pdf" | "image"): number {
  return kind === "pdf" ? MAX_FILE_BYTES : MAX_IMAGE_BYTES;
}
