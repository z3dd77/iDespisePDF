import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { StatusPill } from "@/components/status-pill";
import type { ToolDefinition } from "@/lib/tools";

export function ToolShell({
  tool,
  children,
}: {
  tool: ToolDefinition;
  children: ReactNode;
}) {
  const Icon = tool.icon;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/#tools"
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All tools
      </Link>

      <header className="mt-5 flex flex-col gap-5 rounded-card border border-white/70 bg-surface p-6 shadow-raised sm:flex-row sm:items-start sm:p-7">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-control border border-white/70 bg-surface text-accent-strong shadow-raised-sm"
        >
          <Icon className="size-7" strokeWidth={1.75} />
        </span>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {tool.name}
            </h1>
            <StatusPill status={tool.status} />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            {tool.description}
          </p>
        </div>
      </header>

      <div className="mt-6 space-y-5">{children}</div>

      <p className="mt-8 flex items-start gap-2 rounded-well bg-sunken/70 px-4 py-3 text-xs leading-relaxed text-ink-muted shadow-inset-sm">
        <ShieldCheck
          aria-hidden="true"
          className="mt-px size-4 shrink-0 text-accent"
        />
        Processing runs in this tab. Files are not uploaded, stored, or sent to a
        server. Browser memory and tab lifetime are the only places document
        bytes exist.
      </p>
    </div>
  );
}
