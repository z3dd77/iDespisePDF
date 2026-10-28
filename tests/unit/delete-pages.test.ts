import { describe, expect, it } from "vitest";

import { deletePages } from "@/lib/pdf/delete-pages";
import { makePdf, pageSizesOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

const SIZES: [number, number][] = [
  [100, 200],
  [110, 210],
  [120, 220],
  [130, 230],
  [140, 240],
];

describe("deletePages", () => {
  it("removes selected pages and preserves order", async () => {
    const pdf = await makePdf(SIZES, "delete");
    const result = await deletePages(pdf, [2, 4], "doc.pdf");

    expect(result.files).toHaveLength(1);
    const out = result.files[0];
    expect(out.pageCount).toBe(3);
    // Expected remaining pages are 1,3,5
    expect(await pageSizesOf(out.bytes)).toEqual([SIZES[0], SIZES[2], SIZES[4]]);
  });

  it("throws when attempting to delete all pages", async () => {
    const pdf = await makePdf(SIZES, "delete");
    await expectPdfError(
      () => deletePages(pdf, [1, 2, 3, 4, 5], "doc.pdf"),
      "empty-selection",
    );
  });
});
