import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { StatusPill } from "@/components/status-pill";
import type { ToolDefinition } from "@/lib/tools";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon;
  const isAvailable = tool.status === "available";

  return (
    <li className="h-full">
      <Link
        href={`/tools/${tool.slug}`}
        className="group flex h-full flex-col gap-5 rounded-card border border-white/70 bg-surface p-6 shadow-raised transition duration-300 ease-out hover:-translate-y-1 hover:shadow-raised-lg focus-visible:-translate-y-1 focus-visible:shadow-raised-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-control border border-white/70 bg-surface text-accent-strong shadow-raised-sm"
          >
            <Icon className="size-6" strokeWidth={1.75} />
          </span>
          <StatusPill status={tool.status} />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight text-ink">
            {tool.name}
          </h3>
          <p className="text-sm leading-relaxed text-ink-muted">
            {tool.summary}
          </p>
        </div>

        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong">
          {isAvailable ? "Open tool" : "See status"}
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </span>
      </Link>
    </li>
  );
}
