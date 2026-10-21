# `lib/pdf/` boundary

This directory is the only place PDF work happens.

## Rules

1. **No React.** Nothing here imports components, hooks, or JSX. Every export
   is callable from a plain function context so it can be unit tested without a
   DOM.
2. **No network.** No `fetch`, no uploads, no server calls. Files enter as
   bytes and leave as bytes.
3. **Validate before processing.** Signatures are checked from the leading
   bytes, not the filename or MIME type. Size, page, and file-count ceilings
   live in `limits.ts`.
4. **Fail with vocabulary, not library noise.** Throw `PdfToolkitError` with a
   `PdfErrorCode`. Raw pdf-lib / PDF.js errors are mapped in `read.ts` and
   `raster.ts`.
5. **Order is explicit.** Page numbers are 1-based. `PageSelection`/`order`
   arrays are ordered; `normalizeSelection` converts to document order where
   that is the honest behavior (extract).
6. **Disclose tradeoffs.** Anything that changes quality returns notes in the
   result so the UI can show it. Compression returns a `not-smaller` outcome
   instead of a stand-in file.
7. **Clean up.** PDF.js documents are destroyed, canvases are released, and
   download URLs expire (see `download.ts`).

## Layout

| File | Responsibility |
| --- | --- |
| `types.ts` | Vocabulary: inputs, results, progress, compression outcomes |
| `errors.ts` | `PdfErrorCode`, user-facing messages, `PdfToolkitError` |
| `limits.ts` | Size, page, file-count, and pixel ceilings |
| `presets.ts` | Compression presets, page sizes, fit options, raster scales |
| `pages.ts` | Pure page arithmetic: ranges, selection, rotation, reordering |
| `validate.ts` | Byte-signature and size validation |
| `read.ts` | Single PDF load path; library error mapping; page limits |
| `build.ts` | Copy a page subset into a new document |
| `merge.ts` | Concatenate several PDFs |
| `split.ts` | Split by ranges, by group size, or one file per page |
| `extract.ts` | Selected pages into a new PDF |
| `reorder.ts` | Reorder pages via a validated permutation |
| `rotate.ts` | Additive page rotation |
| `images.ts` | PNG/JPEG to PDF with page size and fit math |
| `raster.ts` | PDF.js loading, worker config, page rendering, thumbnails |
| `compress.ts` | Rasterize, rebuild, measure, and decide |
| `pdf-to-images.ts` | Pages to PNG/JPEG |
| `protect.ts` | AES-256 encryption via `@cantoo/pdf-lib` |
| `download.ts` | Blob download lifecycle and sequential downloads |

## Constraints to design around

- `@cantoo/pdf-lib` (MIT, actively maintained) is used instead of upstream
  `pdf-lib@1.17.1`, which cannot encrypt or open encrypted files. Its API is
  the pdf-lib API plus `load({ password })`, `isEncrypted`, and `encrypt()`.
- Encryption is only advertised after tests prove it: library-level tests plus
  an independent PDF.js check (`PasswordException` without a password, success
  with it).
- Permission flags are advisory. Some third-party tools ignore them; the open
  password is the real protection. The UI says so.
- Compression is destructive by nature. It is measured, and a larger result is
  reported as failure rather than substituted with the original.
- PDF.js needs a served worker. `scripts/sync-pdf-assets.mjs` copies
  `pdf.worker.min.mjs` into `public/` before dev, build, and test.
