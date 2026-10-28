import { describe, expect, it } from "vitest";

import { mergePdfs } from "@/lib/pdf/merge";
import type { JobProgress } from "@/lib/pdf/types";
import { makePdf, pageSizesOf } from "../fixtures/pdf-fixtures";
import { expectPdfError } from "../fixtures/assert-error";

describe("mergePdfs", () => {
  it("concatenates pages in input order", async () => {
    const first = await makePdf(
      [
        [200, 300],
        [210, 310],
      ],
      "first",
    );
    const second = await makePdf([[400, 500]], "second");

    const result = await mergePdfs([
      { name: "first.pdf", bytes: first },
      { name: "second.pdf", bytes: second },
    ]);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].fileName).toBe("first-merged.pdf");
    expect(result.files[0].pageCount).toBe(3);
    expect(await pageSizesOf(result.files[0].bytes)).toEqual([
      [200, 300],
      [210, 310],
      [400, 500],
    ]);
    expect(result.notes.join(" ")).toContain("3 page PDF");
  });

  it("reports one progress step per input", async () => {
    const first = await makePdf([[100, 100]]);
    const second = await makePdf([[120, 120]]);
    const third = await makePdf([[140, 140]]);
    const progress: JobProgress[] = [];

    await mergePdfs(
      [
        { name: "a.pdf", bytes: first },
        { name: "b.pdf", bytes: second },
        { name: "c.pdf", bytes: third },
      ],
      (update) => progress.push(update),
    );

    expect(progress).toEqual([
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);
  });

  it("rejects a single input", async () => {
    const only = await makePdf([[100, 100]]);

    await expectPdfError(
      () => mergePdfs([{ name: "only.pdf", bytes: only }]),
      "not-enough-files",
    );
  });

  it("rejects an encrypted input", async () => {
    const { protectPdf } = await import("@/lib/pdf/protect");
    const plain = await makePdf([[100, 100]]);
    const { files } = await protectPdf(plain, { userPassword: "secret" }, "x.pdf");

    await expectPdfError(
      () =>
        mergePdfs([
          { name: "locked.pdf", bytes: files[0].bytes },
          { name: "plain.pdf", bytes: plain },
        ]),
      "encrypted",
    );
  });
  it('handles many PDFs without false encryption error', async () => {
    const inputs = [];
    for (let i = 0; i < 20; i++) {
      const bytes = await makePdf([[100 + i, 100 + i]]);
      inputs.push({ name: `file${i}.pdf`, bytes });
    }
    const result = await mergePdfs(inputs);
    expect(result.files[0].pageCount).toBe(20);
  });
});
