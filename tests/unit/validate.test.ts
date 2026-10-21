import { describe, expect, it } from "vitest";

import {
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  assertImageCount,
  assertPageCount,
  assertRasterPageCount,
  assertTotalSize,
  assertWithinSizeLimit,
} from "@/lib/pdf/limits";
import { stripExtension, extensionOf } from "@/lib/pdf/validate";
import {
  assertImageBytes,
  assertPdfBytes,
  detectImageKind,
  hasPdfSignature,
} from "@/lib/pdf/validate";
import { JPEG_1X1, PNG_1X1 } from "../fixtures/pdf-fixtures";
import { expectPdfErrorSync } from "../fixtures/assert-error";

const PDF_HEADER = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a,
]);

describe("hasPdfSignature", () => {
  it("accepts a file starting with %PDF-", () => {
    expect(hasPdfSignature(PDF_HEADER)).toBe(true);
  });

  it("accepts a header within the first kilobyte", () => {
    const bytes = new Uint8Array(1200);
    bytes.set(PDF_HEADER, 900);
    expect(hasPdfSignature(bytes)).toBe(true);
  });

  it("rejects a header beyond the first kilobyte", () => {
    const bytes = new Uint8Array(3000);
    bytes.set(PDF_HEADER, 1500);
    expect(hasPdfSignature(bytes)).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(hasPdfSignature(new Uint8Array(0))).toBe(false);
  });
});

describe("detectImageKind", () => {
  it("detects PNG and JPEG from leading bytes", () => {
    expect(detectImageKind(PNG_1X1)).toBe("png");
    expect(detectImageKind(JPEG_1X1)).toBe("jpeg");
  });

  it("rejects other formats", () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectImageKind(gif)).toBeNull();
  });
});

describe("assertPdfBytes", () => {
  it("accepts a PDF header", () => {
    expect(() => assertPdfBytes("doc.pdf", PDF_HEADER)).not.toThrow();
  });

  it("rejects an empty file", () => {
    expectPdfErrorSync(
      () => assertPdfBytes("doc.pdf", new Uint8Array(0)),
      "empty-file",
    );
  });

  it("rejects a file without a PDF signature", () => {
    expectPdfErrorSync(
      () => assertPdfBytes("doc.pdf", new TextEncoder().encode("hello world")),
      "not-a-pdf",
    );
  });
});

describe("assertImageBytes", () => {
  it("accepts PNG and JPEG", () => {
    expect(assertImageBytes("a.png", PNG_1X1)).toBe("png");
    expect(assertImageBytes("a.jpg", JPEG_1X1)).toBe("jpeg");
  });

  it("rejects a GIF", () => {
    expectPdfErrorSync(
      () =>
        assertImageBytes(
          "a.gif",
          new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
        ),
      "not-an-image",
    );
  });

  it("rejects an empty image", () => {
    expectPdfErrorSync(
      () => assertImageBytes("a.png", new Uint8Array(0)),
      "empty-file",
    );
  });
});

describe("size and count ceilings", () => {
  it("accepts values at the limit and rejects above it", () => {
    expect(() => assertWithinSizeLimit(MAX_FILE_BYTES)).not.toThrow();
    expectPdfErrorSync(
      () => assertWithinSizeLimit(MAX_FILE_BYTES + 1),
      "too-large",
    );
    expect(() => assertTotalSize(MAX_TOTAL_BYTES)).not.toThrow();
    expectPdfErrorSync(
      () => assertTotalSize(MAX_TOTAL_BYTES + 1),
      "too-large",
    );
  });

  it("rejects page counts above the ceiling", () => {
    expect(() => assertPageCount(2000)).not.toThrow();
    expectPdfErrorSync(() => assertPageCount(2001), "too-many-pages");
    expectPdfErrorSync(() => assertRasterPageCount(121), "too-many-pages");
  });

  it("rejects too many images", () => {
    expectPdfErrorSync(() => assertImageCount(61), "too-many-files");
  });
});

describe("filename helpers", () => {
  it("strips only the last extension", () => {
    expect(stripExtension("report.final.pdf")).toBe("report.final");
    expect(stripExtension("no-extension")).toBe("no-extension");
    expect(extensionOf("report.PDF")).toBe("pdf");
    expect(extensionOf("no-extension")).toBe("");
  });
});
