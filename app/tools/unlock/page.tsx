import type { Metadata } from "next";
import { UnlockTool } from "@/components/tools/unlock-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("unlock");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function UnlockPage() {
  return <UnlockTool />;
}
