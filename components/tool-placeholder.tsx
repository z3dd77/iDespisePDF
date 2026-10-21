import Link from "next/link";
import { ArrowLeft, CircleDot, ShieldCheck, TriangleAlert } from "lucide-react";

import { StatusPill } from "@/components/status-pill";
import { linkPrefetch } from "@/lib/runtime";
import type { ToolDefinition } from "@/lib/tools";

export function ToolPlaceholder({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/#tools"
        prefetch={linkPrefetch}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All tools
      </Link>

      <header className="mt-6 flex flex-col gap-6 rounded-card border border-white/70 bg-surface p-6 shadow-raised sm:flex-row sm:items-start sm:p-8">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-control border border-white/70 bg-surface text-accent-strong shadow-raised-sm"
        >
          <Icon className="size-7" strokeWidth={1.75} />
        </span>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {tool.name}
            </h1>
            <StatusPill status={tool.status} />
          </div>
          <p className="text-base leading-relaxed text-ink-muted">
            {tool.description}
          </p>
        </div>
      </header>

      <section
        aria-labelledby="not-built-title"
        className="mt-6 rounded-card border border-planned-ink/25 bg-planned-bg/70 p-6 sm:p-8"
      >
        <div className="flex items-start gap-3">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-planned-ink"
          />
          <div className="space-y-2">
            <h2
              id="not-built-title"
              className="text-base font-semibold text-planned-ink"
            >
              This tool isn&apos;t built yet
            </h2>
            <p className="text-sm leading-relaxed text-planned-ink/90">
              This page exists so the route and navigation are in place. No
              file intake, processing, or download logic exists for this tool.
              Nothing on this page modifies a document.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="planned-title" className="mt-6">
        <h2
          id="planned-title"
          className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted"
        >
          What it will do
        </h2>
        <ul className="mt-4 space-y-3 rounded-card border border-white/70 bg-surface p-6 shadow-raised-sm">
          {tool.capabilities.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-ink">
              <CircleDot
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-accent"
              />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {tool.caveat ? (
        <section
          aria-labelledby="caveat-title"
          className="mt-6 rounded-card border border-white/70 bg-surface p-6 shadow-raised-sm"
        >
          <h2
            id="caveat-title"
            className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted"
          >
            Known limitation
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink">
            {tool.caveat}
          </p>
        </section>
      ) : null}

      <p className="mt-6 flex items-start gap-2 rounded-well bg-sunken/70 px-4 py-3 text-xs leading-relaxed text-ink-muted shadow-inset-sm">
        <ShieldCheck
          aria-hidden="true"
          className="mt-px size-4 shrink-0 text-accent"
        />
        If this tool becomes available, processing will run in your browser.
        Files are never uploaded, stored, or sent anywhere.
      </p>
    </article>
  );
}
