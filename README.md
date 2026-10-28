# iDespisePDF

Local-first PDF utilities. Files are opened, processed, and downloaded on your
own device. There is no upload endpoint, no account, and no server-side document
storage. The same web build also ships as a Windows desktop app (Electron).

**Status: all tools are implemented.** The desktop app wraps the same
static export. Each tool has its own page, its own stated limits, and real
processing behind it. Compression and protection are the two tools with quality
or security caveats, and both state those caveats in the UI before they run.

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
| Windows app | Electron 45 + electron-builder (NSIS installer) |

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
npm run build:static # static export in out/ for the Electron shell
npm run electron:bundle # bundle the updater entry point into electron/updates.bundle.cjs
npm run electron:start # bundle, then launch the Electron shell on the static export
npm run electron:smoke # Electron end-to-end check (protocol, worker, download, update bridge)
npm run dist:win     # build release/iDespisePDF-Setup-<version>.exe and update metadata
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
  site-footer.tsx         Footer with the current status and desktop update control
  updates/update-center.tsx Desktop-only check, download, install, and changelog dialog
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
electron/
  main.mjs                app:// protocol, secure window, download and updater wiring
  updates.mjs             GitHub update state machine and post-update changelog
  update-utils.mjs        Pure release-note and "what's new" helpers
  preload.cjs             Narrow contextBridge API for the renderer
resources/icon.png        Square app icon derived from the logo
.github/workflows/        Tag-triggered Windows release build
```

Tool UI kit (`components/tools/`): `tool-shell`, `file-drop-zone`, `file-list`,
`selected-file`, `page-grid`, `page-order-grid`, `page-range-input`,
`option-group`, `progress-panel`, `result-panel`, `error-notice`.

## Tools

| Tool | What it does | Caveat |
| --- | --- | --- |
| Merge | Concatenates PDFs in a chosen order | Pages are copied, not re-encoded |
| Split | Ranges, every N pages, or one file per page | Source is read only |
| Compress | Re-renders pages of one or more PDFs at a preset resolution and quality | Destroys text, links, annotations, accessibility; no file for a result that is not smaller |
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

Compression accepts one or more PDFs and applies the same preset to every file.
Each input is judged on its own: only genuinely smaller outputs are offered.
Files that cannot shrink, are encrypted or damaged, or exceed the 120-page
raster limit are listed with the reason and left untouched, while the rest of
the batch continues.

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
  rotate page order, images-to-PDF page sizing, encryption round-trip, the
  compression decision rule, and the updater's release-note and "what's new"
  helpers.
- **Browser (Chromium)** — PDF.js worker loading, thumbnails, page rendering,
  PDF-to-image output, compression size reporting, and the PDF.js encryption
  cross-check.
- Route smoke tests confirm each page returns HTML and that the landing page
  does not load PDF.js or the PDF engine in its initial client bundle. HTTP 200
  is not treated as proof that an interactive flow was exercised.
- `scripts/ui-smoke.mjs` drives all tools in Chromium: it uploads real
  files, clicks the real buttons, downloads the output, and parses it back. It
  requires `npm start`, a Chromium install, and also confirms that the browser
  build exposes no desktop update control.
- `scripts/electron-smoke.mjs` does the same for the desktop shell: app:// load,
  client routing, a PDF.js cover, merge, a file actually written to disk, the
  preload update bridge, and the footer update control. Downloads are redirected
  to a temp directory so the real Downloads folder is untouched.
- The check/download/install path itself needs two packaged versions and a feed.
  It is rehearsed with `IDESPISE_UPDATE_FEED_URL` serving a newer build, because
  HTTP success alone is not evidence that an installer ran and relaunched.

## Previews

- Merge renders **page 1 of each input file** as a cover, sequentially, capped
  at 24 files. Reordering the list does not re-render existing covers.
- Split, rotate, reorder, extract, and PDF to images render full page grids.
- Compress shows a cover for each input file (up to 24); protect shows a single
  cover; images to PDF shows the actual image previews from local object URLs,
  revoked when a file is removed.

## Windows desktop app

- `npm run build:static` produces `out/`; Electron serves it over `app://` so
  Next.js routing and the PDF.js worker behave as they do on the web.
- `npm run dist:win` builds `release/iDespisePDF-Setup-<version>.exe` (NSIS,
  x64, per-user install, no admin prompt), plus `latest.yml`, the NSIS
  `.blockmap`, and the packaged `app-update.yml`.
- Downloads go to the user's Downloads folder, with `(1)`, `(2)` suffixes
  instead of overwriting an existing file.
- Releases are published by `.github/workflows/release.yml` when a `v*` tag is
  pushed. Each release includes the installer, `latest.yml`, the blockmap, and
  `SHA256SUMS.txt`.
- The installer is not code-signed, so Windows SmartScreen shows an unknown
  publisher warning. SmartScreen can also interrupt the silent install step of
  an automatic update until the app is code-signed.
- `npm run electron:smoke` launches the window, checks the custom protocol, the
  PDF.js worker, client routing, a real merge plus download, and the preload
  update bridge. Set `IDESPISE_EXECUTABLE` to the packaged `iDespisePDF.exe` to
  test the packaged build instead of the dev binary.

## Desktop updates

The installed Windows app checks GitHub Releases when the user chooses **Check
for updates** in the footer. The app does not poll in the background.

- The check is manual. When a newer version exists, the app downloads it
  automatically, shows progress, and then offers **Restart and install**.
  Choosing **Later** installs the downloaded update the next time the app quits.
- The available release's GitHub changelog is shown in the dialog. After the new
  version starts, a one-time **What's new** dialog shows the same notes. The
  notes are cached in the app's user-data directory before installation, so the
  dialog still works if the machine is offline after the update.
- Update checks contact `api.github.com` for release metadata. They do not send
  document files, document names, or usage data. The updater downloads the
  installer from the GitHub release over HTTPS and verifies the SHA-512 digest
  from `latest.yml` before running it.
- The renderer never receives `ipcRenderer` or Node access. A sandbox-compatible
  preload exposes only the update methods, and the main process owns all network
  and install operations.
- The web build renders no update control because `window.idespiseDesktop` is
  absent.
- Updates work from v1.1.0 onward. The earlier v1.0.0 release has no
  `latest.yml`, so it cannot be updated in place.

For local update rehearsal, set `IDESPISE_UPDATE_FEED_URL` to a local HTTP
server that serves a newer `latest.yml`, installer, and blockmap. The updater
switches to that generic feed and still uses the normal check/download/install
path. This is a test hook, not a user-facing setting.

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
- **Raster operations are capped at 120 pages per run.** Each page is fitted to
  a 16-megapixel area and an 8,192-pixel side limit; a page that would exceed
  either limit is rendered at a lower effective resolution and the result says
  so.
- **Multi-file results download sequentially**, not as a ZIP. Browsers throttle
  rapid downloads and may ask for permission.
- **Blob URLs are revoked 60 seconds after a download is triggered**, not
  immediately, because revoking on click can abort the download. There is no
  browser event for "download finished", so the delay is a safety margin rather
  than a completion signal.
- **Files are capped** at 100 MB each, 300 MB per run, and 2,000 pages.
- **Browser memory is the real ceiling.** Very large pages are rendered below
  the requested resolution rather than risking a blank canvas, and the result
  notes the lower resolution. Other render failures are reported, not hidden.
- **Desktop updates are manual and need GitHub access.** There is no background
  polling, and a check fails cleanly when the machine is offline. GitHub's
  unauthenticated API limit is 60 release requests per hour per IP; normal use
  stays far below it.
- **Desktop updates start at v1.1.0.** The v1.0.0 installer predates the updater
  and cannot update itself. The installer is unsigned, so SmartScreen may
  interrupt an automatic update until the build is code-signed.

## Principles

1. Process locally. No uploads, no backend for documents.
2. Keep PDF logic out of components.
3. Validate inputs and fail with human-readable errors.
4. Do not claim a feature works until it is implemented and tested.
5. State limitations in the product, not just in the README.
