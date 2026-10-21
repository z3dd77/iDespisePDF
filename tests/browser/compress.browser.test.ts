import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { describe, expect, it } from "vitest";

import { compressPdf, compressPdfs } from "@/lib/pdf/compress";
import { protectPdf } from "@/lib/pdf/protect";
import {
  openPdfDocument,
  releaseCanvas,
  renderPageToCanvas,
} from "@/lib/pdf/raster";
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

/**
 * A photo page, a text page, and an oversized page. At the Screen preset the
 * oversized page lands above the old 24 MP ceiling only because of its size,
 * so it exercises the adaptive scale and the resolution note.
 */
async function makeMixedLargePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pngBytes = await makeNoisePng(1600, 2000);
  const png = await doc.embedPng(pngBytes);

  const photo = doc.addPage([1600, 2000]);
  photo.drawImage(png, { x: 0, y: 0, width: 1600, height: 2000 });

  const text = doc.addPage([595, 842]);
  text.drawText("fine detail stays visible", {
    x: 40,
    y: 700,
    size: 12,
    font,
  });

  const oversized = doc.addPage([3200, 4000]);
  oversized.drawImage(png, { x: 0, y: 0, width: 3200, height: 4000 });

  return doc.save({ useObjectStreams: false });
}

/** Distinct luminance bands in a 64x64 probe; a flat page scores 1. */
function detailLevels(canvas: HTMLCanvasElement): number {
  const probe = document.createElement("canvas");
  probe.width = 64;
  probe.height = 64;

  const context = probe.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("2d context unavailable");
  }

  context.drawImage(canvas, 0, 0, probe.width, probe.height);
  const { data } = context.getImageData(0, 0, probe.width, probe.height);
  const levels = new Set<number>();

  for (let index = 0; index < data.length; index += 4) {
    levels.add(
      Math.round(
        (data[index] + data[index + 1] + data[index + 2]) / 3 / 8,
      ),
    );
  }

  return levels.size;
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

  it("keeps every page of a mixed large document and reports the reduced resolution", async () => {
    const pdf = await makeMixedLargePdf();
    const outcome = await compressPdf(pdf, "screen", "mixed.pdf");

    if (outcome.status !== "smaller") {
      throw new Error(
        `Expected a smaller output, got ${outcome.status} (${outcome.originalBytes} -> ${outcome.outputBytes})`,
      );
    }

    const notes = outcome.notes.join(" ");
    expect(notes).toContain("large page");
    expect(notes).toContain("below 96 dpi");

    const rebuilt = await PDFDocument.load(outcome.file.bytes);
    expect(rebuilt.getPageCount()).toBe(3);
    expect(Math.round(rebuilt.getPage(0).getWidth())).toBe(1600);
    expect(Math.round(rebuilt.getPage(1).getWidth())).toBe(595);
    expect(Math.round(rebuilt.getPage(2).getWidth())).toBe(3200);

    const { doc, destroy } = await openPdfDocument(outcome.file.bytes);

    try {
      for (let pageNumber = 1; pageNumber <= 3; pageNumber += 1) {
        const rendered = await renderPageToCanvas(doc, pageNumber, 1);

        expect(rendered.scaledDown).toBe(false);
        expect(detailLevels(rendered.canvas)).toBeGreaterThanOrEqual(2);
        releaseCanvas(rendered.canvas);
      }
    } finally {
      await destroy();
    }
  });
});

describe("compressPdfs", () => {
  it("compresses multiple files and keeps their outputs", async () => {
    const first = await makeNoisyImagePdf([[600, 800]]);
    const second = await makeNoisyImagePdf([[800, 600]]);

    const outcome = await compressPdfs(
      [
        { name: "first.pdf", bytes: first },
        { name: "second.pdf", bytes: second },
      ],
      "screen",
    );

    expect(outcome.files.map((file) => file.fileName)).toEqual([
      "first-compressed.pdf",
      "second-compressed.pdf",
    ]);
    expect(outcome.skipped).toHaveLength(0);
    expect(outcome.inputCount).toBe(2);
    expect(outcome.processedCount).toBe(2);
    expect(outcome.comparison?.after).toBeLessThan(
      outcome.comparison?.before ?? 0,
    );
    expect(outcome.notes.join(" ")).toContain("Compressed 2 of 2 files");
  });

  it("keeps successful outputs when one file cannot shrink", async () => {
    const photo = await makeNoisyImagePdf();
    const text = await makePdf([[595, 842]], "text only");

    const outcome = await compressPdfs(
      [
        { name: "photo.pdf", bytes: photo },
        { name: "text.pdf", bytes: text },
      ],
      "screen",
    );

    expect(outcome.files.map((file) => file.fileName)).toEqual([
      "photo-compressed.pdf",
    ]);
    expect(outcome.skipped).toEqual([
      { fileName: "text.pdf", reason: expect.stringContaining("Not smaller") },
    ]);
    expect(outcome.notes.join(" ")).toContain("text.pdf");
    expect(outcome.notes.join(" ")).toContain("Size totals cover only");
  });

  it("skips an encrypted file and continues with the rest", async () => {
    const photo = await makeNoisyImagePdf();
    const plain = await makePdf([[200, 300]]);
    const { files } = await protectPdf(
      plain,
      { userPassword: "secret" },
      "locked.pdf",
    );

    const outcome = await compressPdfs(
      [
        { name: "locked.pdf", bytes: files[0].bytes },
        { name: "photo.pdf", bytes: photo },
      ],
      "screen",
    );

    expect(outcome.files.map((file) => file.fileName)).toEqual([
      "photo-compressed.pdf",
    ]);
    expect(outcome.skipped).toHaveLength(1);
    expect(outcome.skipped[0].fileName).toBe("locked.pdf");
    expect(outcome.skipped[0].reason).toContain("password protected");
    expect(outcome.processedCount).toBe(1);
  });

  it("skips a document above the page limit and continues", async () => {
    const photo = await makeNoisyImagePdf();
    const largePages: [number, number][] = Array.from(
      { length: 121 },
      () => [200, 300],
    );
    const large = await makePdf(largePages);

    const outcome = await compressPdfs(
      [
        { name: "large.pdf", bytes: large },
        { name: "photo.pdf", bytes: photo },
      ],
      "screen",
    );

    expect(outcome.files.map((file) => file.fileName)).toEqual([
      "photo-compressed.pdf",
    ]);
    expect(outcome.skipped[0].fileName).toBe("large.pdf");
    expect(outcome.skipped[0].reason).toContain("120-page");
    expect(outcome.processedCount).toBe(1);
  });

  it("gives duplicate base names distinct output files", async () => {
    const first = await makeNoisyImagePdf([[600, 800]]);
    const second = await makeNoisyImagePdf([[800, 600]]);

    const outcome = await compressPdfs(
      [
        { name: "scan.pdf", bytes: first },
        { name: "scan.pdf", bytes: second },
      ],
      "screen",
    );

    expect(outcome.files.map((file) => file.fileName)).toEqual([
      "scan-compressed.pdf",
      "scan-compressed (2).pdf",
    ]);
  });

  it("reports file-level progress", async () => {
    const first = await makeNoisyImagePdf([[600, 800]]);
    const second = await makeNoisyImagePdf([[800, 600]]);
    const updates: { completed: number; total: number }[] = [];

    await compressPdfs(
      [
        { name: "a.pdf", bytes: first },
        { name: "b.pdf", bytes: second },
      ],
      "screen",
      (progress) => updates.push(progress),
    );

    expect(updates[0]).toEqual({ completed: 0, total: 2 });
    expect(updates.at(-1)).toEqual({ completed: 2, total: 2 });
    expect(updates.some((progress) => progress.completed === 1)).toBe(true);
  });

  it("passes page-level progress through for a single file", async () => {
    const pdf = await makeNoisyImagePdf([
      [600, 800],
      [800, 600],
    ]);
    const updates: { completed: number; total: number }[] = [];

    await compressPdfs(
      [{ name: "one.pdf", bytes: pdf }],
      "screen",
      (progress) => updates.push(progress),
    );

    expect(updates.at(-1)).toEqual({ completed: 2, total: 2 });
    expect(updates.some((progress) => progress.completed === 1)).toBe(true);
  });

  it("keeps single-file notes and comparison", async () => {
    const pdf = await makeNoisyImagePdf();

    const outcome = await compressPdfs(
      [{ name: "photo.pdf", bytes: pdf }],
      "screen",
    );

    expect(outcome.files).toHaveLength(1);
    expect(outcome.comparison).not.toBeNull();
    expect(outcome.notes.join(" ")).toContain("Reduced by");
  });

  it("keeps the single-file not-smaller notes", async () => {
    const pdf = await makePdf([[595, 842]], "text only");

    const outcome = await compressPdfs(
      [{ name: "text.pdf", bytes: pdf }],
      "screen",
    );

    expect(outcome.files).toHaveLength(0);
    expect(outcome.processedCount).toBe(1);
    expect(outcome.notes.join(" ")).toContain("No smaller file was produced");
  });
});
