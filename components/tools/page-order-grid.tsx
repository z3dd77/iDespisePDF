"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Reorder grid. Drag is the fast path; the arrow buttons are the accessible
 * path and mirror keyboard expectations.
 */
export function PageOrderGrid({
  thumbnails,
  order,
  onMove,
  truncated = false,
  disabled = false,
}: {
  thumbnails: readonly string[];
  order: readonly number[];
  onMove: (from: number, to: number) => void;
  truncated?: boolean;
  disabled?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <div className="rounded-card border border-white/70 bg-surface p-4 shadow-raised-sm sm:p-5">
      <p className="text-sm font-semibold text-ink">
        Page order ({order.length} pages)
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        Drag a page, or use the arrow buttons. The number on each thumbnail is
        its original page; the position in this grid is its new position.
      </p>

      {truncated ? (
        <p className="mt-3 rounded-control bg-sunken/70 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          Only the first {thumbnails.length} pages have previews. Reordering is
          limited to the pages shown here.
        </p>
      ) : null}

      <ol role="list" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {order.map((page, position) => (
          <li
            key={`${page}-${position}`}
            draggable={!disabled}
            onDragStart={() => setDragIndex(position)}
            onDragOver={(event) => {
              event.preventDefault();
              setOverIndex(position);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDrop={(event) => {
              event.preventDefault();

              if (dragIndex !== null && dragIndex !== position) {
                onMove(dragIndex, position);
              }

              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cn(
              "flex flex-col gap-2 rounded-control border bg-surface p-2 shadow-raised-xs transition",
              overIndex === position && dragIndex !== null && dragIndex !== position
                ? "border-accent/70"
                : "border-white/60",
              dragIndex === position && "opacity-60",
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
                  backgroundImage: thumbnails[page - 1]
                    ? `url("${thumbnails[page - 1]}")`
                    : undefined,
                  backgroundSize: "contain",
                }}
              />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">
                p.{page}
              </span>
              <GripVertical
                className="absolute right-1.5 top-1.5 size-4 text-ink-muted"
                aria-hidden="true"
              />
            </span>

            <span className="flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label={`Move page ${page} earlier`}
                disabled={disabled || position === 0}
                onClick={() => onMove(position, position - 1)}
                className="grid size-7 place-items-center rounded-full text-ink-muted transition hover:bg-base hover:text-ink disabled:opacity-30"
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
              </button>
              <span className="text-[0.65rem] font-semibold text-ink-muted">
                {position + 1}
              </span>
              <button
                type="button"
                aria-label={`Move page ${page} later`}
                disabled={disabled || position === order.length - 1}
                onClick={() => onMove(position, position + 1)}
                className="grid size-7 place-items-center rounded-full text-ink-muted transition hover:bg-base hover:text-ink disabled:opacity-30"
              >
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
