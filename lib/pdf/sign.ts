import { loadPdf, savePdf } from "./read";
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { PdfToolkitError } from "./errors";
import { StandardFonts, rgb } from "@cantoo/pdf-lib";

/** Sign a PDF with an image (PNG/JPG) or drawn canvas data */
export async function signPdf(
  bytes: Uint8Array,
  options: {
    imageBytes: Uint8Array; // PNG or JPG data
    page: number; // 1‑based target page
    x: number;
    y: number;
    width: number; // desired width in PDF points
    height: number; // desired height in PDF points
  },
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const { doc, pageCount } = await loadPdf(bytes);
  if (options.page < 1 || options.page > pageCount) {
    throw new PdfToolkitError("out-of-range", `page ${options.page} out of range`);
  }
  const page = doc.getPage(options.page - 1);
  const ext = options.imageBytes[0] === 0xFF ? "jpg" : "png"; // crude check
  const image = ext === "jpg" ? await doc.embedJpg(options.imageBytes) : await doc.embedPng(options.imageBytes);
  page.drawImage(image, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
  });
  onProgress?.({ completed: 1, total: 1 });
  const output = await savePdf(doc);
  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-signed.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      `Added signature image to page ${options.page}.`,
    ],
  };
}
