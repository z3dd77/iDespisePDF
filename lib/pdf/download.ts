import { DOWNLOAD_URL_TTL_MS } from "./limits";
import type { ProcessedFile, ProgressReporter } from "./types";

/**
 * Download lifecycle.
 *
 * A blob URL cannot be revoked immediately after `click()`: some browsers have
 * not started reading the blob yet, which produces a failed or empty download.
 * URLs are therefore kept alive for DOWNLOAD_URL_TTL_MS, tracked in a set, and
 * revoked either when the timer fires or when the page is hidden.
 *
 * Unavoidable limitation: there is no event that reports "the download
 * finished". The TTL is a safety margin, not a completion signal.
 */

const pendingUrls = new Map<string, ReturnType<typeof setTimeout>>();
let lifecycleInstalled = false;

function revoke(url: string): void {
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }

  const timer = pendingUrls.get(url);

  if (timer !== undefined) {
    clearTimeout(timer);
    pendingUrls.delete(url);
  }
}

export function revokeAllDownloadUrls(): void {
  for (const url of [...pendingUrls.keys()]) {
    revoke(url);
  }
}

function installLifecycle(): void {
  if (lifecycleInstalled || typeof window === "undefined") {
    return;
  }

  lifecycleInstalled = true;
  window.addEventListener("pagehide", revokeAllDownloadUrls);
}

function holdUrl(url: string): void {
  installLifecycle();

  const timer = setTimeout(() => {
    revoke(url);
  }, DOWNLOAD_URL_TTL_MS);

  pendingUrls.set(url, timer);
}

export function downloadBytes(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
): void {
  // Copy into a plain ArrayBuffer-backed view so Blob accepts it everywhere.
  const safeBytes = new Uint8Array(bytes);
  const blob = new Blob([safeBytes], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  holdUrl(url);
}

export function downloadFile(file: ProcessedFile): void {
  downloadBytes(file.bytes, file.mimeType, file.fileName);
}

/**
 * Browsers throttle or block rapid successive downloads, so files are spaced
 * out. The user is told this in the result panel.
 */
export async function downloadFilesSequentially(
  files: readonly ProcessedFile[],
  onProgress?: ProgressReporter,
): Promise<void> {
  for (const [index, file] of files.entries()) {
    downloadFile(file);
    onProgress?.({ completed: index + 1, total: files.length });

    if (index < files.length - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 350);
      });
    }
  }
}
