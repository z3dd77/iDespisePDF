import { PdfToolkitError } from "./errors";
import { loadPdf, savePdf } from "./read";
import type {
  ProcessingResult,
  ProgressReporter,
  ProtectOptions,
} from "./types";
import { stripExtension } from "./validate";

/**
 * AES-256 password protection via @cantoo/pdf-lib.
 *
 * Verified before release by tests/protect.test.ts (library-level) and
 * tests/browser/protect.browser.test.ts (independent PDF.js check).
 *
 * Passwords are used in memory only. They are never logged, persisted, placed
 * in a URL, or sent anywhere.
 */
export async function protectPdf(
  bytes: Uint8Array,
  options: ProtectOptions,
  fileName: string,
  onProgress?: ProgressReporter,
): Promise<ProcessingResult> {
  const userPassword = options.userPassword;

  if (typeof userPassword !== "string" || userPassword.length === 0) {
    throw new PdfToolkitError("protection-failed", "password is empty");
  }

  const { doc, pageCount } = await loadPdf(bytes);

  if (typeof doc.encrypt !== "function") {
    throw new PdfToolkitError(
      "protection-failed",
      "installed pdf-lib build has no encrypt()",
    );
  }

  const permissions = options.permissions;

  try {
    doc.encrypt({
      userPassword,
      ownerPassword: options.ownerPassword || userPassword,
      algorithm: "AES-256",
      permissions: permissions
        ? {
            printing: permissions.printing ? "highResolution" : false,
            copying: permissions.copying,
            modifying: permissions.modifying,
            annotating: permissions.modifying,
            fillingForms: permissions.modifying,
            // Accessibility is always allowed; restricting it is not a feature.
            contentAccessibility: true,
            documentAssembly: false,
          }
        : undefined,
    });
  } catch (error) {
    throw new PdfToolkitError(
      "protection-failed",
      error instanceof Error ? error.name : "encrypt failed",
    );
  }

  const output = await savePdf(doc);
  onProgress?.({ completed: 1, total: 1 });

  return {
    files: [
      {
        fileName: `${stripExtension(fileName)}-protected.pdf`,
        mimeType: "application/pdf",
        bytes: output,
        pageCount,
      },
    ],
    notes: [
      "Encrypted with AES-256 (PDF revision 6). Opening the file requires the password you set.",
      "Permission flags are advisory: some third-party tools ignore them. The open password is the real protection.",
      "The password is not stored anywhere. If it is lost, the file cannot be recovered by this app.",
    ],
  };
}
