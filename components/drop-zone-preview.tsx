import Link from "next/link";
import { ArrowRight, ShieldCheck, UploadCloud } from "lucide-react";

import { linkPrefetch } from "@/lib/runtime";

/**
 * Landing-page intake illustration. The real intake lives on each tool page,
 * which is why this is a link rather than a file input.
 */
export function DropZonePreview() {
  return (
    <div className="rounded-card border border-white/70 bg-surface p-3 shadow-raised sm:p-4">
      <div className="rounded-well border border-line/70 bg-sunken px-6 py-8 shadow-inset sm:px-8 sm:py-10">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-full border border-white/70 bg-sunken text-accent shadow-raised-sm"
          >
            <UploadCloud className="size-7" strokeWidth={1.6} />
          </span>

          <p className="mt-5 text-base font-semibold text-ink sm:text-lg">
            Open a tool, then choose a file
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
            Each tool opens files in this tab. Intake, preview, processing, and
            download all happen locally &mdash; there is no upload step because
            there is no server to upload to.
          </p>

          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="#tools"
              prefetch={linkPrefetch}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-semibold text-accent-strong shadow-raised-sm transition hover:shadow-raised"
            >
              Choose a tool
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href="#privacy"
              prefetch={linkPrefetch}
              className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-ink-muted underline decoration-line decoration-2 underline-offset-4 transition hover:text-ink"
            >
              How files stay local
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-3 flex items-center justify-center gap-2 px-2 text-center text-xs font-medium text-ink-muted">
        <ShieldCheck aria-hidden="true" className="size-4 text-accent" />
        No uploads &middot; no account &middot; no server
      </p>
    </div>
  );
}
