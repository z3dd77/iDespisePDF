import { loadPdf, savePdf } from "./read";
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { PdfToolkitError } from "./errors";
import { StandardFonts, rgb, degrees } from "@cantoo/pdf-lib";

/** Parse a hex colour like "#ffaabb" into normalized 0‑1 RGB */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length !== 6) {
    throw new PdfToolkitError("invalid-range", `Invalid colour ${hex}`);
  }
  const num = parseInt(clean, 16);
  const r = ((num >>> 16) & 0xff) / 255;
  const g = ((num >>> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  return { r, g, b };
}

/**
 * Add a textual watermark to selected pages.
 */
export async function watermarkPdf(
  bytes: Uint8Array,
  options: {
    text: string;
    opacity: number; // 0‑1
    rotation: number; // degrees
    fontSize: number;
    color: string; // hex e.g. "#ff0000"
    placement:
      | "top-left"
      | "top-center"
      | "top-right"
      | "bottom-left"
      | "bottom-center"
      | "bottom-right"
      | "center"; // new center option
    pages?: readonly number[]; // 1‑based page numbers, if omitted all pages
    imageBytes?: Uint8Array; // optional image to use as watermark
    imageScale?: number; // optional scaling factor for image watermark (default 1)
  },
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const embedImage = async () => {
    if (!options.imageBytes) return null;
    // simple format detection: JPEG starts with 0xFF 0xD8
    const isJpg = options.imageBytes[0] === 0xFF && options.imageBytes[1] === 0xD8;
    const img = isJpg ? await doc.embedJpg(options.imageBytes) : await doc.embedPng(options.imageBytes);
    return img;
  };
  const embeddedImage = await embedImage();

  const targetPages = options.pages?.length ? new Set(options.pages) : null;

  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    if (targetPages && !targetPages.has(pageNum)) continue;
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    const textHeight = options.fontSize; // approximate

    // compute x for center placement
    let x: number;
    if (options.placement === "center") {
      x = (width - textWidth) / 2;
    } else {
      const horiz = options.placement.split("-")[1];
      if (horiz === "left") x = options.fontSize;
      else if (horiz === "center") x = (width - textWidth) / 2;
      else if (horiz === "right") x = width - textWidth - options.fontSize;
      else x = options.fontSize;
    }
    // Compute y
    let y: number;
    if (options.placement === "center") {
      y = (height - textHeight) / 2;
    } else if (options.placement.startsWith("top")) {
      y = height - options.fontSize - options.fontSize; // top margin
    } else {
      y = options.fontSize + textHeight; // bottom margin
    }

    if (embeddedImage) {
      // Draw image watermark
      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;
      const scale = Math.max(0.01, options.imageScale ?? 1);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      // Compute placement for image
      let ix: number;
      let iy: number;
      switch (options.placement) {
        case "top-left":
          ix = 0;
          iy = height - drawHeight;
          break;
        case "top-center":
          ix = (width - drawWidth) / 2;
          iy = height - drawHeight;
          break;
        case "top-right":
          ix = width - drawWidth;
          iy = height - drawHeight;
          break;
        case "bottom-left":
          ix = 0;
          iy = 0;
          break;
        case "bottom-center":
          ix = (width - drawWidth) / 2;
          iy = 0;
          break;
        case "bottom-right":
          ix = width - drawWidth;
          iy = 0;
          break;
        case "center":
          ix = (width - drawWidth) / 2;
          iy = (height - drawHeight) / 2;
          break;
        default:
          ix = 0;
          iy = 0;
      }
      page.drawImage(embeddedImage, {
        x: ix,
        y: iy,
        width: drawWidth,
        height: drawHeight,
        rotate: degrees(options.rotation),
        opacity: options.opacity,
      });
    } else {
      // Draw text watermark
      page.drawText(options.text, {
        x,
        y,
        size: options.fontSize,
        font,
        color: rgb(r, g, b),
        rotate: degrees(options.rotation),
        opacity: options.opacity,
      });
    }
    onProgress?.({ completed: i + 1, total: pageCount });
  }

  const output = await savePdf(doc);

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-watermarked.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      `Applied watermark "${options.text}" to ${targetPages ? targetPages.size : pageCount} page(s).`,
    ],
  };
}
