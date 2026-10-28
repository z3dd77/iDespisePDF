import type { Metadata } from "next";

import { ToolPlaceholder } from "@/components/tool-placeholder";
import { getTool } from "@/lib/tools";

const tool = getTool("pdf-to-word");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function PdfToWordPage() {
  return <ToolPlaceholder tool={tool} />;
}
