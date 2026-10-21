import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/cn";

export function ErrorNotice({
  message,
  className,
}: {
  message: string | null;
  className?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-control border border-planned-ink/30 bg-planned-bg/70 px-4 py-3 text-sm leading-relaxed text-planned-ink",
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorList({
  messages,
  className,
}: {
  messages: readonly string[];
  className?: string;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-control border border-planned-ink/30 bg-planned-bg/70 px-4 py-3 text-sm text-planned-ink",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert aria-hidden="true" className="size-4" />
        {messages.length === 1 ? "One file was rejected" : "Some files were rejected"}
      </p>
      <ul role="list" className="mt-2 space-y-1 pl-6">
        {messages.map((message) => (
          <li key={message} className="list-disc leading-relaxed">
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
