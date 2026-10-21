"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

import { cn } from "@/lib/cn";

export type FileDropZoneProps = {
  accept: "pdf" | "image";
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  hint: string;
  disabled?: boolean;
};

const ACCEPT_ATTRS: Record<FileDropZoneProps["accept"], string> = {
  pdf: "application/pdf,.pdf",
  image: "image/png,image/jpeg,.png,.jpg,.jpeg",
};

/**
 * Click or drop intake. Dropping is an enhancement; the button is the accessible
 * path and owns the keyboard interaction.
 */
export function FileDropZone({
  accept,
  multiple = false,
  onFiles,
  label,
  hint,
  disabled = false,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) {
      return;
    }

    onFiles(Array.from(list));
  };

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) {
          setDragging(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);

        if (!disabled) {
          handleFiles(event.dataTransfer.files);
        }
      }}
      className={cn(
        "rounded-card border-2 border-dashed p-2 transition",
        dragging
          ? "border-accent bg-accent-soft/50"
          : "border-line/80 bg-sunken/40",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-well px-4 py-8 text-center transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-full border border-white/70 bg-surface text-accent shadow-raised-sm"
        >
          <UploadCloud className="size-5" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="max-w-sm text-xs leading-relaxed text-ink-muted">
          {hint}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRS[accept]}
        multiple={multiple}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
