import type { Metadata } from "next";

import { DeletePagesTool } from "@/components/tools/delete-pages-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("delete-pages");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function DeletePagesPage() {
  return <DeletePagesTool />;
}
