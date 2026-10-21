import { PDFDocument } from "@cantoo/pdf-lib";
import { describe, expect, it } from "vitest";

import { compressPdf } from "@/lib/pdf/compress";
import { makePdf } from "../fixtures/pdf-fixtures";

/**
 * A raster-heavy PDF: deterministic noise encoded as PNG. Noise is
 * effectively incompressible in PNG, so the original is large while a JPEG
 * re-render of the same page is much smaller.
 */
async function makeNoisePng(width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2d context unavailable");
  }

  const image = context.createImageData(canvas.width, canvas.height);
  let seed = 0x2f6e2b1;

  for (let index = 0; index < image.data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    image.data[index] = seed & 0xff;
    image.data[index + 1] = (seed >>> 8) & 0xff;
    image.data[index + 2] = (seed >>> 16) & 0xff;
    image.data[index + 3] = 255;
  }

  context.putImageData(image, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) {
        resolve(value);
      } else {
        reject(new Error("PNG encoding failed"));
      }
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

async function makeNoisyImagePdf(
  sizes: readonly [number, number][] = [[1200, 1600]],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const [width, height] of sizes) {
    const pngBytes = await makeNoisePng(width, height);
    const png = await doc.embedPng(pngBytes);
    const page = doc.addPage([png.width, png.height]);

    page.drawImage(png, {
      x: 0,
      y: 0,
      width: png.width,
      height: png.height,
    });
  }

  return doc.save({ useObjectStreams: false });
}

describe("compressPdf", () => {
  it("reports no-smaller for a text PDF instead of substituting the original", async () => {
    const pdf = await makePdf([[595, 842]], "text only");

    const outcome = await compressPdf(pdf, "screen", "text.pdf");

    expect(outcome.status).toBe("not-smaller");
    expect("file" in outcome).toBe(false);
    expect(outcome.outputBytes).toBeGreaterThanOrEqual(outcome.originalBytes);
    expect(outcome.notes.join(" ")).toContain("No smaller file");
    expect(outcome.notes.join(" ")).toContain("unchanged");
  });

  it("produces a smaller, valid PDF for a raster-heavy document", async () => {
    const pdf = await makeNoisyImagePdf();

    const outcome = await compressPdf(pdf, "screen", "photo.pdf");

    if (outcome.status !== "smaller") {
      throw new Error(
        `Expected a smaller output, got ${outcome.status} (${outcome.originalBytes} -> ${outcome.outputBytes})`,
      );
    }

    expect(outcome.file.fileName).toBe("photo-compressed.pdf");
    expect(outcome.file.mimeType).toBe("application/pdf");
    expect(outcome.outputBytes).toBeLessThan(outcome.originalBytes);
    expect(outcome.notes.join(" ")).toContain("smaller");

    const rebuilt = await PDFDocument.load(outcome.file.bytes);
    expect(rebuilt.getPageCount()).toBe(1);
    expect(Math.round(rebuilt.getPage(0).getWidth())).toBe(1200);
    expect(Math.round(rebuilt.getPage(0).getHeight())).toBe(1600);
  });

  it("preserves page count and order", async () => {
    const pdf = await makeNoisyImagePdf([
      [600, 800],
      [800, 600],
    ]);

    const outcome = await compressPdf(pdf, "screen", "two.pdf");

    if (outcome.status !== "smaller") {
      throw new Error(
        `Expected a smaller output, got ${outcome.status} (${outcome.originalBytes} -> ${outcome.outputBytes})`,
      );
    }

    const rebuilt = await PDFDocument.load(outcome.file.bytes);
    expect(rebuilt.getPageCount()).toBe(2);
    expect(Math.round(rebuilt.getPage(0).getHeight())).toBe(800);
    expect(Math.round(rebuilt.getPage(1).getHeight())).toBe(600);
  });
});
