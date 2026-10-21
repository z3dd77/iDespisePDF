import { PdfToolkitError } from "./errors";

/**
 * The one place tool presets are defined, so UI copy and processing math can
 * never drift apart.
 */

export type CompressionPresetId = "screen" | "balanced" | "print";

export type CompressionPreset = {
  id: CompressionPresetId;
  label: string;
  description: string;
  /** Rasterization resolution. PDF user units are 1/72 inch. */
  dpi: number;
  /** JPEG quality passed to canvas encoding, 0-1. */
  quality: number;
};

export const COMPRESSION_PRESETS: readonly CompressionPreset[] = [
  {
    id: "screen",
    label: "Screen",
    description: "Smallest file. For on-screen reading, previews, and email.",
    dpi: 96,
    quality: 0.6,
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "A middle ground for sharing. Text becomes an image.",
    dpi: 144,
    quality: 0.75,
  },
  {
    id: "print",
    label: "Print",
    description: "Highest quality of the three. Often only a small saving.",
    dpi: 200,
    quality: 0.88,
  },
];

/**
 * Shown before the user commits to compression. These are the guarantees the
 * pipeline cannot make, not disclaimers bolted on afterwards.
 */
export const COMPRESSION_WARNINGS: readonly string[] = [
  "Each page is re-rendered as an image, so selectable text, links, annotations, form fields, and bookmarks are lost.",
  "Vector artwork and small text become pixels and may look softer.",
  "Accessibility information such as reading order and alt text does not survive.",
  "If the result isn't smaller, no file is produced. The original is left untouched.",
];

export function getCompressionPreset(id: CompressionPresetId): CompressionPreset {
  const preset = COMPRESSION_PRESETS.find((candidate) => candidate.id === id);

  if (!preset) {
    throw new PdfToolkitError("unknown", `Unknown compression preset: ${id}`);
  }

  return preset;
}

export type PageSizeId = "fit" | "a4" | "letter";

export const PAGE_SIZES: Record<"a4" | "letter", { width: number; height: number }> =
  {
    // PDF points (1/72 inch).
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612, height: 792 },
  };

export type ImageFit = "contain" | "cover" | "stretch";

export const IMAGE_FIT_OPTIONS: readonly {
  value: ImageFit;
  label: string;
  description: string;
}[] = [
  {
    value: "contain",
    label: "Contain",
    description: "Whole image visible, letterboxed if needed.",
  },
  {
    value: "cover",
    label: "Cover",
    description: "Fills the page; edges may be cropped by the page boundary.",
  },
  {
    value: "stretch",
    label: "Stretch",
    description: "Fills the page and may distort proportions.",
  },
];

export type ImageOrientation = "auto" | "portrait" | "landscape";

export const RASTER_SCALES: readonly {
  value: number;
  label: string;
  description: string;
}[] = [
  { value: 1, label: "1x", description: "72 dpi. Fast, small files." },
  { value: 2, label: "2x", description: "144 dpi. Sharper text." },
  { value: 3, label: "3x", description: "216 dpi. Largest files." },
];

export const JPEG_QUALITY = 0.9;
