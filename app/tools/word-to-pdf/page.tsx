import type { Metadata } from "next";

import { ToolPlaceholder } from "@/components/tool-placeholder";
import { getTool } from "@/lib/tools";

const tool = getTool("word-to-pdf");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function WordToPdfPage() {
  return <ToolPlaceholder tool={tool} />;
}
