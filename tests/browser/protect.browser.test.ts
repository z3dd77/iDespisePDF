import { describe, expect, it } from "vitest";

import { protectPdf } from "@/lib/pdf/protect";
import { loadPdfJs } from "@/lib/pdf/raster";
import { makePdf } from "../fixtures/pdf-fixtures";

const PASSWORD = "open sesame 42";

/**
 * PDF.js is used here deliberately: it is a different engine from the library
 * that wrote the file, so this is an independent check of the encryption.
 */
async function openWithPdfJs(bytes: Uint8Array, password?: string) {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    password,
  });
  const doc = await task.promise;

  return {
    doc,
    close: async () => {
      await task.destroy();
    },
  };
}

describe("protection verified by an independent PDF.js load", () => {
  it("requires the password and accepts only the correct one", async () => {
    const pdf = await makePdf([
      [200, 300],
      [300, 400],
      [400, 500],
    ]);
    const { files } = await protectPdf(
      pdf,
      { userPassword: PASSWORD },
      "contract.pdf",
    );
    const bytes = files[0].bytes;

    await expect(openWithPdfJs(bytes)).rejects.toMatchObject({
      name: "PasswordException",
    });
    await expect(openWithPdfJs(bytes, "wrong password")).rejects.toMatchObject({
      name: "PasswordException",
    });

    const { doc, close } = await openWithPdfJs(bytes, PASSWORD);

    try {
      expect(doc.numPages).toBe(3);
    } finally {
      await close();
    }
  });

  it("keeps the page geometry intact", async () => {
    const pdf = await makePdf([[200, 300]]);
    const { files } = await protectPdf(pdf, { userPassword: PASSWORD }, "x.pdf");
    const { doc, close } = await openWithPdfJs(files[0].bytes, PASSWORD);

    try {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });

      expect(Math.round(viewport.width)).toBe(200);
      expect(Math.round(viewport.height)).toBe(300);
    } finally {
      await close();
    }
  });

  it("writes an AES-256 revision 6 dictionary", async () => {
    const pdf = await makePdf([[200, 300]]);
    const { files } = await protectPdf(pdf, { userPassword: PASSWORD }, "x.pdf");
    const raw = new TextDecoder("latin1").decode(files[0].bytes);

    expect(raw).toContain("/Encrypt");
    expect(raw).toContain("AESV3");
    expect(raw).toMatch(/\/R\s+6/);
  });
});
