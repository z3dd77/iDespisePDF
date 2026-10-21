import { describe, expect, it } from "vitest";

import { extractPages } from "@/lib/pdf/extract";
import { makePdf, pageSizesOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

const SIZES: [number, number][] = [
  [100, 200],
  [110, 210],
  [120, 220],
  [130, 230],
  [140, 240],
];

describe("extractPages", () => {
  it("keeps selected pages in document order regardless of input order", async () => {
    const pdf = await makePdf(SIZES, "extract");
    const result = await extractPages(pdf, [5, 2, 2], "doc.pdf");

    expect(result.files).toHaveLength(1);
    expect(result.files[0].fileName).toBe("doc-extracted.pdf");
    expect(result.files[0].pageCount).toBe(2);
    expect(await pageSizesOf(result.files[0].bytes)).toEqual([
      SIZES[1],
      SIZES[4],
    ]);
    expect(result.notes.join(" ")).toContain("Extracted 2 of 5 pages");
  });

  it("rejects an empty selection", async () => {
    const pdf = await makePdf(SIZES, "extract");

    await expectPdfError(() => extractPages(pdf, [], "doc.pdf"), "empty-selection");
  });

  it("rejects a page beyond the document", async () => {
    const pdf = await makePdf(SIZES, "extract");

    await expectPdfError(
      () => extractPages(pdf, [1, 9], "doc.pdf"),
      "out-of-range",
    );
  });
});
