import { describe, expect, it } from "vitest";

import { compressionSummary, decideCompression } from "@/lib/pdf/compress";
import {
  COMPRESSION_PRESETS,
  COMPRESSION_WARNINGS,
  getCompressionPreset,
} from "@/lib/pdf/presets";
import { PdfToolkitError } from "@/lib/pdf/errors";

describe("decideCompression", () => {
  it("only reports success when the output is strictly smaller", () => {
    expect(decideCompression(1000, 999)).toBe("smaller");
    expect(decideCompression(1000, 1000)).toBe("not-smaller");
    expect(decideCompression(1000, 1200)).toBe("not-smaller");
  });
});

describe("compression presets", () => {
  it("exposes the three labeled presets in increasing quality", () => {
    expect(COMPRESSION_PRESETS.map((preset) => preset.id)).toEqual([
      "screen",
      "balanced",
      "print",
    ]);
    expect(COMPRESSION_PRESETS.map((preset) => preset.dpi)).toEqual([
      96, 144, 200,
    ]);

    const qualities = COMPRESSION_PRESETS.map((preset) => preset.quality);
    expect(qualities).toEqual([...qualities].sort((left, right) => left - right));
  });

  it("summarizes the selected preset in the UI copy", () => {
    expect(compressionSummary("balanced")).toContain("144 dpi");
  });

  it("rejects an unknown preset", () => {
    expect(() => getCompressionPreset("ultra" as never)).toThrow(PdfToolkitError);
  });
});

describe("compression warnings", () => {
  it("names the features that rasterization removes", () => {
    const text = COMPRESSION_WARNINGS.join(" ").toLowerCase();

    expect(text).toContain("text");
    expect(text).toContain("links");
    expect(text).toContain("annotations");
    expect(text).toContain("accessibility");
    expect(text).toContain("isn't smaller");
  });
});
