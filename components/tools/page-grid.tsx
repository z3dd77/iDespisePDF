"use client";

import type { ReactNode } from "react";
import { CheckSquare, Square } from "lucide-react";

import { cn } from "@/lib/cn";
import type { RotationAngle } from "@/lib/pdf/types";

export type PageGridProps = {
  pageCount: number;
  thumbnails: readonly string[];
  truncated?: boolean;
  selected: ReadonlySet<number>;
  onToggle: (page: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onInvert: () => void;
  /** Pending rotations keyed by 1-based page number. */
  rotations?: Partial<Record<number, RotationAngle>>;
  disabled?: boolean;
  toolbarExtra?: ReactNode;
};

/**
 * Thumbnail grid with real checkboxes. Tiles are labels, so clicking anywhere
 * toggles the page; the checkbox itself keeps keyboard and screen reader
 * behavior correct.
 */
export function PageGrid({
  pageCount,
  thumbnails,
  truncated = false,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  onInvert,
  rotations,
  disabled = false,
  toolbarExtra,
}: PageGridProps) {
  const visiblePages = truncated ? thumbnails.length : pageCount;

  return (
    <div className="rounded-card border border-white/70 bg-surface p-4 shadow-raised-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          {selected.size} of {pageCount} pages selected
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={disabled}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-accent-strong transition hover:bg-base disabled:opacity-40"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-base disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onInvert}
            disabled={disabled}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-base disabled:opacity-40"
          >
            Invert
          </button>
          {toolbarExtra}
        </div>
      </div>

      {truncated ? (
        <p className="mt-3 rounded-control bg-sunken/70 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          Previews stop at {thumbnails.length} pages to keep this tab
          responsive. Every page can still be selected with the page range
          field.
        </p>
      ) : null}

      <ul
        role="list"
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
      >
        {Array.from({ length: visiblePages }, (_, index) => index + 1).map(
          (page) => {
            const isSelected = selected.has(page);
            const rotation = rotations?.[page] ?? 0;
            const thumbnail = thumbnails[page - 1];

            return (
              <li key={page}>
                <label
                  className={cn(
                    "flex cursor-pointer flex-col gap-2 rounded-control border p-2 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                    isSelected
                      ? "border-accent/60 bg-accent-soft/60 shadow-inset-sm"
                      : "border-white/60 bg-surface shadow-raised-xs hover:shadow-raised-sm",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="relative block overflow-hidden rounded-[0.6rem] bg-white"
                    style={{ aspectRatio: "3 / 4" }}
                  >
                    <span
                      className="absolute inset-0 bg-center bg-no-repeat"
                      style={{
                        backgroundImage: thumbnail ? `url("${thumbnail}")` : undefined,
                        backgroundSize: "contain",
                      }}
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">
                      {page}
                    </span>
                    {rotation !== 0 ? (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[0.6rem] font-semibold text-accent-strong shadow-raised-xs">
                        +{rotation}&deg;
                      </span>
                    ) : null}
                  </span>

                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[0.7rem] font-medium",
                      isSelected ? "text-accent-strong" : "text-ink-muted",
                    )}
                  >
                    {isSelected ? (
                      <CheckSquare aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Square aria-hidden="true" className="size-3.5" />
                    )}
                    {isSelected ? "Selected" : "Select"}
                    <span className="sr-only"> page {page}</span>
                  </span>

                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => onToggle(page)}
                  />
                </label>
              </li>
            );
          },
        )}
      </ul>
    </div>
  );
}
