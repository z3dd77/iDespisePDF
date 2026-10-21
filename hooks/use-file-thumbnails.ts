"use client";

import { useEffect, useRef, useState } from "react";

import { renderCoverThumbnail, yieldToUi } from "@/lib/pdf/raster";

export type CoverThumbnailState = {
  dataUrl: string;
  pageCount: number;
};

export type ThumbnailSource = {
  id: string;
  bytes: Uint8Array;
};

/** Covers are expensive per file; beyond this the row keeps its file icon. */
export const MAX_COVER_THUMBNAILS = 24;

/**
 * Renders page 1 of each file, sequentially, and caches by file id. Reordering
 * re-runs the effect but skips ids that already have a cover.
 */
export function useFileThumbnails(
  files: readonly ThumbnailSource[],
): Record<string, CoverThumbnailState> {
  const [covers, setCovers] = useState<Record<string, CoverThumbnailState>>({});
  const settled = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const targets = files.slice(0, MAX_COVER_THUMBNAILS);

    async function run() {
      for (const file of targets) {
        if (cancelled) {
          return;
        }

        if (settled.current.has(file.id)) {
          continue;
        }

        try {
          const cover = await renderCoverThumbnail(file.bytes);

          if (cancelled) {
            return;
          }

          settled.current.add(file.id);
          setCovers((current) => ({ ...current, [file.id]: cover }));
        } catch {
          // A cover is decorative. The row keeps its file icon instead.
          settled.current.add(file.id);
        }

        await yieldToUi();
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [files]);

  return covers;
}
