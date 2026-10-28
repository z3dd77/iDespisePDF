#!/usr/bin/env node

import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";

async function main() {
  // Create a simple PDF
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([200, 200]);
  page.drawText("Owner only encrypted", { x: 10, y: 180, size: 12, font });

  // Encrypt with only owner password (no user password)



  doc.encrypt({ userPassword: "", ownerPassword: "ownerSecret" });

  const bytes = await doc.save();

  console.log("Saved PDF length:", bytes.length);

  // Attempt load without password (undefined)
  try {
    const { PDFDocument: P } = await import("@cantoo/pdf-lib");
    const loaded1 = await P.load(bytes);
    console.log("Loaded without password succeeded, pages:", loaded1.getPageCount());
  } catch (e) {
    console.error("Load without password error:", e?.message ?? e);
  }

  // Attempt load with empty string password
  try {
    const { PDFDocument: P } = await import("@cantoo/pdf-lib");
    const loaded2 = await P.load(bytes, { password: "" });
    console.log("Loaded with empty password succeeded, pages:", loaded2.getPageCount());
  } catch (e) {
    console.error("Load with empty password error:", e?.message ?? e);
  }
}

main().catch((e) => {
  console.error("Unexpected error", e);
  process.exit(1);
});
