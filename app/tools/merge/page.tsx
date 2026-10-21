import type { Metadata } from "next";

import { MergeTool } from "@/components/tools/merge-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("merge");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function MergePage() {
  return <MergeTool />;
}
