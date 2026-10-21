"use client";

export function PageRangeInput({
  id,
  value,
  onChange,
  hint,
  placeholder = "e.g. 1-3, 5, 8-10",
  disabled = false,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-semibold text-ink"
      >
        Page ranges
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-control border border-line/70 bg-sunken px-4 py-2.5 font-mono text-sm text-ink shadow-inset-sm transition placeholder:text-ink-muted/70 focus-visible:border-accent disabled:opacity-60"
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-planned-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
