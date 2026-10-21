/**
 * End-to-end UI smoke test. Drives the real app in Chromium: uploads files
 * through the file input, clicks the real buttons, and reads the downloaded
 * output back with a PDF parser.
 *
 * Requires a running server and an installed Chromium:
 *   npm start
 *   node scripts/ui-smoke.mjs
 */

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PDFDocument } from "@cantoo/pdf-lib";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;

  if (condition) {
    console.log(`ok   ${message}`);
  } else {
    failures.push(message);
    console.error(`FAIL ${message}`);
  }
}

const workRoot = await mkdtemp(join(tmpdir(), "idespise-ui-"));
const flowDirs = new Map();

async function flowDir(flow) {
  if (!flowDirs.has(flow)) {
    const dir = join(workRoot, flow);
    await mkdir(dir, { recursive: true });
    flowDirs.set(flow, dir);
  }

  return flowDirs.get(flow);
}

async function makePdf(flow, name, sizes) {
  const doc = await PDFDocument.create();

  for (const [width, height] of sizes) {
    doc.addPage([width, height]);
  }

  const path = join(await flowDir(flow), name);
  await writeFile(path, await doc.save());
  return path;
}

async function writeBase64(flow, name, base64) {
  const path = join(await flowDir(flow), name);
  await writeFile(path, Buffer.from(base64, "base64"));
  return path;
}

async function readPages(path) {
  const doc = await PDFDocument.load(await readFile(path));
  return {
    count: doc.getPageCount(),
    sizes: doc
      .getPages()
      .map((page) => [Math.round(page.getWidth()), Math.round(page.getHeight())]),
    rotations: doc.getPages().map((page) => page.getRotation().angle),
  };
}

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG_1X1 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

async function openTool(slug) {
  await page.goto(`${BASE_URL}/tools/${slug}`);
  await page.waitForLoadState("networkidle");
}

async function downloadFirst(flow, targetName) {
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByRole("button", { name: "Download", exact: true }).first().click();
  const download = await downloadPromise;
  const path = join(await flowDir(flow), targetName ?? download.suggestedFilename());
  await download.saveAs(path);
  return { path, suggested: download.suggestedFilename() };
}

try {
  // 1. Merge
  await openTool("merge");
  const logos = page.getByRole("img", { name: "iDespisePDF" });
  const logoCount = await logos.count();
  check(logoCount >= 2, "header and footer render the logo");
  const headerLogoLoaded = await logos
    .first()
    .evaluate((image) => image.complete && image.naturalWidth > 0);
  check(headerLogoLoaded, "header logo image actually loads");
  const updateControlCount = await page
    .getByRole("button", {
      name: /Check for updates|Update ready|Downloading update/,
    })
    .count();
  check(
    updateControlCount === 0,
    "browser build does not show desktop update controls",
  );
  await page.setInputFiles('input[type="file"]', [
    await makePdf("merge", "a.pdf", [
      [200, 300],
      [210, 310],
    ]),
    await makePdf("merge", "b.pdf", [[400, 500]]),
  ]);
  await page.getByText("a.pdf", { exact: true }).waitFor();
  await page.getByRole("img", { name: "Preview of a.pdf" }).waitFor();
  await page.getByRole("img", { name: "Preview of b.pdf" }).waitFor();
  const mergeCoverCount = await page
    .getByRole("img", { name: /^Preview of / })
    .count();
  check(mergeCoverCount === 2, "merge shows a cover for every PDF");
  const coverBox = await page
    .getByRole("img", { name: "Preview of a.pdf" })
    .evaluate((element) => element.getBoundingClientRect().height);
  check(coverBox >= 140, `merge cover is ${Math.round(coverBox)}px tall (was 94px)`);
  await page.getByRole("button", { name: "Merge 2 PDFs" }).click();
  await page.getByRole("heading", { name: "Merged" }).waitFor();
  const merged = await downloadFirst("merge", "merged.pdf");
  check(merged.suggested === "a-merged.pdf", "merge suggests a-merged.pdf");
  const mergedPages = await readPages(merged.path);
  check(mergedPages.count === 3, "merge produced 3 pages");
  check(
    JSON.stringify(mergedPages.sizes) ===
      JSON.stringify([
        [200, 300],
        [210, 310],
        [400, 500],
      ]),
    "merge preserved page order and sizes",
  );

  // 2. Split by custom ranges
  await openTool("split");
  await page.setInputFiles('input[type="file"]', [
    await makePdf("split", "three.pdf", [
      [200, 300],
      [300, 400],
      [400, 500],
    ]),
  ]);
  await page.getByText("3 of 3 pages selected").waitFor();
  await page.locator("#split-ranges").fill("1, 2-3");
  await page.getByRole("button", { name: "Split PDF" }).click();
  await page.getByRole("heading", { name: "Split complete" }).waitFor();
  const splitButtonCount = await page
    .getByRole("button", { name: "Download", exact: true })
    .count();
  check(splitButtonCount === 2, "split produced two downloadable files");
  const splitFirst = await downloadFirst("split", "split-first.pdf");
  check(
    splitFirst.suggested === "three-page-1.pdf",
    "split names the single-page file after its page",
  );

  // 3. Rotate
  await openTool("rotate");
  await page.setInputFiles('input[type="file"]', [
    await makePdf("rotate", "three.pdf", [
      [200, 300],
      [300, 400],
      [400, 500],
    ]),
  ]);
  await page.getByRole("button", { name: /Apply 90/ }).waitFor();
  await page.getByRole("button", { name: /Apply 90/ }).click();
  await page.getByRole("button", { name: "Export rotated PDF" }).click();
  await page.getByRole("heading", { name: "Rotation applied" }).waitFor();
  const rotated = await downloadFirst("rotate", "rotated.pdf");
  const rotatedPages = await readPages(rotated.path);
  check(
    JSON.stringify(rotatedPages.rotations) === JSON.stringify([90, 90, 90]),
    "rotate applied 90 degrees to every page",
  );

  // 4. Reorder
  await openTool("reorder");
  await page.setInputFiles('input[type="file"]', [
    await makePdf("reorder", "three.pdf", [
      [200, 300],
      [300, 400],
      [400, 500],
    ]),
  ]);
  await page.getByText("Page order (3 pages)").waitFor();
  await page.getByRole("button", { name: "Move page 1 later" }).click();
  await page.getByRole("button", { name: "Export new order" }).click();
  await page.getByRole("heading", { name: "New page order ready" }).waitFor();
  const reordered = await downloadFirst("reorder", "reordered.pdf");
  const reorderedPages = await readPages(reordered.path);
  check(
    JSON.stringify(reorderedPages.sizes[0]) === JSON.stringify([300, 400]),
    "reorder moved page 2 into the first position",
  );

  // 5. Extract
  await openTool("extract-pages");
  await page.setInputFiles('input[type="file"]', [
    await makePdf("extract", "three.pdf", [
      [200, 300],
      [300, 400],
      [400, 500],
    ]),
  ]);
  await page.getByText("0 of 3 pages selected").waitFor();
  await page.getByRole("button", { name: "Select all" }).click();
  await page.getByRole("button", { name: "Extract 3 pages" }).click();
  await page.getByRole("heading", { name: "Pages extracted" }).waitFor();
  const extracted = await downloadFirst("extract", "extracted.pdf");
  const extractedPages = await readPages(extracted.path);
  check(extractedPages.count === 3, "extract produced a 3 page PDF");

  // 6. Images to PDF
  await openTool("images-to-pdf");
  await page.setInputFiles('input[type="file"]', [
    await writeBase64("images", "pixel.png", PNG_1X1),
    await writeBase64("images", "pixel.jpg", JPEG_1X1),
  ]);
  await page.getByText("pixel.jpg", { exact: true }).waitFor();
  await page.getByRole("img", { name: "Preview of pixel.png" }).waitFor();
  await page.getByRole("img", { name: "Preview of pixel.jpg" }).waitFor();
  check(true, "images to PDF shows an image preview per file");
  await page.getByRole("button", { name: /Create PDF from 2 images/ }).click();
  await page.getByRole("heading", { name: "PDF created" }).waitFor();
  const fromImages = await downloadFirst("images", "images.pdf");
  const imagePdf = await readPages(fromImages.path);
  check(imagePdf.count === 2, "images to PDF produced one page per image");

  // 7. PDF to images
  await openTool("pdf-to-images");
  await page.setInputFiles('input[type="file"]', [
    await makePdf("pdf-to-images", "a.pdf", [
      [200, 300],
      [210, 310],
    ]),
  ]);
  await page.getByRole("button", { name: "Render 2 pages" }).waitFor();
  await page.getByRole("button", { name: "Render 2 pages" }).click();
  await page.getByRole("heading", { name: "Images ready" }).waitFor();
  const imageDownload = await downloadFirst("pdf-to-images", "rendered.png");
  check(
    imageDownload.suggested === "page-1.png",
    "PDF to images names the first output page-1.png",
  );
  const pngBytes = await readFile(imageDownload.path);
  check(pngBytes[0] === 0x89 && pngBytes[1] === 0x50, "rendered file is a real PNG");

  // 8. Compress (honest not-smaller path for a text PDF)
  await openTool("compress");
  await page.setInputFiles('input[type="file"]', [
    await makePdf("compress", "a.pdf", [
      [200, 300],
      [210, 310],
    ]),
  ]);
  await page.getByRole("img", { name: "Preview of a.pdf" }).waitFor();
  check(true, "compress shows a cover thumbnail");
  await page.getByRole("button", { name: "Compress PDF" }).click();
  await page
    .getByRole("heading", { name: "No smaller file was produced" })
    .waitFor({ timeout: 60_000 });
  const compressDownloadButtons = await page
    .getByRole("button", { name: "Download", exact: true })
    .count();
  check(
    compressDownloadButtons === 0,
    "compression offers no download when the result is not smaller",
  );

  // 8b. Compress two files in one run
  await page.setInputFiles('input[type="file"]', [
    await makePdf("compress", "b.pdf", [[220, 320]]),
  ]);
  await page.getByRole("img", { name: "Preview of b.pdf" }).waitFor();
  await page.getByRole("button", { name: "Compress 2 PDFs" }).click();
  await page
    .getByRole("heading", { name: "No smaller files were produced" })
    .waitFor({ timeout: 60_000 });
  const batchDownloadButtons = await page
    .getByRole("button", { name: "Download", exact: true })
    .count();
  check(
    batchDownloadButtons === 0,
    "multi-file compression offers no downloads when nothing shrinks",
  );

  // 9. Protect, then verify the download with the library
  await openTool("protect");
  await page.setInputFiles('input[type="file"]', [
    await makePdf("protect", "a.pdf", [
      [200, 300],
      [210, 310],
    ]),
  ]);
  await page.getByText("a.pdf", { exact: true }).waitFor();
  await page.getByRole("img", { name: "Preview of a.pdf" }).waitFor();
  check(true, "protect shows a cover thumbnail");
  await page.locator("#protect-password-input").fill("ui smoke password");
  await page.locator("#protect-confirm").fill("ui smoke password");
  await page.getByRole("button", { name: "Encrypt and download" }).click();
  await page.getByRole("heading", { name: "Encrypted" }).waitFor();
  const protectedFile = await downloadFirst("protect", "protected.pdf");
  const protectedBytes = await readFile(protectedFile.path);
  let openedWithoutPassword = true;

  try {
    await PDFDocument.load(protectedBytes);
  } catch {
    openedWithoutPassword = false;
  }

  check(!openedWithoutPassword, "protected download refuses to open without a password");
  const opened = await PDFDocument.load(protectedBytes, {
    password: "ui smoke password",
  });
  check(opened.getPageCount() === 2, "protected download opens with the password");
  check(
    protectedFile.suggested === "a-protected.pdf",
    "protect names the output a-protected.pdf",
  );
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} of ${checks} UI checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks} UI checks passed.`);
