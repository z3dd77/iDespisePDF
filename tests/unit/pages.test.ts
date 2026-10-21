import { describe, expect, it } from "vitest";

import {
  addRotation,
  assertPermutation,
  chunkPageRanges,
  expandRanges,
  formatPageRanges,
  moveItem,
  normalizeRotation,
  parsePageRanges,
  parsePageSelection,
} from "@/lib/pdf/pages";
import { expectPdfErrorSync } from "../fixtures/assert-error";

describe("parsePageRanges", () => {
  it("parses inclusive ranges and single pages", () => {
    expect(parsePageRanges("1-3, 5", 10)).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
    ]);
  });

  it("tolerates spaces around the dash", () => {
    expect(parsePageRanges(" 2 - 4 ", 10)).toEqual([{ from: 2, to: 4 }]);
  });

  it("rejects a reversed range", () => {
    expectPdfErrorSync(() => parsePageRanges("5-2", 10), "invalid-range");
  });

  it("rejects pages beyond the document", () => {
    expectPdfErrorSync(() => parsePageRanges("1-11", 10), "out-of-range");
  });

  it("rejects page zero", () => {
    expectPdfErrorSync(() => parsePageRanges("0-2", 10), "invalid-range");
  });

  it("rejects unparseable tokens", () => {
    expectPdfErrorSync(() => parsePageRanges("one", 10), "invalid-range");
  });

  it("rejects an empty list", () => {
    expectPdfErrorSync(() => parsePageRanges("   ", 10), "empty-selection");
  });

  it("rejects a dangling comma", () => {
    expectPdfErrorSync(() => parsePageRanges("1,,2", 10), "invalid-range");
  });
});

describe("parsePageSelection", () => {
  it("expands, de-duplicates, and sorts", () => {
    expect(parsePageSelection("5, 1-3, 2", 10)).toEqual([1, 2, 3, 5]);
  });
});

describe("expandRanges", () => {
  it("expands inclusive ranges in order", () => {
    expect(
      expandRanges([
        { from: 1, to: 2 },
        { from: 4, to: 4 },
      ]),
    ).toEqual([1, 2, 4]);
  });
});

describe("chunkPageRanges", () => {
  it("splits into equal groups with a smaller final group", () => {
    expect(chunkPageRanges(5, 2)).toEqual([
      { from: 1, to: 2 },
      { from: 3, to: 4 },
      { from: 5, to: 5 },
    ]);
  });

  it("rejects a group size below one", () => {
    expectPdfErrorSync(() => chunkPageRanges(5, 0), "invalid-range");
  });
});

describe("rotation math", () => {
  it("normalizes any angle to a quarter turn", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(89)).toBe(90);
  });

  it("adds rotations without exceeding 360", () => {
    expect(addRotation(270, 180)).toBe(90);
    expect(addRotation(180, 180)).toBe(0);
    expect(addRotation(0, 90)).toBe(90);
  });
});

describe("moveItem", () => {
  it("moves an entry and keeps the array length", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("returns a copy for invalid indices", () => {
    const source = ["a", "b"];
    const result = moveItem(source, 0, 9);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
  });
});

describe("assertPermutation", () => {
  it("accepts a full permutation", () => {
    expect(() => assertPermutation([3, 1, 2], 3)).not.toThrow();
  });

  it("rejects the wrong length", () => {
    expectPdfErrorSync(() => assertPermutation([1, 2], 3), "invalid-range");
  });

  it("rejects duplicates", () => {
    expectPdfErrorSync(() => assertPermutation([1, 1, 3], 3), "out-of-range");
  });

  it("rejects out-of-bounds pages", () => {
    expectPdfErrorSync(() => assertPermutation([1, 2, 4], 3), "out-of-range");
  });
});

describe("formatPageRanges", () => {
  it("compacts consecutive pages", () => {
    expect(formatPageRanges([1, 2, 3, 5, 8, 9, 10])).toBe("1-3, 5, 8-10");
    expect(formatPageRanges([4])).toBe("4");
    expect(formatPageRanges([])).toBe("");
  });

  it("sorts and de-duplicates", () => {
    expect(formatPageRanges([5, 3, 3, 4])).toBe("3-5");
  });
});
