import { describe, expect, it } from "vitest";
import { addPageNumbers } from "@/lib/pdf/add-page-numbers";
import { makePdf, pageSizesOf } from "../fixtures/pdf-fixtures";

const SIZES: [number, number][] = [
  [100, 200],
  [110, 210],
  [120, 220],
];

describe("addPageNumbers", () => {
  it("adds visible numbers with plain format", async () => {
    const pdf = await makePdf(SIZES, "numbers");
    const result = await addPageNumbers(pdf, {
      format: "plain",
      placement: "bottom-right",
      startNumber: 1,
      offset: 0,
      fontSize: 12,
      color: "#ff0000",
      margin: 10,
    }, "doc.pdf");

    expect(result.files).toHaveLength(1);
    const out = result.files[0];
    expect(out.pageCount).toBe(SIZES.length);
    // Ensure the output still has same page sizes (content not altered except text)
    expect(await pageSizesOf(out.bytes)).toEqual(SIZES);
  });
});
