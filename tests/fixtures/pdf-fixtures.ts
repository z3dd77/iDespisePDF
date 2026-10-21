import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";

/**
 * Shared fixtures. Everything here runs in both Node and Chromium, so it must
 * not depend on Buffer or fs.
 */

export type PageSizeTuple = [number, number];

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/** 1x1 PNG with an alpha channel. */
export const PNG_1X1 = base64ToBytes(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
);

/** 1x1 baseline JPEG. */
export const JPEG_1X1 = base64ToBytes(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
);

/** Build a valid PDF with one page per size, each carrying identifying text. */
export async function makePdf(
  sizes: readonly PageSizeTuple[],
  label = "fixture",
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const [width, height] of sizes) {
    const page = doc.addPage([width, height]);
    page.drawText(`${label} ${width}x${height}`, {
      x: 16,
      y: Math.max(16, height - 24),
      size: 10,
      font,
    });
  }

  return doc.save();
}

/** Page dimensions as rounded integers, in document order. */
export async function pageSizesOf(
  bytes: Uint8Array,
): Promise<PageSizeTuple[]> {
  const doc = await PDFDocument.load(bytes);

  return doc
    .getPages()
    .map(
      (page) =>
        [Math.round(page.getWidth()), Math.round(page.getHeight())] as PageSizeTuple,
    );
}

export async function pageRotationsOf(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getRotation().angle);
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((byte, index) => byte === right[index]);
}
