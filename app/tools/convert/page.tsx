import type { Metadata } from "next";
import { FileOutput } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools";


import { ToolPlaceholder } from "@/components/tool-placeholder";
import { getTool } from "@/lib/tools";

// The "convert" tool acts as a namespace for conversion sub‑tools.
// It is not a real tool itself, so we mark it as planned.
const tool = {
  slug: "convert",
  name: "Convert",
  summary: "Conversion tools",
  description: "Tools to convert PDFs to and from other formats.",
  icon: FileOutput,
  status: "planned",
  capabilities: [],
} as unknown as ToolDefinition;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function ConvertPage() {
  return <ToolPlaceholder tool={tool} />;
}
