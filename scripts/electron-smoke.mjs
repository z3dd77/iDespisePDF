/**
 * Launches the Electron shell against the local static export and verifies
 * that the app:// protocol, client routing, the PDF.js worker, and downloads
 * all work outside a browser.
 *
 * Downloads are redirected to a temp directory through
 * IDESPISE_DOWNLOAD_DIR so the test never touches the real Downloads folder.
 *
 * Requires `npm run build:static` first.
 */
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PDFDocument } from "@cantoo/pdf-lib";
import { _electron as electron } from "playwright";

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

async function waitForDownload(directory, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const names = await readdir(directory).catch(() => []);
    const pdf = names.find((name) => name.endsWith(".pdf"));
    if (pdf) {
      return join(directory, pdf);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

const dir = await mkdtemp(join(tmpdir(), "idespise-electron-"));
const downloadDir = join(dir, "downloads");
await mkdir(downloadDir, { recursive: true });

const pdfPath = join(dir, "electron-a.pdf");
const source = await PDFDocument.create();
source.addPage([200, 300]);
await writeFile(pdfPath, await source.save());

const secondPath = join(dir, "electron-b.pdf");
const second = await PDFDocument.create();
second.addPage([400, 500]);
await writeFile(secondPath, await second.save());

const app = await electron.launch({
  ...(process.env.IDESPISE_EXECUTABLE
    ? { executablePath: process.env.IDESPISE_EXECUTABLE, args: [] }
    : { args: ["."] }),
  timeout: 60_000,
  env: { ...process.env, IDESPISE_DOWNLOAD_DIR: downloadDir },
});
const page = await app.firstWindow({ timeout: 60_000 });
page.setDefaultTimeout(30_000);

const errors = [];
const missing = new Set();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});
page.on("response", (response) => {
  if (response.status() >= 400) {
    missing.add(`${response.status()} ${response.url()}`);
  }
});

try {
  await page.waitForLoadState("domcontentloaded");
  check((await page.title()).includes("iDespisePDF"), "window loads the app over app://");
  check(page.url().startsWith("app://idespise"), `window URL is ${page.url()}`);

  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const logoLoaded = await page
    .getByRole("img", { name: "iDespisePDF" })
    .first()
    .evaluate((image) => image.complete && image.naturalWidth > 0);
  check(logoLoaded, "logo loads from the custom protocol");

  await page.getByRole("link", { name: "Merge PDFs" }).first().click();
  await page.waitForURL(/\/tools\/merge\/?$/);
  check(page.url().includes("/tools/merge"), "client-side routing reaches the merge tool");

  const packageJson = JSON.parse(
    await readFile(join(process.cwd(), "package.json"), "utf8"),
  );
  const bridge = await page.evaluate(() => {
    const desktop = window.idespiseDesktop;
    return desktop
      ? {
          platform: desktop.platform,
          hasUpdates: typeof desktop.updates?.getState === "function",
        }
      : null;
  });
  check(bridge?.hasUpdates === true, "preload exposes the desktop update bridge");
  check(
    typeof bridge?.platform === "string",
    `preload reports the platform (${bridge?.platform})`,
  );

  const updateState = await page.evaluate(() =>
    window.idespiseDesktop?.updates.getState(),
  );
  check(
    updateState?.currentVersion === packageJson.version,
    `update state reports v${updateState?.currentVersion}`,
  );
  check(
    typeof updateState?.supported === "boolean",
    "update state reports whether updates are supported",
  );

  await page
    .getByRole("button", { name: /Check for updates|Update ready|Downloading update/ })
    .waitFor();
  check(true, "footer exposes the update control");

  if (!process.env.IDESPISE_EXECUTABLE) {
    await page.getByRole("button", { name: "Check for updates" }).click();
    await page.getByRole("dialog").waitFor();
    check(
      await page
        .getByText(/installed Windows app/i)
        .isVisible(),
      "dev build explains that updates run in the installed app",
    );
    await page.getByRole("button", { name: "Close update dialog" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }

  await page.setInputFiles('input[type="file"]', [pdfPath, secondPath]);
  await page.getByText("electron-a.pdf", { exact: true }).waitFor();
  await page.getByRole("img", { name: "Preview of electron-a.pdf" }).waitFor();
  await page.getByRole("img", { name: "Preview of electron-b.pdf" }).waitFor();
  check(true, "PDF.js worker renders a cover thumbnail over app://");

  await page.getByRole("button", { name: /Merge 2 PDFs/i }).click();
  await page.getByRole("button", { name: "Download", exact: true }).first().click();

  const saved = await waitForDownload(downloadDir);
  check(saved !== null, "clicking Download writes a file to disk");

  if (saved !== null) {
    check(saved.endsWith("electron-a-merged.pdf"), `download is named ${saved.split(/[\\/]/).pop()}`);
    const merged = await PDFDocument.load(await readFile(saved));
    check(merged.getPageCount() === 2, `downloaded PDF has ${merged.getPageCount()} pages`);
  }
} catch (error) {
  check(false, `electron flow failed: ${error.message}`);
} finally {
  await app.close();
}

check(errors.length === 0, `no renderer errors${errors.length ? `: ${errors[0]}` : ""}`);
check(missing.size === 0, `no failed requests${missing.size ? `: ${[...missing].join(", ")}` : ""}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} of ${checks} Electron checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks} Electron checks passed.`);
