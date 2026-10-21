import { describe, expect, it } from "vitest";

import {
  DEFAULT_IMAGES_OPTIONS,
  imagesToPdf,
  pageDimensions,
  placeImage,
} from "@/lib/pdf/images";
import { PAGE_SIZES } from "@/lib/pdf/presets";
import { JPEG_1X1, PNG_1X1, pageSizesOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

const FIT_OPTIONS = { ...DEFAULT_IMAGES_OPTIONS, pageSize: "fit" as const };

describe("pageDimensions", () => {
  it("matches the image when page size is fit", () => {
    expect(pageDimensions(400, 200, FIT_OPTIONS)).toEqual({
      width: 400,
      height: 200,
    });
  });

  it("adds margins on both sides when fitting", () => {
    expect(pageDimensions(400, 200, { ...FIT_OPTIONS, margin: 18 })).toEqual({
      width: 436,
      height: 236,
    });
  });

  it("uses landscape A4 for a wide image with automatic orientation", () => {
    const size = pageDimensions(1600, 900, {
      ...FIT_OPTIONS,
      pageSize: "a4",
    });

    expect(size.width).toBeCloseTo(PAGE_SIZES.a4.height, 2);
    expect(size.height).toBeCloseTo(PAGE_SIZES.a4.width, 2);
  });

  it("honors an explicit portrait orientation", () => {
    const size = pageDimensions(1600, 900, {
      ...FIT_OPTIONS,
      pageSize: "a4",
      orientation: "portrait",
    });

    expect(size.width).toBeCloseTo(PAGE_SIZES.a4.width, 2);
    expect(size.height).toBeCloseTo(PAGE_SIZES.a4.height, 2);
  });

  it("uses Letter dimensions when selected", () => {
    const size = pageDimensions(900, 1600, {
      ...FIT_OPTIONS,
      pageSize: "letter",
    });

    expect(size).toEqual({ width: 612, height: 792 });
  });
});

describe("placeImage", () => {
  it("contains an image and centers it", () => {
    expect(placeImage(400, 200, 600, 600, FIT_OPTIONS)).toEqual({
      width: 600,
      height: 300,
      x: 0,
      y: 150,
    });
  });

  it("covers the page and overflows the shorter axis", () => {
    expect(placeImage(400, 200, 600, 600, { ...FIT_OPTIONS, fit: "cover" })).toEqual({
      width: 1200,
      height: 600,
      x: -300,
      y: 0,
    });
  });

  it("stretches to the available box", () => {
    expect(
      placeImage(400, 200, 600, 600, { ...FIT_OPTIONS, fit: "stretch" }),
    ).toEqual({ width: 600, height: 600, x: 0, y: 0 });
  });

  it("respects margins", () => {
    expect(placeImage(400, 200, 600, 600, { ...FIT_OPTIONS, margin: 20 })).toEqual({
      width: 560,
      height: 280,
      x: 20,
      y: 160,
    });
  });
});

describe("imagesToPdf", () => {
  it("creates one page per image and embeds both formats", async () => {
    const result = await imagesToPdf(
      [
        { name: "a.png", bytes: PNG_1X1 },
        { name: "b.jpg", bytes: JPEG_1X1 },
      ],
      FIT_OPTIONS,
    );

    expect(result.files).toHaveLength(1);
    expect(result.files[0].fileName).toBe("a-images.pdf");
    expect(result.files[0].pageCount).toBe(2);
    expect(await pageSizesOf(result.files[0].bytes)).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });

  it("uses the requested page size", async () => {
    const result = await imagesToPdf([{ name: "a.png", bytes: PNG_1X1 }], {
      ...FIT_OPTIONS,
      pageSize: "a4",
    });

    expect(await pageSizesOf(result.files[0].bytes)).toEqual([[595, 842]]);
  });

  it("rejects non-image bytes", async () => {
    await expectPdfError(
      () => imagesToPdf([{ name: "a.txt", bytes: new Uint8Array([1, 2, 3]) }], FIT_OPTIONS),
      "not-an-image",
    );
  });

  it("rejects an empty list", async () => {
    await expectPdfError(() => imagesToPdf([], FIT_OPTIONS), "empty-selection");
  });
});
