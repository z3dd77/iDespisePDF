import type { Metadata } from "next";

import { ExtractTool } from "@/components/tools/extract-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("extract-pages");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function ExtractPagesPage() {
  return <ExtractTool />;
}
