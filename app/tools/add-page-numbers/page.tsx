import type { Metadata } from "next";
import { AddPageNumbersTool } from "@/components/tools/add-page-numbers-tool";
import { getTool } from "@/lib/tools";

const tool = getTool("add-page-numbers");

export const metadata: Metadata = {
  title: tool.name,
  description: tool.summary,
};

export default function AddPageNumbersPage() {
  return <AddPageNumbersTool />;
}
