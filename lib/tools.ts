import {
  Combine,
  FileOutput,
  Images,
  ImagePlus,
  ListOrdered,
  Lock,
  Minimize2,
  RotateCw,
  Scissors,
  type LucideIcon,
} from "lucide-react";

export type ToolStatus = "planned" | "in-progress" | "available";

export type ToolSlug =
  | "merge"
  | "split"
  | "compress"
  | "rotate"
  | "reorder"
  | "extract-pages"
  | "images-to-pdf"
  | "pdf-to-images"
  | "protect"
  | "delete-pages"
  | "add-page-numbers"
  | "watermark"
  | "metadata"
  | "annotate"
  | "sign"
  | "ocr"
  | "unlock";

export type ToolDefinition = {
  slug: ToolSlug;
  name: string;
  summary: string;
  description: string;
  icon: LucideIcon;
  status: ToolStatus;
  /** Scope and limitations stated up front instead of discovered after the fact. */
  caveat?: string;
  capabilities: readonly string[];
};

export const STATUS_LABEL: Record<ToolStatus, string> = {
  planned: "Not built yet",
  "in-progress": "In progress",
  available: "Available",
};

export const TOOLS: readonly ToolDefinition[] = [
  {
    slug: "delete-pages",
    name: "Delete PDF Pages",
    summary: "Remove selected pages from a PDF.",
    description:
      "Choose pages to delete and produce a new PDF that preserves the original page order for the remaining pages.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Select pages via thumbnails or range input",
      "Prevent deletion of all pages",
      "Generate a new PDF without modifying the source",
    ],
  },
  {
    slug: "add-page-numbers",
    name: "Add Page Numbers",
    summary: "Overlay page numbers onto PDF pages.",
    description:
      "Configure number format, position, font size, colour and offset, then add visible page numbers to the document.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Top or bottom placement with left/center/right alignment",
      "Custom start number and offset",
      "Multiple formatting styles (1, 1 of N, Page 1 of N)",
    ],
  },
  {
    slug: "watermark",
    name: "Watermark PDF",
    summary: "Add transparent text watermarks to PDFs.",
    description:
      "Apply a customizable text watermark (preset or custom) with opacity, rotation, size, colour and placement to all or selected pages.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Preset texts (DRAFT, CONFIDENTIAL, COPY) and custom text",
      "Control opacity, rotation, colour, font size and placement",
      "Apply to selected pages",
    ],
  },
  {
    slug: "metadata",
    name: "PDF Metadata Editor",
    summary: "View and edit standard PDF metadata fields.",
    description:
      "Inspect and modify title, author, subject, keywords and other metadata while leaving document content untouched.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Display current metadata values",
      "Edit, clear or add fields",
      "Preserve page order and content",
    ],
  },
  {
    slug: "annotate",
    name: "Annotate PDF",
    summary: "Add notes, highlights, shapes and freehand drawings.",
    description:
      "Create text notes, highlight rectangles, basic shapes and freehand strokes on selected pages with colour and size controls.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Text notes, highlights, rectangles, arrows, freehand drawing",
      "Undo latest annotation, remove selected annotations",
      "Accurate placement respecting page rotation and scaling",
    ],
  },
  {
    slug: "sign",
    name: "Sign PDF",
    summary: "Place a visual signature image or drawing on a PDF.",
    description:
      "Draw a signature, type a name, or import an image, then position and resize it on the chosen page before exporting.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Signature drawing canvas or image import",
      "Adjust size, position and target page",
      "Remove or edit before export",
    ],
  },
  {
    slug: "ocr",
    name: "OCR PDF",
    summary: "Perform optical character recognition on scanned PDFs.",
    description:
      "Run local OCR on image‑only pages to produce searchable text, with language options and progress feedback.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Local Tesseract.js OCR engine",
      "Select pages and language packs",
      "Output .txt and searchable PDF",
    ],
  },
  {
    slug: "compare",
    name: "Compare PDFs",
    summary: "Show visual and textual differences between two PDFs.",
    description:
      "Compare page counts, extracted text diffs and visual side‑by‑side previews to highlight added, removed or changed pages.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Detect page insertions, deletions, reorderings",
      "Text diff per page",
      "Visual side‑by‑side thumbnail comparison",
    ],
  },
  {
    slug: "unlock",
    name: "Unlock PDF",
    summary: "Remove password protection from a PDF when the password is known.",
    description:
      "Enter the open password, decrypt the PDF locally, and output an unencrypted copy.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Prompt for password securely",
      "Validate password and report errors",
      "Produce an unprotected PDF",
    ],
  },

  {
    slug: "merge",
    name: "Merge PDFs",
    summary: "Join several PDFs into a single document, in the order you set.",
    description:
      "Combine multiple PDF files into one. Pages are copied in the order you arrange, and the output is assembled in this tab.",
    icon: Combine,
    status: "available",
    capabilities: [
      "Add two or more PDFs and arrange their order",
      "Combine them into one document without re-encoding pages",
      "Download the merged file directly from the browser",
    ],
  },
  {
    slug: "split",
    name: "Split PDF",
    summary: "Divide one PDF into separate files by page range.",
    description:
      "Break a document into smaller files by custom range, fixed group size, or one file per page. The source is only read.",
    icon: Scissors,
    status: "available",
    capabilities: [
      "Split at specific page ranges",
      "Split every N pages into equal parts",
      "Download each resulting file separately",
    ],
  },
  {
    slug: "compress",
    name: "Compress PDF",
    summary: "Reduce file size, with the quality tradeoff stated honestly.",
    description:
      "Re-render each page at a chosen resolution and quality, then rebuild the document. The result is measured against the original, and only offered when it is genuinely smaller.",
    icon: Minimize2,
    status: "available",
    caveat:
      "Compression works by re-rendering every page as an image. Selectable text, links, annotations, form fields, bookmarks, and accessibility data do not survive. If a rebuilt file is not smaller, no file is produced for it and the original is left untouched.",
    capabilities: [
      "Compress one or more PDFs with the same preset",
      "See the measured size before and after for each result",
      "Get no file instead of a larger one, with skipped files named and explained",
    ],
  },
  {
    slug: "rotate",
    name: "Rotate PDF",
    summary: "Turn pages upright, individually or all at once.",
    description:
      "Fix sideways scans. Rotation is applied to page orientation rather than re-rendering content, so text stays sharp and selectable.",
    icon: RotateCw,
    status: "available",
    capabilities: [
      "Rotate any page by 90, 180, or 270 degrees",
      "Apply one rotation to every page",
      "Preview the pending rotation before exporting",
    ],
  },
  {
    slug: "reorder",
    name: "Reorder pages",
    summary: "Drag pages into the order you actually want.",
    description:
      "Rearrange pages with a thumbnail grid, then export the new order. Original page content is copied, not re-rendered.",
    icon: ListOrdered,
    status: "available",
    capabilities: [
      "See page thumbnails for orientation",
      "Move pages with drag or keyboard controls",
      "Export the new page order as a new file",
    ],
  },
  {
    slug: "extract-pages",
    name: "Extract pages",
    summary: "Pull selected pages into a brand-new PDF.",
    description:
      "Keep only the pages you need. The source file is never modified, and the new document contains exactly your selection.",
    icon: FileOutput,
    status: "available",
    capabilities: [
      "Select pages from a thumbnail grid or a range",
      "Build one new PDF from only the selected pages",
      "Leave the source file untouched",
    ],
  },
  {
    slug: "images-to-pdf",
    name: "Images to PDF",
    summary: "Turn PNG and JPEG images into one PDF.",
    description:
      "Bundle photos or scans into a single document with control over page size, fit, orientation, and margins.",
    icon: ImagePlus,
    status: "available",
    caveat:
      "PNG and JPEG only. HEIC, TIFF, SVG, and WebP are not supported. Images are embedded at their original resolution and are not recompressed, so the PDF can be larger than the source images.",
    capabilities: [
      "Add PNG or JPEG images and arrange their order",
      "Choose page size, fit, orientation, and margin",
      "Export one combined PDF",
    ],
  },
  {
    slug: "pdf-to-images",
    name: "PDF to images",
    summary: "Export PDF pages as PNG or JPEG files.",
    description:
      "Render pages to images for slides or previews. Output is raster, so text becomes pixels rather than selectable text.",
    icon: Images,
    status: "available",
    caveat:
      "PNG and JPEG output only, capped at 120 pages per run and by a per-page pixel budget. Rendering a large document at 3x can exhaust browser memory, so the cap is enforced with a clear message.",
    capabilities: [
      "Choose which pages to render",
      "Pick PNG or JPEG output and a scale",
      "Download images individually or in sequence",
    ],
  },
  {
    slug: "protect",
    name: "Protect PDF",
    summary: "Add real AES-256 password protection.",
    description:
      "Encrypt a PDF so it cannot be opened without the password you set. Encryption happens in this tab; the password is never stored or transmitted.",
    icon: Lock,
    status: "available",
    caveat:
      "Permission flags (printing, copying, editing) are advisory: some third-party tools ignore them. The open password is the real protection. A lost password cannot be recovered by this app.",
    capabilities: [
      "Encrypt a PDF with a user-supplied password",
      "Set owner permissions for printing, copying, and editing",
      "Verify the output requires the password",
    ],
  },
];

export function getTool(slug: ToolSlug): ToolDefinition {
  const tool = TOOLS.find((candidate) => candidate.slug === slug);

  if (!tool) {
    throw new Error(`Unknown tool slug: ${slug}`);
  }

  return tool;
}

export const TOOL_COUNT = TOOLS.length;

export const AVAILABLE_TOOL_COUNT = TOOLS.filter(
  (tool) => tool.status === "available",
).length;
