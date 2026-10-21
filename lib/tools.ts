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
  | "protect";

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
      "Compression works by re-rendering every page as an image. Selectable text, links, annotations, form fields, bookmarks, and accessibility data do not survive. If the rebuilt file is not smaller, no file is produced and the original is left untouched.",
    capabilities: [
      "Choose a resolution and quality preset",
      "See the measured size before and after",
      "Get no file instead of a larger one",
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
