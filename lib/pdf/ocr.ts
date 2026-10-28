import { loadPdfJs } from "./raster";
import { loadPdf } from "./read";
import { stripExtension } from "./validate";
import type { ProcessingResult, ProgressReporter } from "./types";
import { PdfToolkitError } from "./errors";


/** Perform OCR on selected pages and return plain text (and optionally a searchable PDF) */
export async function ocrPdf(
  bytes: Uint8Array,
  options: {
    pages?: readonly number[]; // 1‑based selection, all if omitted
    language?: string; // e.g. "eng"
  },
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const doc = await loadingTask.promise;
  const totalPages = doc.numPages;
  const targetSet = options.pages?.length ? new Set(options.pages) : null;
  const lang = options.language ?? "eng";

  const texts: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (targetSet && !targetSet.has(i)) continue;
    const page = await doc.getPage(i);
    // rasterise page to canvas (reuse renderPageToCanvas from raster.ts)
    const { renderPageToCanvas } = await import("./raster");
    const { canvas } = await renderPageToCanvas(doc, i, 2); // low scale for OCR speed
    const Tesseract = (await import("tesseract.js")).default;
const { data: { text } } = await Tesseract.recognize(canvas, lang);
    texts.push(`--- Page ${i} ---\n${text.trim()}`);
    onProgress?.({ completed: i, total: totalPages });
  }

  const finalText = texts.join("\n\n");
  const encoder = new TextEncoder();
  const txtBytes = encoder.encode(finalText);

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-ocr.txt`,
        mimeType: "text/plain" as any,
        bytes: txtBytes,
        pageCount: targetSet ? targetSet.size : totalPages,
      },
    ],
    notes: [
      `OCR completed on ${targetSet ? targetSet.size : totalPages} page(s) using language "${lang}".`,
    ],
  };
}
