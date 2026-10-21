import type { Metadata } from "next";

import { ImagesToPdfTool } from "@/components/tools/images-to-pdf-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("images-to-pdf");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function ImagesToPdfPage() {
  return <ImagesToPdfTool />;
}
