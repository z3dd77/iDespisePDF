/**
 * Public entry point for PDF processing.
 *
 * Every operation here is client-side and returns real bytes. Heavy libraries
 * (@cantoo/pdf-lib, pdfjs-dist) are imported dynamically inside the functions
 * that need them, so importing this module never pulls a PDF engine into the
 * initial page bundle.
 *
 * raster.ts is intentionally not exported: PDF.js rendering is an internal
 * detail used by compress.ts and pdf-to-images.ts.
 */

export * from "./errors";
export * from "./limits";
export * from "./presets";
export * from "./types";

export * from "./pages";
export * from "./validate";
export * from "./read";

export * from "./merge";
export * from "./split";
export * from "./extract";
export * from "./reorder";
export * from "./rotate";
export * from "./images";
export * from "./compress";
export * from "./pdf-to-images";
export * from "./protect";
export * from "./add-page-numbers";
export * from "./watermark";
export * from "./crop";
export * from "./metadata-editor";
export * from "./annotate";
export * from "./sign";
export * from "./pdf-to-text";
export * from "./extract-images";
export * from "./ocr";
export * from "./compare";
export * from "./unlock";
export * from "./nup";
