"use client";

import { Circle, CircleDot } from "lucide-react";

import { cn } from "@/lib/cn";

export type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

/** Radio group rendered as raised tiles, with a real fieldset/legend. */
export function OptionGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  disabled = false,
  columns = 3,
  hint,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: 2 | 3;
  hint?: string;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{hint}</p>
      ) : null}

      <div
        className={cn(
          "mt-3 grid gap-3",
          columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;

          return (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-control border p-4 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                checked
                  ? "border-accent/50 bg-accent-soft/60 shadow-inset-sm"
                  : "border-white/70 bg-surface shadow-raised-xs hover:shadow-raised-sm",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  checked ? "text-accent-strong" : "text-ink",
                )}
              >
                {checked ? (
                  <CircleDot aria-hidden="true" className="size-4" />
                ) : (
                  <Circle aria-hidden="true" className="size-4 text-ink-muted" />
                )}
                {option.label}
              </span>
              {option.description ? (
                <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                  {option.description}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
