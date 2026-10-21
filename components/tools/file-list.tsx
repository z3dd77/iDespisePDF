"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileText, GripVertical, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

export type FileListItem = {
  id: string;
  label: string;
  size: number;
  detail?: string;
  thumbnailUrl?: string;
};

export function FileList({
  items,
  onRemove,
  onReorder,
  disabled = false,
}: {
  items: readonly FileListItem[];
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  disabled?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <ol role="list" className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable={!disabled && items.length > 1}
          onDragStart={() => setDragIndex(index)}
          onDragOver={(event) => {
            event.preventDefault();
            setOverIndex(index);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDrop={(event) => {
            event.preventDefault();

            if (dragIndex !== null && dragIndex !== index) {
              onReorder(dragIndex, index);
            }

            setDragIndex(null);
            setOverIndex(null);
          }}
          className={cn(
            "flex items-center gap-3 rounded-control border bg-surface px-3 py-2.5 shadow-raised-xs transition",
            overIndex === index && dragIndex !== null && dragIndex !== index
              ? "border-accent/60"
              : "border-white/60",
          )}
        >
          <GripVertical
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-ink-muted",
              items.length > 1 ? "cursor-grab" : "opacity-30",
            )}
          />

          <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
            {index + 1}
          </span>

          <span
            className="relative h-36 w-24 shrink-0 overflow-hidden rounded-[0.4rem] border border-white/60 bg-white shadow-inset-sm"
            aria-hidden={item.thumbnailUrl ? undefined : true}
          >
            {item.thumbnailUrl ? (
              <span
                role="img"
                aria-label={`Preview of ${item.label}`}
                className="absolute inset-0 bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url("${item.thumbnailUrl}")`,
                  backgroundSize: "contain",
                }}
              />
            ) : (
              <FileText
                aria-hidden="true"
                className="absolute inset-0 m-auto size-4 text-ink-muted"
              />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {item.label}
            </span>
            <span className="block text-xs text-ink-muted">
              {formatBytes(item.size)}
              {item.detail ? ` · ${item.detail}` : ""}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={`Move ${item.label} up`}
              disabled={disabled || index === 0}
              onClick={() => onReorder(index, index - 1)}
              className="grid size-8 place-items-center rounded-full text-ink-muted transition hover:bg-base hover:text-ink disabled:opacity-30"
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Move ${item.label} down`}
              disabled={disabled || index === items.length - 1}
              onClick={() => onReorder(index, index + 1)}
              className="grid size-8 place-items-center rounded-full text-ink-muted transition hover:bg-base hover:text-ink disabled:opacity-30"
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.label}`}
              disabled={disabled}
              onClick={() => onRemove(item.id)}
              className="grid size-8 place-items-center rounded-full text-ink-muted transition hover:bg-planned-bg hover:text-planned-ink disabled:opacity-30"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
