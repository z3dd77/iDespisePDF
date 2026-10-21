# iDespisePDF

Local-first PDF utilities. Files are opened, processed, and downloaded in the
browser. There is no upload endpoint, no account, and no server-side document
storage.

**Status: all nine tools are implemented.** Each tool has its own page, its own
stated limits, and real processing behind it. Compression and protection are the
two tools with quality or security caveats, and both state those caveats in the
UI before they run.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4, CSS-first `@theme` tokens |
| Icons | Lucide |
| PDF engine | `@cantoo/pdf-lib` 2.11.1 (MIT) — pdf-lib API plus encryption |
| Rendering | `pdfjs-dist` 6.4.299 with its worker served from `public/` |
| Tests | Vitest 5 (node project + Chromium browser project via Playwright) |

`@cantoo/pdf-lib` is used instead of upstream `pdf-lib@1.17.1` because upstream
cannot open encrypted files or add encryption.

## Commands

```bash
npm run dev          # sync PDF.js worker, then start dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # unit + browser tests
npm run test:unit    # node project only
npm run test:browser # Chromium project only
npm run build        # sync worker, then production build
npm start            # serve the production build
npm run smoke        # route smoke test against a running server
npm run ui-smoke     # end-to-end UI test in Chromium against a running server
```

`scripts/sync-pdf-assets.mjs` copies `pdf.worker.min.mjs` from `node_modules`
into `public/` before `dev`, `build`, and `test`. The generated file is
gitignored. Browser tests need Chromium: `npx playwright install chromium`.

## Structure

```
app/
  layout.tsx              App shell: header, main landmark, footer
  page.tsx                Landing page: hero, tools, build status, privacy
  globals.css             Design tokens, base styles, focus and motion rules
  tools/<slug>/page.tsx   One route per tool, each rendering its client tool
components/
  site-header.tsx         Sticky header and primary navigation
  site-footer.tsx         Footer with the current status
  drop-zone-preview.tsx   Landing illustration that links to the tools
  tool-card.tsx           Tool card with live status
  tool-placeholder.tsx    Shared page for an unavailable tool
  status-pill.tsx         Status label
  tools/                  Tool UI kit (see below)
hooks/
  use-tool-job.ts         idle -> working -> done | error, with progress
  use-pdf-preview.ts      Thumbnail rendering with cancellation
lib/
  tools.ts                Single source of truth for tool metadata
  files.ts                File intake, per-file validation, error collection
  format.ts               Byte and count formatting
  cn.ts                   Class name join
  pdf/                    Processing boundary: no React, no network
```

Tool UI kit (`components/tools/`): `tool-shell`, `file-drop-zone`, `file-list`,
`selected-file`, `page-grid`, `page-order-grid`, `page-range-input`,
`option-group`, `progress-panel`, `result-panel`, `error-notice`.

## Tools

| Tool | What it does | Caveat |
| --- | --- | --- |
| Merge | Concatenates PDFs in a chosen order | Pages are copied, not re-encoded |
| Split | Ranges, every N pages, or one file per page | Source is read only |
| Compress | Re-renders pages at a preset resolution and quality | Destroys text, links, annotations, accessibility; returns no file if the result is not smaller |
| Rotate | Adds 90/180/270 to selected pages | Orientation only; content is not re-rendered |
| Reorder | Drag/arrow page ordering | Needs a preview for every page (up to 200) |
| Extract pages | Selected pages into a new PDF | Output follows document order |
| Images to PDF | PNG/JPEG to a PDF with page size, fit, orientation, margin | PNG and JPEG only |
| PDF to images | PNG/JPEG page renders | Capped at 120 pages and a per-page pixel budget |
| Protect | AES-256 encryption with optional permission flags | Permission flags are advisory, not enforcement |

## Compression behavior

Compression works by rasterizing each page with PDF.js at a preset DPI, encoding
it as JPEG, and rebuilding the PDF with `@cantoo/pdf-lib`. Presets:

| Preset | DPI | JPEG quality |
| --- | --- | --- |
| Screen | 96 | 0.60 |
| Balanced | 144 | 0.75 |
| Print | 200 | 0.88 |

Before running, the UI lists what is lost: selectable text, links, annotations,
form fields, bookmarks, vector sharpness, and accessibility data. The measured
input and output sizes are reported. If the output is not smaller, the result is
reported as `not-smaller`, no file is offered, and the original is untouched.
The original file is never overwritten.

## Protection behavior

- Encryption: AES-256, PDF revision 6, via `PDFDocument.encrypt()`.
- Verified by library-level tests (encrypt, open with the correct password,
  reject a wrong password, reject no password) and by an independent PDF.js
  check (`PasswordException` without the password, successful load with it).
- Passwords are used in memory only. They are never logged, persisted, placed in
  a URL, or sent anywhere.
- Permission flags (printing, copying, editing) are advisory. Compliant readers
  honor them; some third-party tools ignore them. The open password is the real
  protection.
- The app cannot recover a lost password.

## Testing

- **Unit (node)** — page range parsing, selection normalization, rotation math,
  permutation checks, byte-signature validation, merge/split/extract/reorder/
  rotate page order, images-to-PDF page sizing, encryption round-trip, and the
  compression decision rule.
- **Browser (Chromium)** — PDF.js worker loading, thumbnails, page rendering,
  PDF-to-image output, compression size reporting, and the PDF.js encryption
  cross-check.
- Route smoke tests confirm each page returns HTML and that the landing page
  does not load PDF.js or the PDF engine in its initial client bundle. HTTP 200
  is not treated as proof that an interactive flow was exercised.
- `scripts/ui-smoke.mjs` drives all nine tools in Chromium: it uploads real
  files, clicks the real buttons, downloads the output, and parses it back. It
  requires `npm start`, a Chromium install, and checks 22 outcomes, including
  the header/footer logo, cover size, and preview thumbnails.

## Previews

- Merge renders **page 1 of each input file** as a cover, sequentially, capped
  at 24 files. Reordering the list does not re-render existing covers.
- Split, rotate, reorder, extract, and PDF to images render full page grids.
- Compress and protect show a single cover; images to PDF shows the actual
  image previews from local object URLs, revoked when a file is removed.

## Known limitations

- **Compression is lossy by design.** It is page rasterization, not lossless
  optimization. A document that is mostly text may not get smaller at high
  presets.
- **Encrypted input is rejected** by the eight non-protect tools, because there
  is no password prompt in this version. The message says so.
- **No password removal or unlock tool.**
- **No OCR, digital signatures, PDF/A, or form editing.**
- **Reordering is limited to documents whose pages all have previews** (200
  pages). Larger documents can still be split or have pages extracted.
- **Raster operations are capped at 120 pages per run** and by a per-page pixel
  budget (24 megapixels), which protects the tab from running out of memory.
- **Multi-file results download sequentially**, not as a ZIP. Browsers throttle
  rapid downloads and may ask for permission.
- **Blob URLs are revoked 60 seconds after a download is triggered**, not
  immediately, because revoking on click can abort the download. There is no
  browser event for "download finished", so the delay is a safety margin rather
  than a completion signal.
- **Files are capped** at 100 MB each, 300 MB per run, and 2,000 pages.
- **Browser memory is the real ceiling.** Very large pages can still fail
  rendering even under the pixel budget; the failure is reported, not hidden.

## Principles

1. Process locally. No uploads, no backend for documents.
2. Keep PDF logic out of components.
3. Validate inputs and fail with human-readable errors.
4. Do not claim a feature works until it is implemented and tested.
5. State limitations in the product, not just in the README.
