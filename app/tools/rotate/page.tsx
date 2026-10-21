import type { Metadata } from "next";

import { RotateTool } from "@/components/tools/rotate-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("rotate");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function RotatePage() {
  return <RotateTool />;
}
