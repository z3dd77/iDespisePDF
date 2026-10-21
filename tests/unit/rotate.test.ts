import { describe, expect, it } from "vitest";

import { rotatePdf } from "@/lib/pdf/rotate";
import { makePdf, pageRotationsOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

const SIZES: [number, number][] = [
  [200, 300],
  [300, 400],
  [400, 500],
];

describe("rotatePdf", () => {
  it("sets the requested rotation per page and leaves others alone", async () => {
    const pdf = await makePdf(SIZES, "rotate");
    const result = await rotatePdf(pdf, { 1: 90, 2: 180 }, "doc.pdf");

    expect(result.files[0].fileName).toBe("doc-rotated.pdf");
    expect(await pageRotationsOf(result.files[0].bytes)).toEqual([90, 180, 0]);
    expect(result.notes.join(" ")).toContain("Rotated 2 pages");
  });

  it("is additive against an existing orientation", async () => {
    const pdf = await makePdf(SIZES, "rotate");
    const first = await rotatePdf(pdf, { 1: 90 }, "doc.pdf");
    const second = await rotatePdf(first.files[0].bytes, { 1: 90 }, "doc.pdf");

    expect(await pageRotationsOf(second.files[0].bytes)).toEqual([180, 0, 0]);
  });

  it("normalizes a quarter turn past 360", async () => {
    const pdf = await makePdf(SIZES, "rotate");
    const result = await rotatePdf(pdf, { 1: 270, 2: 180 }, "doc.pdf");
    const again = await rotatePdf(result.files[0].bytes, { 1: 180 }, "doc.pdf");

    expect(await pageRotationsOf(again.files[0].bytes)).toEqual([90, 180, 0]);
  });

  it("rejects an empty rotation set", async () => {
    const pdf = await makePdf(SIZES, "rotate");

    await expectPdfError(() => rotatePdf(pdf, {}, "doc.pdf"), "empty-selection");
  });

  it("rejects a page beyond the document", async () => {
    const pdf = await makePdf(SIZES, "rotate");

    await expectPdfError(
      () => rotatePdf(pdf, { 9: 90 }, "doc.pdf"),
      "out-of-range",
    );
  });
});
