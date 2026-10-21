import type { Metadata } from "next";

import { ProtectTool } from "@/components/tools/protect-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("protect");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function ProtectPage() {
  return <ProtectTool />;
}
