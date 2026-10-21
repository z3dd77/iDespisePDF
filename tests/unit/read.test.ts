import { describe, expect, it } from "vitest";

import { loadPdf } from "@/lib/pdf/read";
import { protectPdf } from "@/lib/pdf/protect";
import { makePdf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

describe("loadPdf", () => {
  it("loads a valid PDF and reports its page count", async () => {
    const pdf = await makePdf([
      [100, 100],
      [120, 120],
      [140, 140],
    ]);

    const { pageCount } = await loadPdf(pdf);
    expect(pageCount).toBe(3);
  });

  it("rejects an empty file before touching the library", async () => {
    await expectPdfError(() => loadPdf(new Uint8Array(0)), "empty-file");
  });

  it("rejects a non-PDF payload", async () => {
    await expectPdfError(
      () => loadPdf(new TextEncoder().encode("<html>not a pdf</html>")),
      "not-a-pdf",
    );
  });

  it("rejects a damaged document", async () => {
    const corrupt = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF",
    );

    await expectPdfError(() => loadPdf(corrupt), "corrupt");
  });

  it("rejects an encrypted document without a password", async () => {
    const pdf = await makePdf([[100, 100]]);
    const { files } = await protectPdf(pdf, { userPassword: "secret" }, "x.pdf");

    await expectPdfError(() => loadPdf(files[0].bytes), "encrypted");
  });
});
