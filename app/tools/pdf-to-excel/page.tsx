import type { Metadata } from "next";

import { ToolPlaceholder } from "@/components/tool-placeholder";
import { getTool } from "@/lib/tools";

const tool = getTool("pdf-to-excel");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function PdfToExcelPage() {
  return <ToolPlaceholder tool={tool} />;
}
