import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

import { linkPrefetch } from "@/lib/runtime";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span
        aria-hidden="true"
        className="grid size-16 place-items-center rounded-full border border-white/70 bg-surface text-accent-strong shadow-raised"
      >
        <FileQuestion className="size-7" strokeWidth={1.6} />
      </span>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
        The route you asked for isn&apos;t here. The tool list on the home page
        shows every planned tool and its real status.
      </p>

      <Link
        href="/#tools"
        prefetch={linkPrefetch}
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/70 bg-surface px-5 py-2.5 text-sm font-semibold text-accent-strong shadow-raised-sm transition hover:shadow-raised"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to the roadmap
      </Link>
    </div>
  );
}
