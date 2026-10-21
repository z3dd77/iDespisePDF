import type { Metadata } from "next";

import { PdfToImagesTool } from "@/components/tools/pdf-to-images-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("pdf-to-images");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function PdfToImagesPage() {
  return <PdfToImagesTool />;
}
