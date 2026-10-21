"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Layers,
  RotateCcw,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import {
  downloadFile,
  downloadFilesSequentially,
} from "@/lib/pdf/download";
import type { ProcessedFile } from "@/lib/pdf/types";

export type ResultPanelProps = {
  title: string;
  summary?: string;
  notes?: readonly string[];
  files: readonly ProcessedFile[];
  onReset: () => void;
  resetLabel?: string;
  comparison?: { before: number; after: number } | null;
  tone?: "success" | "warning";
};

export function ResultPanel({
  title,
  summary,
  notes = [],
  files,
  onReset,
  resetLabel = "Start over",
  comparison,
  tone = "success",
}: ResultPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const canDownload = files.length > 0;

  return (
    <section
      aria-labelledby="result-title"
      className={cn(
        "rounded-card border p-5 shadow-raised sm:p-6",
        tone === "success"
          ? "border-ready-ink/25 bg-surface"
          : "border-planned-ink/30 bg-planned-bg/50",
      )}
    >
      <h2
        id="result-title"
        className="flex items-center gap-2 text-base font-semibold text-ink"
      >
        {tone === "success" ? (
          <CheckCircle2 aria-hidden="true" className="size-5 text-ready-ink" />
        ) : (
          <AlertTriangle aria-hidden="true" className="size-5 text-planned-ink" />
        )}
        {title}
      </h2>

      {summary ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{summary}</p>
      ) : null}

      {comparison ? (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-control bg-sunken/70 px-4 py-3 shadow-inset-sm">
            <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Before
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {formatBytes(comparison.before)}
            </dd>
          </div>
          <div className="rounded-control bg-sunken/70 px-4 py-3 shadow-inset-sm">
            <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              After
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {formatBytes(comparison.after)}
            </dd>
          </div>
        </dl>
      ) : null}

      {canDownload ? (
        <ul role="list" className="mt-4 space-y-2">
          {files.map((file) => (
            <li
              key={file.fileName}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-white/60 bg-base px-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">
                  {file.fileName}
                </span>
                <span className="block text-xs text-ink-muted">
                  {formatBytes(file.bytes.length)}
                  {file.pageCount
                    ? ` · ${file.pageCount} ${file.pageCount === 1 ? "page" : "pages"}`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => downloadFile(file)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-surface px-3 py-1.5 text-xs font-semibold text-accent-strong shadow-raised-xs transition hover:shadow-raised-sm"
              >
                <Download aria-hidden="true" className="size-3.5" />
                Download
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 1 ? (
        <button
          type="button"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            await downloadFilesSequentially(files);
            setDownloading(false);
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:opacity-60"
        >
          <Layers aria-hidden="true" className="size-4" />
          {downloading ? "Downloading…" : `Download all ${files.length} files`}
        </button>
      ) : null}

      {notes.length > 0 ? (
        <ul role="list" className="mt-4 space-y-2">
          {notes.map((note) => (
            <li
              key={note}
              className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line"
              />
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/70 bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-raised-xs transition hover:shadow-raised-sm"
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        {resetLabel}
      </button>
    </section>
  );
}
