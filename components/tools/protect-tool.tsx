"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { protectPdf } from "@/lib/pdf/protect";
import type { ProcessingResult } from "@/lib/pdf/types";
import { cn } from "@/lib/cn";
import { getTool } from "@/lib/tools";

const tool = getTool("protect");

const PERMISSION_ROWS = [
  {
    key: "printing" as const,
    label: "Allow printing",
    description: "Otherwise readers show a restricted document.",
  },
  {
    key: "copying" as const,
    label: "Allow copying text",
    description: "Otherwise text selection and copying are discouraged.",
  },
  {
    key: "modifying" as const,
    label: "Allow editing",
    description: "Otherwise annotations and form filling are discouraged.",
  },
];

export function ProtectTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState({
    printing: true,
    copying: false,
    modifying: false,
  });

  const preview = usePdfPreview(file?.bytes ?? null);
  const job = useToolJob<ProcessingResult>();

  const passwordError =
    password.length === 0 ? "Enter a password to protect the file." : null;
  const confirmationError =
    confirmation.length > 0 && confirmation !== password
      ? "The confirmation doesn't match the password."
      : null;
  const weakPassword =
    password.length > 0 && password.length < 8
      ? "Short passwords are easier to guess. Eight characters or more is safer."
      : null;
  const canSubmit =
    !!file &&
    preview.status === "ready" &&
    password.length > 0 &&
    confirmation === password &&
    !job.isWorking;

  async function addFiles(incoming: File[]) {
    job.reset();
    // Clear the fields before the async read, so a fast paste cannot be wiped.
    setPassword("");
    setConfirmation("");
    const result = await readPdfFiles(incoming);
    setErrors(result.errors);

    if (result.accepted[0]) {
      setFile(result.accepted[0]);
    }
  }

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addFiles}
          label="Choose a PDF to protect"
          hint="One PDF at a time. Already-encrypted PDFs must be unlocked before they can be protected again."
        />
      ) : (
        <SelectedFileCard
          name={file.name}
          size={file.size}
          pageCount={preview.status === "ready" ? preview.pageCount : undefined}
          thumbnailUrl={
            preview.status === "ready" ? preview.thumbnails[0] : undefined
          }
          disabled={job.isWorking}
          onRemove={() => {
            job.reset();
            setFile(null);
            setErrors([]);
            setPassword("");
            setConfirmation("");
          }}
        />
      )}

      <ErrorList messages={errors} />

      {preview.status === "loading" ? (
        <ProgressPanel label="Opening the document" progress={preview.progress} />
      ) : null}

      {preview.status === "error" ? <ErrorNotice message={preview.message} /> : null}

      <section
        aria-labelledby="protect-password"
        className="space-y-4 rounded-card border border-white/70 bg-surface p-5 shadow-raised-sm sm:p-6"
      >
        <div>
          <h2 id="protect-password" className="text-sm font-semibold text-ink">
            Open password
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Required to open the document. It is used in memory only and is
            never stored, logged, or sent anywhere. There is no recovery if it is
            lost.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="protect-password-input" className="text-sm font-semibold text-ink">
              Password
            </label>
            <div className="relative mt-2">
              <input
                id="protect-password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                spellCheck={false}
                disabled={job.isWorking}
                aria-invalid={passwordError ? true : undefined}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-control border border-line/70 bg-sunken px-4 py-2.5 pr-11 text-sm text-ink shadow-inset-sm transition focus-visible:border-accent disabled:opacity-60"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition hover:bg-base hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="protect-confirm" className="text-sm font-semibold text-ink">
              Confirm password
            </label>
            <input
              id="protect-confirm"
              type={showPassword ? "text" : "password"}
              value={confirmation}
              autoComplete="new-password"
              spellCheck={false}
              disabled={job.isWorking}
              aria-invalid={confirmationError ? true : undefined}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full rounded-control border border-line/70 bg-sunken px-4 py-2.5 text-sm text-ink shadow-inset-sm transition focus-visible:border-accent disabled:opacity-60"
            />
          </div>
        </div>

        {passwordError ? (
          <p role="alert" className="text-xs font-medium text-planned-ink">
            {passwordError}
          </p>
        ) : null}

        {confirmationError ? (
          <p role="alert" className="text-xs font-medium text-planned-ink">
            {confirmationError}
          </p>
        ) : null}

        {weakPassword ? (
          <p className="flex items-start gap-2 rounded-control bg-planned-bg/60 px-3 py-2 text-xs leading-relaxed text-planned-ink">
            <ShieldAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {weakPassword}
          </p>
        ) : null}
      </section>

      <fieldset
        disabled={job.isWorking}
        className="rounded-card border border-white/70 bg-surface p-5 shadow-raised-sm sm:p-6"
      >
        <legend className="px-1 text-sm font-semibold text-ink">
          Permissions
        </legend>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          These flags tell compliant readers what to allow. They are advisory:
          some third-party tools ignore them. The open password is the real
          protection.
        </p>

        <div className="mt-4 space-y-2">
          {PERMISSION_ROWS.map((row) => (
            <label
              key={row.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-control border px-4 py-3 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                permissions[row.key]
                  ? "border-accent/40 bg-accent-soft/40"
                  : "border-white/60 bg-base",
              )}
            >
              <input
                type="checkbox"
                checked={permissions[row.key]}
                onChange={(event) =>
                  setPermissions((current) => ({
                    ...current,
                    [row.key]: event.target.checked,
                  }))
                }
                className="mt-0.5 size-4 accent-[var(--color-accent-strong)]"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  {row.label}
                </span>
                <span className="block text-xs leading-relaxed text-ink-muted">
                  {row.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={async () => {
          if (!file) {
            return;
          }

          await job.run((report) =>
            protectPdf(
              file.bytes,
              {
                userPassword: password,
                permissions,
              },
              file.name,
              report,
            ),
          );
        }}
        className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Lock aria-hidden="true" className="size-4" />
        {job.isWorking ? "Encrypting…" : "Encrypt and download"}
      </button>

      {job.state.status === "working" ? (
        <ProgressPanel label="Encrypting with AES-256" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="Encrypted"
          summary="The protected PDF is ready. Store the password somewhere safe; it cannot be recovered from the file by this app."
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Protect another file"
          onReset={() => {
            job.reset();
            setFile(null);
            setPassword("");
            setConfirmation("");
            setErrors([]);
          }}
        />
      ) : null}
    </ToolShell>
  );
}
