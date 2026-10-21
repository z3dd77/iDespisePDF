import { describe, expect, it } from "vitest";

import { reorderPdf } from "@/lib/pdf/reorder";
import { makePdf, pageSizesOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

const SIZES: [number, number][] = [
  [100, 200],
  [110, 210],
  [120, 220],
];

describe("reorderPdf", () => {
  it("applies the permutation to page order", async () => {
    const pdf = await makePdf(SIZES, "reorder");
    const result = await reorderPdf(pdf, [3, 1, 2], "doc.pdf");

    expect(result.files[0].fileName).toBe("doc-reordered.pdf");
    expect(await pageSizesOf(result.files[0].bytes)).toEqual([
      SIZES[2],
      SIZES[0],
      SIZES[1],
    ]);
    expect(result.notes.join(" ")).toContain("Reordered 3 pages");
  });

  it("notes an unchanged order instead of claiming a change", async () => {
    const pdf = await makePdf(SIZES, "reorder");
    const result = await reorderPdf(pdf, [1, 2, 3], "doc.pdf");

    expect(await pageSizesOf(result.files[0].bytes)).toEqual(SIZES);
    expect(result.notes.join(" ")).toContain("order was unchanged");
  });

  it("rejects an incomplete permutation", async () => {
    const pdf = await makePdf(SIZES, "reorder");

    await expectPdfError(
      () => reorderPdf(pdf, [1, 2], "doc.pdf"),
      "invalid-range",
    );
  });

  it("rejects duplicate pages", async () => {
    const pdf = await makePdf(SIZES, "reorder");

    await expectPdfError(
      () => reorderPdf(pdf, [1, 1, 3], "doc.pdf"),
      "out-of-range",
    );
  });
});
