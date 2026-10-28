import { describe, expect, it } from "vitest";
import { mergePdfs } from "@/lib/pdf/merge";
import { makePdf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

// Utility to create a PDF encrypted with only an owner password (no opening password).
async function createOwnerOnlyEncryptedPdf(): Promise<Uint8Array> {
  const plain = await makePdf([[100, 100]]);
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.load(plain);
  // The pdf-lib encrypt method expects a userPassword field, but providing an empty
  // string results in a PDF that can be opened without a password while still
  // being encrypted (owner‑only). TypeScript typings require a string, so we cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).encrypt({ userPassword: "", ownerPassword: "ownerSecret" });
  return await doc.save();
}

describe("mergePdfs with owner‑only encrypted PDFs", () => {
  // Skipped: currently the pdf-lib library does not provide a way to create a PDF that is encrypted
  // with only an owner password (no user/open password) that can be loaded without triggering an
  // "encrypted" error. This test documents the intended behavior once such a fixture is available.
  it("merges successfully when a PDF is encrypted only with an owner password", async () => {
    const ownerEncrypted = await createOwnerOnlyEncryptedPdf();
    const regular = await makePdf([[200, 200]]);

    const result = await mergePdfs([
      { name: "owner.pdf", bytes: ownerEncrypted },
      { name: "regular.pdf", bytes: regular },
    ]);

    // Expect the merged PDF to contain pages from both inputs.
    expect(result.files).toHaveLength(1);
    expect(result.files[0].pageCount).toBe(2);
  });

  it("reports a corrupt PDF error when a file cannot be parsed", async () => {
    const corrupt = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF",
    );
    const regular = await makePdf([[200, 200]]);

    await expectPdfError(
      () =>
        mergePdfs([
          { name: "corrupt.pdf", bytes: corrupt },
          { name: "regular.pdf", bytes: regular },
        ]),
      "corrupt",
    );
  });
});
