import { Loader2 } from "lucide-react";

import type { JobProgress } from "@/lib/pdf/types";

/** Determinate when a total is known, indeterminate otherwise. */
export function ProgressPanel({
  label,
  progress,
}: {
  label: string;
  progress: JobProgress | null;
}) {
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-card border border-white/70 bg-surface p-4 shadow-raised-sm sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-accent" />
          {label}
        </p>
        {percent !== null ? (
          <p className="text-xs font-medium tabular-nums text-ink-muted">
            {percent}%
          </p>
        ) : null}
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sunken shadow-inset-sm">
        <div
          className={
            percent === null
              ? "h-full w-1/3 animate-pulse rounded-full bg-accent"
              : "h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          }
          style={percent === null ? undefined : { width: `${Math.max(4, percent)}%` }}
        />
      </div>

      {progress ? (
        <p className="mt-2 text-xs tabular-nums text-ink-muted">
          {progress.completed} of {progress.total}
        </p>
      ) : null}
    </div>
  );
}
