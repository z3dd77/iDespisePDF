import { cn } from "@/lib/cn";
import { STATUS_LABEL, type ToolStatus } from "@/lib/tools";

const PILL_STYLES: Record<ToolStatus, string> = {
  planned: "bg-planned-bg text-planned-ink",
  "in-progress": "bg-accent-soft text-accent-strong",
  available: "bg-ready-bg text-ready-ink",
};

const DOT_STYLES: Record<ToolStatus, string> = {
  planned: "bg-planned-ink",
  "in-progress": "bg-accent",
  available: "bg-ready-ink",
};

export function StatusPill({
  status,
  className,
}: {
  status: ToolStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] shadow-inset-sm",
        PILL_STYLES[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", DOT_STYLES[status])}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
