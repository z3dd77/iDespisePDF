import { PdfToolkitError } from "./errors";
import { assertImageBytes, stripExtension } from "./validate";
import type {
  PdfInput,
  ProcessedFile,
  ProcessingResult,
  ProgressReporter,
} from "./types";
import type { ImageFit, ImageOrientation, PageSizeId } from "./presets";
import { PAGE_SIZES } from "./presets";
import { assertImageCount, assertTotalSize } from "./limits";

export type ImagesToPdfOptions = {
  pageSize: PageSizeId;
  fit: ImageFit;
  orientation: ImageOrientation;
  /** Margin in PDF points. 0 means edge to edge. */
  margin: number;
};

export const DEFAULT_IMAGES_OPTIONS: ImagesToPdfOptions = {
  pageSize: "fit",
  fit: "contain",
  orientation: "auto",
  margin: 0,
};

type PlacedImage = {
  width: number;
  height: number;
  x: number;
  y: number;
};

export function pageDimensions(
  imageWidth: number,
  imageHeight: number,
  options: ImagesToPdfOptions,
): { width: number; height: number } {
  if (options.pageSize === "fit") {
    return {
      width: Math.max(1, imageWidth + options.margin * 2),
      height: Math.max(1, imageHeight + options.margin * 2),
    };
  }

  const preset = PAGE_SIZES[options.pageSize];
  const wantsLandscape =
    options.orientation === "landscape" ||
    (options.orientation === "auto" && imageWidth > imageHeight);

  return wantsLandscape
    ? { width: preset.height, height: preset.width }
    : { width: preset.width, height: preset.height };
}

export function placeImage(
  imageWidth: number,
  imageHeight: number,
  pageWidth: number,
  pageHeight: number,
  options: ImagesToPdfOptions,
): PlacedImage {
  const availableWidth = Math.max(1, pageWidth - options.margin * 2);
  const availableHeight = Math.max(1, pageHeight - options.margin * 2);

  if (options.fit === "stretch") {
    return {
      width: availableWidth,
      height: availableHeight,
      x: options.margin,
      y: options.margin,
    };
  }

  const scaleX = availableWidth / imageWidth;
  const scaleY = availableHeight / imageHeight;
  const scale =
    options.fit === "cover"
      ? Math.max(scaleX, scaleY)
      : Math.min(scaleX, scaleY);

  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    width,
    height,
    x: options.margin + (availableWidth - width) / 2,
    y: options.margin + (availableHeight - height) / 2,
  };
}

/** Compose PNG/JPEG images into a single PDF, one page per image. */
export async function imagesToPdf(
  images: readonly PdfInput[],
  options: ImagesToPdfOptions,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  if (images.length === 0) {
    throw new PdfToolkitError("empty-selection", "no images supplied");
  }

  assertImageCount(images.length);
  assertTotalSize(images.reduce((total, image) => total + image.bytes.length, 0));

  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const output = await PDFDocument.create();

  for (const [index, image] of images.entries()) {
    const kind = assertImageBytes(image.name, image.bytes);
    const embedded =
      kind === "png"
        ? await output.embedPng(image.bytes)
        : await output.embedJpg(image.bytes);

    const page = pageDimensions(embedded.width, embedded.height, options);
    const pdfPage = output.addPage([page.width, page.height]);
    const placed = placeImage(
      embedded.width,
      embedded.height,
      page.width,
      page.height,
      options,
    );

    pdfPage.drawImage(embedded, {
      x: placed.x,
      y: placed.y,
      width: placed.width,
      height: placed.height,
    });

    onProgress?.({ completed: index + 1, total: images.length });
  }

  const bytes = await output.save({ useObjectStreams: true });

  const file: ProcessedFile = {
    fileName: `${stripExtension(images[0].name)}-images.pdf`,
    mimeType: "application/pdf",
    bytes,
    pageCount: images.length,
  };

  return {
    files: [file],
    notes: [
      `${images.length} ${images.length === 1 ? "image" : "images"} placed on ${images.length} ${images.length === 1 ? "page" : "pages"}.`,
      "Images are embedded at their original resolution and are not recompressed.",
    ],
  };
}
