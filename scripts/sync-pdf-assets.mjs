import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * PDF.js needs its worker served as a static asset. Turbopack asset handling
 * for a 1.2 MB worker file is unreliable, so we copy the exact worker shipped
 * with the installed pdfjs-dist into `public/` instead of guessing a URL.
 */
const source = join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const target = join(process.cwd(), "public", "pdf.worker.min.mjs");

if (!existsSync(source)) {
  console.error(`[pdf-assets] Missing PDF.js worker: ${source}`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });

const isStale =
  !existsSync(target) || statSync(source).mtimeMs > statSync(target).mtimeMs;

if (isStale) {
  copyFileSync(source, target);
  console.log("[pdf-assets] Copied pdf.worker.min.mjs to public/");
} else {
  console.log("[pdf-assets] PDF.js worker already up to date");
}
