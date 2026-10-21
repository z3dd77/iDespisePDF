"use client";

import { useEffect, useState } from "react";

import { PDF_ERROR_MESSAGES, isPdfToolkitError } from "@/lib/pdf/errors";
import { renderThumbnails } from "@/lib/pdf/raster";
import type { JobProgress } from "@/lib/pdf/types";

export type PreviewState = {
  status: "idle" | "loading" | "ready" | "error";
  pageCount: number;
  thumbnails: string[];
  truncated: boolean;
  progress: JobProgress | null;
  message: string | null;
  /** The exact byte array this state describes. */
  source: Uint8Array | null;
};

const IDLE: PreviewState = {
  status: "idle",
  pageCount: 0,
  thumbnails: [],
  truncated: false,
  progress: null,
  message: null,
  source: null,
};

/**
 * Renders thumbnails for a document, once per selected file. PDF.js is imported
 * lazily inside renderThumbnails, and the document is destroyed when it returns.
 */
export function usePdfPreview(bytes: Uint8Array | null): PreviewState {
  const [state, setState] = useState<PreviewState>(IDLE);

  useEffect(() => {
    if (!bytes) {
      return;
    }

    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- the loading state must be visible as soon as a file is accepted
    setState({
      ...IDLE,
      status: "loading",
      progress: { completed: 0, total: 1 },
      source: bytes,
    });

    renderThumbnails(bytes, (progress) => {
      if (!cancelled) {
        setState((current) =>
          current.status === "loading" ? { ...current, progress } : current,
        );
      }
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          pageCount: result.pageCount,
          thumbnails: result.thumbnails,
          truncated: result.truncated,
          progress: null,
          message: null,
          source: bytes,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          ...IDLE,
          status: "error",
          message: isPdfToolkitError(error)
            ? error.message
            : PDF_ERROR_MESSAGES.unknown,
          source: bytes,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [bytes]);

  if (!bytes) {
    return IDLE;
  }

  // Derived, not stored: avoids showing the previous file's thumbnails for a
  // frame while the new render starts.
  if (state.source !== bytes) {
    return {
      ...IDLE,
      status: "loading",
      progress: { completed: 0, total: 1 },
      source: bytes,
    };
  }

  return state;
}
