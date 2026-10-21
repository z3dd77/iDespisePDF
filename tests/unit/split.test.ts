import { describe, expect, it } from "vitest";

import {
  splitPdfByRanges,
  splitPdfEachPage,
  splitPdfEveryN,
} from "@/lib/pdf/split";
import { bytesEqual, makePdf, pageSizesOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

const SIZES: [number, number][] = [
  [100, 200],
  [110, 210],
  [120, 220],
  [130, 230],
  [140, 240],
];

describe("splitPdfByRanges", () => {
  it("creates one file per range, preserving page content", async () => {
    const pdf = await makePdf(SIZES, "split");
    const result = await splitPdfByRanges(
      pdf,
      [
        { from: 1, to: 2 },
        { from: 4, to: 5 },
      ],
      "doc.pdf",
    );

    expect(result.files).toHaveLength(2);
    expect(result.files.map((file) => file.fileName)).toEqual([
      "doc-pages-1-2.pdf",
      "doc-pages-4-5.pdf",
    ]);
    expect(await pageSizesOf(result.files[0].bytes)).toEqual([
      SIZES[0],
      SIZES[1],
    ]);
    expect(await pageSizesOf(result.files[1].bytes)).toEqual([
      SIZES[3],
      SIZES[4],
    ]);
  });

  it("does not modify the source bytes", async () => {
    const pdf = await makePdf(SIZES, "split");
    const copy = new Uint8Array(pdf);

    await splitPdfByRanges(pdf, [{ from: 2, to: 3 }], "doc.pdf");

    expect(bytesEqual(pdf, copy)).toBe(true);
  });

  it("rejects ranges beyond the document", async () => {
    const pdf = await makePdf(SIZES, "split");

    await expectPdfError(
      () => splitPdfByRanges(pdf, [{ from: 4, to: 9 }], "doc.pdf"),
      "out-of-range",
    );
  });

  it("uses a single-page filename for a one-page range", async () => {
    const pdf = await makePdf(SIZES, "split");
    const result = await splitPdfByRanges(pdf, [{ from: 3, to: 3 }], "doc.pdf");

    expect(result.files[0].fileName).toBe("doc-page-3.pdf");
    expect(result.files[0].pageCount).toBe(1);
  });
});

describe("splitPdfEveryN", () => {
  it("chunks the document and keeps the remainder", async () => {
    const pdf = await makePdf(SIZES, "split");
    const result = await splitPdfEveryN(pdf, 2, "doc.pdf");

    expect(result.files).toHaveLength(3);
    expect(result.files.map((file) => file.pageCount)).toEqual([2, 2, 1]);
    expect(await pageSizesOf(result.files[2].bytes)).toEqual([SIZES[4]]);
  });

  it("rejects a group size below one", async () => {
    const pdf = await makePdf(SIZES, "split");

    await expectPdfError(
      () => splitPdfEveryN(pdf, 0, "doc.pdf"),
      "invalid-range",
    );
  });
});

describe("splitPdfEachPage", () => {
  it("produces one file per page", async () => {
    const pdf = await makePdf(SIZES, "split");
    const result = await splitPdfEachPage(pdf, "doc.pdf");

    expect(result.files).toHaveLength(5);
    expect(result.files[0].fileName).toBe("doc-page-1.pdf");
    expect(result.files[4].fileName).toBe("doc-page-5.pdf");

    for (const [index, file] of result.files.entries()) {
      expect(await pageSizesOf(file.bytes)).toEqual([SIZES[index]]);
    }
  });
});
