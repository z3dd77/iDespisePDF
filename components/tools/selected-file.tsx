"use client";

import { FileText, Trash2 } from "lucide-react";

import { formatBytes } from "@/lib/format";

export function SelectedFileCard({
  name,
  size,
  pageCount,
  thumbnailUrl,
  onRemove,
  disabled = false,
}: {
  name: string;
  size: number;
  pageCount?: number;
  thumbnailUrl?: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-white/60 bg-surface px-4 py-3 shadow-raised-xs">
      <span
        className="relative h-[11.25rem] w-[7.5rem] shrink-0 overflow-hidden rounded-[0.4rem] border border-white/60 bg-white shadow-inset-sm"
        aria-hidden={thumbnailUrl ? undefined : true}
      >
        {thumbnailUrl ? (
          <span
            role="img"
            aria-label={`Preview of ${name}`}
            className="absolute inset-0 bg-center bg-no-repeat"
            style={{
              backgroundImage: `url("${thumbnailUrl}")`,
              backgroundSize: "contain",
            }}
          />
        ) : (
          <span className="grid h-full w-full place-items-center bg-accent-soft text-accent-strong">
            <FileText aria-hidden="true" className="size-5" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {name}
        </span>
        <span className="block text-xs text-ink-muted">
          {formatBytes(size)}
          {pageCount ? ` · ${pageCount} ${pageCount === 1 ? "page" : "pages"}` : ""}
        </span>
      </span>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-planned-bg hover:text-planned-ink disabled:opacity-40"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
        Remove
      </button>
    </div>
  );
}
