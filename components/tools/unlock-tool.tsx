"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { useToolJob } from "@/hooks/use-tool-job";
import { readPdfFiles, type IntakeFile } from "@/lib/files";
import { unlockPdf } from "@/lib/pdf/unlock";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("unlock");

export function UnlockTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [password, setPassword] = useState("");

  const job = useToolJob<ProcessingResult>();

  async function addFiles(incoming: File[]) {
    job.reset();
    const result = await readPdfFiles(incoming);
    setErrors(result.errors);
    if (result.accepted[0]) {
      setFile(result.accepted[0]);
    }
  }

  async function runUnlock() {
    if (!file?.bytes) return;
    await job.run((report) => unlockPdf(file.bytes, password, file.name, report));
  }

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addFiles}
          label="Choose a protected PDF"
          hint="One PDF at a time."
        />
      ) : (
        <SelectedFileCard
          name={file.name}
          size={file.size}
          disabled={job.isWorking}
          onRemove={() => {
            job.reset();
            setFile(null);
            setErrors([]);
            setPassword("");
          }}
        />
      )}

      <ErrorList messages={errors} />

      {file && (
        <>
          <label className="block mt-4">
            <span className="text-sm font-medium text-ink">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={job.isWorking}
              className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              type="button"
              disabled={job.isWorking || !password}
              onClick={runUnlock}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scissors aria-hidden="true" className="size-4" />
              {job.isWorking ? "Unlocking…" : "Unlock PDF"}
            </button>
          </div>
        </>
      )}

      {job.state.status === "working" && (
        <ProgressPanel label="Unlocking PDF" progress={job.state.progress} />
      )}

      {job.state.status === "error" && <ErrorNotice message={job.state.message} />}

      {job.state.status === "done" && (
        <ResultPanel
          title="PDF unlocked"
          summary="Unlocked PDF ready for further work."
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Choose another file"
          onReset={() => {
            job.reset();
            setFile(null);
            setPassword("");
          }}
        />
      )}
    </ToolShell>
  );
}
