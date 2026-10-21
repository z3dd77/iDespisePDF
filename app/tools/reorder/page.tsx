import type { Metadata } from "next";

import { ReorderTool } from "@/components/tools/reorder-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("reorder");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function ReorderPage() {
  return <ReorderTool />;
}
