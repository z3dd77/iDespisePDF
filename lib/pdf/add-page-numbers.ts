import { loadPdf, savePdf } from "./read";
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { PdfToolkitError } from "./errors";
import { StandardFonts, rgb } from "@cantoo/pdf-lib";
import { normalizeSelection } from "./pages";

/**
 * Add visible page numbers to a PDF.
 * Supports various formats and placements.
 */
export async function addPageNumbers(
  bytes: Uint8Array,
  options: {
    format: "plain" | "ofTotal" | "pageOfTotal"; // "plain" => "1", "ofTotal" => "1 of 5", "pageOfTotal" => "Page 1 of 5"
    placement: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
    startNumber: number; // number for first page
    offset: number; // added to each page number
    fontSize: number;
    color: string; // hex like "#ff0000"
    margin: number; // points from edge
  },
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);

  // Validate startNumber and offset
  if (!Number.isInteger(options.startNumber) || options.startNumber < 1) {
    throw new PdfToolkitError("invalid-range", "startNumber must be >= 1");
  }
  if (!Number.isInteger(options.offset)) {
    throw new PdfToolkitError("invalid-range", "offset must be integer");
  }
  if (options.fontSize <= 0) {
    throw new PdfToolkitError("invalid-range", "fontSize must be positive");
  }
  if (options.margin < 0) {
    throw new PdfToolkitError("invalid-range", "margin cannot be negative");
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const colorRgb = parseHexColor(options.color ?? "#000000");

  const total = pageCount;
  const startNum = options.startNumber;
  const offset = options.offset;

  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    const pageNum = startNum + i + offset;
    let text: string;
    switch (options.format) {
      case "plain":
        text = `${pageNum}`;
        break;
      case "ofTotal":
        text = `${pageNum} of ${total}`;
        break;
      case "pageOfTotal":
        text = `Page ${pageNum} of ${total}`;
        break;
      default:
        text = `${pageNum}`;
    }

    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    const textHeight = options.fontSize; // approximate

    // Determine x based on horizontal placement
    let x: number;
    if (options.placement.endsWith("-left")) {
      x = options.margin;
    } else if (options.placement.endsWith("-center")) {
      x = (width - textWidth) / 2;
    } else if (options.placement.endsWith("-right")) {
      x = width - options.margin - textWidth;
    } else {
      x = options.margin;
    }

    // Determine y based on vertical placement
    let y: number;
    if (options.placement.startsWith("top")) {
      y = height - options.margin - textHeight;
    } else if (options.placement.startsWith("bottom")) {
      y = options.margin + textHeight;
    } else {
      y = options.margin + textHeight;
    }

    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(colorRgb.r, colorRgb.g, colorRgb.b),
    });
    onProgress?.({ completed: i + 1, total: pageCount });
  }

  const output = await savePdf(doc);

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-numbered.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      `Added page numbers using format "${options.format}" at ${options.placement}.`,
    ],
  };
}

/** Parse a hex colour like "#ffaa00" into {r,g,b} normalized 0‑1 */
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
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  return { r, g, b };
}
