import { describe, expect, it } from "vitest";

import { isPdfToolkitError } from "@/lib/pdf/errors";
import { pdfToImages } from "@/lib/pdf/pdf-to-images";
import { protectPdf } from "@/lib/pdf/protect";
import {
  openPdfDocument,
  releaseCanvas,
  renderCoverThumbnail,
  renderPageToCanvas,
  renderThumbnails,
} from "@/lib/pdf/raster";
import { makePdf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

describe("PDF.js rendering", () => {
  it("renders a thumbnail for every page", async () => {
    const pdf = await makePdf([
      [200, 300],
      [300, 200],
    ]);

    const result = await renderThumbnails(pdf);

    expect(result.pageCount).toBe(2);
    expect(result.thumbnails).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(result.thumbnails[0].startsWith("data:image/jpeg")).toBe(true);
  });

  it("reports thumbnail progress", async () => {
    const pdf = await makePdf([
      [100, 100],
      [100, 100],
      [100, 100],
    ]);
    const updates: number[] = [];

    await renderThumbnails(pdf, (progress) => updates.push(progress.completed));

    expect(updates).toEqual([1, 2, 3]);
  });

  it("renders a page at the requested scale", async () => {
    const pdf = await makePdf([[200, 300]]);
    const { doc, pageCount, destroy } = await openPdfDocument(pdf);

    try {
      const rendered = await renderPageToCanvas(doc, 1, 2);

      expect(rendered.canvas.width).toBe(400);
      expect(rendered.canvas.height).toBe(600);
      expect(rendered.widthPt).toBeCloseTo(200, 5);
      expect(rendered.heightPt).toBeCloseTo(300, 5);

      const pixel = rendered.canvas
        .getContext("2d")
        ?.getImageData(200, 300, 1, 1).data;
      expect(pixel?.[3]).toBe(255);

      releaseCanvas(rendered.canvas);
      expect(rendered.canvas.width).toBe(0);
    } finally {
      await destroy();
    }

    expect(pageCount).toBe(1);
  });

  it("refuses a render above the pixel budget", async () => {
    const pdf = await makePdf([[200, 300]]);
    const { doc, destroy } = await openPdfDocument(pdf);

    try {
      await expectPdfError(
        () => renderPageToCanvas(doc, 1, 500),
        "render-failed",
      );
    } finally {
      await destroy();
    }
  });

  it("maps an encrypted document to the encrypted error code", async () => {
    const pdf = await makePdf([[100, 100]]);
    const { files } = await protectPdf(pdf, { userPassword: "secret" }, "x.pdf");

    await expectPdfError(() => openPdfDocument(files[0].bytes), "encrypted");
  });

  it("maps a damaged document to a PdfToolkitError", async () => {
    const corrupt = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF",
    );

    try {
      await openPdfDocument(corrupt);
      throw new Error("Expected the damaged document to fail");
    } catch (error) {
      expect(isPdfToolkitError(error)).toBe(true);
    }
  });
});

describe("renderCoverThumbnail", () => {
  it("renders page 1 and reports the document page count", async () => {
    const pdf = await makePdf([
      [200, 300],
      [300, 400],
    ]);

    const cover = await renderCoverThumbnail(pdf);

    expect(cover.pageCount).toBe(2);
    expect(cover.dataUrl.startsWith("data:image/jpeg")).toBe(true);
    expect(cover.dataUrl.length).toBeGreaterThan(200);
  });

  it("rejects an encrypted document", async () => {
    const pdf = await makePdf([[100, 100]]);
    const { files } = await protectPdf(pdf, { userPassword: "secret" }, "x.pdf");

    await expectPdfError(() => renderCoverThumbnail(files[0].bytes), "encrypted");
  });
});

describe("pdfToImages", () => {
  it("exports a page as PNG", async () => {
    const pdf = await makePdf([[200, 300]]);
    const result = await pdfToImages(pdf, { pages: [1], format: "png", scale: 1 });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].fileName).toBe("page-1.png");
    expect(result.files[0].mimeType).toBe("image/png");
    expect(result.files[0].bytes[0]).toBe(0x89);
    expect(result.files[0].bytes[1]).toBe(0x50);
  });

  it("exports multiple pages as JPEG in page order", async () => {
    const pdf = await makePdf([
      [200, 300],
      [210, 310],
    ]);
    const result = await pdfToImages(pdf, {
      pages: [2, 1],
      format: "jpeg",
      scale: 1,
    });

    expect(result.files.map((file) => file.fileName)).toEqual([
      "page-1.jpg",
      "page-2.jpg",
    ]);
    expect(result.files[0].bytes[0]).toBe(0xff);
    expect(result.files[0].bytes[1]).toBe(0xd8);
    expect(result.notes.join(" ")).toContain("72 dpi");
  });

  it("rejects a selection beyond the document", async () => {
    const pdf = await makePdf([[200, 300]]);

    await expectPdfError(
      () => pdfToImages(pdf, { pages: [2], format: "png", scale: 1 }),
      "out-of-range",
    );
  });
});
