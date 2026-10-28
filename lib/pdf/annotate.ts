import { loadPdf, savePdf } from "./read";
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { PdfToolkitError } from "./errors";
import { StandardFonts, rgb } from "@cantoo/pdf-lib";

/** Simple annotation model */
export type Annotation =
  | {
      type: "text";
      page: number; // 1‑based
      x: number;
      y: number;
      text: string;
      fontSize: number;
      color: string; // hex
    }
  | {
      type: "rect";
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      strokeWidth: number;
      color: string;
    };

function parseHex(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace(/^#/, "");
  if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
  if (c.length !== 6) throw new PdfToolkitError("invalid-range", `Bad colour ${hex}`);
  const n = parseInt(c, 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

/** Apply a list of annotations to a PDF */
export async function annotatePdf(
  bytes: Uint8Array,
  annotations: readonly Annotation[],
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);

  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    const pageIdx = ann.page - 1;
    if (pageIdx < 0 || pageIdx >= pageCount) {
      throw new PdfToolkitError("out-of-range", `annotation page ${ann.page} out of range`);
    }
    const page = doc.getPage(pageIdx);
    if (ann.type === "text") {
      const { r, g, b } = parseHex(ann.color);
      page.drawText(ann.text, {
        x: ann.x,
        y: ann.y,
        size: ann.fontSize,
        font,
        color: rgb(r, g, b),
      });
    } else if (ann.type === "rect") {
      const { r, g, b } = parseHex(ann.color);
      page.drawRectangle({
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        borderWidth: ann.strokeWidth,
        borderColor: rgb(r, g, b),
      });
    }
    onProgress?.({ completed: i + 1, total: annotations.length });
  }

  const output = await savePdf(doc);

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-annotated.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      `Applied ${annotations.length} annotation(s).`,
    ],
  };
}
