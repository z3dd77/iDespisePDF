"use client";

import { useCallback, useRef, useState } from "react";

import {
  PDF_ERROR_MESSAGES,
  isPdfToolkitError,
} from "@/lib/pdf/errors";
import type { JobProgress } from "@/lib/pdf/types";

export type JobState<T> =
  | { status: "idle" }
  | { status: "working"; progress: JobProgress | null }
  | { status: "done"; result: T }
  | { status: "error"; message: string; code: string };

export type TaskRunner = (
  report: (progress: JobProgress) => void,
) => Promise<void>;

/**
 * One state machine for every tool: idle -> working -> done | error.
 * Errors are normalized here so no component has to interpret library output.
 */
export function useToolJob<T>() {
  const [state, setState] = useState<JobState<T>>({ status: "idle" });
  const runningRef = useRef(false);

  const run = useCallback(
    async (task: (report: (progress: JobProgress) => void) => Promise<T>) => {
      if (runningRef.current) {
        return null;
      }

      runningRef.current = true;
      setState({ status: "working", progress: null });

      try {
        const result = await task((progress) => {
          setState({ status: "working", progress });
        });

        setState({ status: "done", result });
        return result;
      } catch (error) {
        setState({
          status: "error",
          message: isPdfToolkitError(error)
            ? error.message
            : PDF_ERROR_MESSAGES.unknown,
          code: isPdfToolkitError(error) ? error.code : "unknown",
        });
        return null;
      } finally {
        runningRef.current = false;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return {
    state,
    run,
    reset,
    isWorking: state.status === "working",
  };
}
