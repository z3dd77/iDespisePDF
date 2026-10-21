import { PDFDocument } from "@cantoo/pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";

import { protectPdf } from "@/lib/pdf/protect";
import type { ProcessedFile } from "@/lib/pdf/types";
import { makePdf, pageSizesOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

const USER_PASSWORD = "correct horse battery";

function latin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

describe("protectPdf", () => {
  let source: Uint8Array;
  let protectedFile: ProcessedFile;

  beforeAll(async () => {
    source = await makePdf(
      [
        [200, 300],
        [300, 400],
      ],
      "protect",
    );

    const result = await protectPdf(
      source,
      {
        userPassword: USER_PASSWORD,
        permissions: { printing: false, copying: false, modifying: false },
      },
      "contract.pdf",
    );

    protectedFile = result.files[0];
  });

  it("returns a new PDF named after the source", () => {
    expect(protectedFile.fileName).toBe("contract-protected.pdf");
    expect(protectedFile.mimeType).toBe("application/pdf");
    expect(protectedFile.pageCount).toBe(2);
  });

  it("cannot be opened without a password", async () => {
    await expect(PDFDocument.load(protectedFile.bytes)).rejects.toThrow();
  });

  it("opens with the correct password and keeps page content", async () => {
    const doc = await PDFDocument.load(protectedFile.bytes, {
      password: USER_PASSWORD,
    });

    expect(doc.getPageCount()).toBe(2);
    expect(await pageSizesOf(source)).toEqual([
      [200, 300],
      [300, 400],
    ]);
  });

  it("rejects an incorrect password", async () => {
    await expect(
      PDFDocument.load(protectedFile.bytes, { password: "wrong password" }),
    ).rejects.toThrow(/password/i);
  });

  it("writes an /Encrypt dictionary using AES-256 revision 6", () => {
    const raw = latin1(protectedFile.bytes);

    expect(raw).toContain("/Encrypt");
    expect(raw).toContain("AESV3");
    expect(raw).toMatch(/\/R\s+6/);
    expect(raw).not.toContain("AESV2");
  });

  it("states that permission flags are advisory", async () => {
    const result = await protectPdf(source, { userPassword: USER_PASSWORD }, "x.pdf");
    const notes = result.notes.join(" ");

    expect(notes).toContain("AES-256");
    expect(notes).toContain("advisory");
    expect(notes).not.toContain(USER_PASSWORD);
  });

  it("rejects an empty password", async () => {
    await expectPdfError(
      () => protectPdf(source, { userPassword: "" }, "x.pdf"),
      "protection-failed",
    );
  });

  it("rejects an already encrypted input", async () => {
    await expectPdfError(
      () => protectPdf(protectedFile.bytes, { userPassword: USER_PASSWORD }, "x.pdf"),
      "encrypted",
    );
  });
});
