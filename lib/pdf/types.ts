/**
 * Shared vocabulary for PDF work.
 *
 * These types describe what the UI hands to a processing function and what it
 * gets back. Page numbers are always 1-based, matching what the user sees.
 */

export type PdfSource = {
  /** Stable client-side identifier; never derived from file contents. */
  id: string;
  name: string;
  /** Byte length of the original file. */
  size: number;
  lastModified: number;
  bytes: ArrayBuffer;
};

export type PdfInput = {
  name: string;
  bytes: Uint8Array;
};

/** Inclusive, 1-based page range. */
export type PageRange = {
  from: number;
  to: number;
};

/** Explicit page numbers. Ordered: the array order is the output order. */
export type PageSelection = {
  pages: readonly number[];
};

export type RotationAngle = 0 | 90 | 180 | 270;

export type RasterFormat = "png" | "jpeg";

export type OutputMimeType = "application/pdf" | "image/png" | "image/jpeg";

export type PageSize = {
  width: number;
  height: number;
};

export type ProcessedFile = {
  fileName: string;
  mimeType: OutputMimeType;
  bytes: Uint8Array;
  pageCount?: number;
};

export type ProcessingResult = {
  files: readonly ProcessedFile[];
  /**
   * Human-readable facts the UI must surface, such as a measured size change
   * or a quality tradeoff. Empty when there is nothing to disclose.
   */
  notes: readonly string[];
};

export type JobProgress = {
  completed: number;
  total: number;
};

/** Called by every long-running operation so the UI can show real progress. */
export type ProgressReporter = (progress: JobProgress) => void;

export type CompressionStatus = "smaller" | "not-smaller";

/**
 * Compression never returns a stand-in. When the rasterized output is not
 * smaller, the outcome says so and contains no file at all.
 */
export type CompressionOutcome =
  | {
      status: "smaller";
      file: ProcessedFile;
      originalBytes: number;
      outputBytes: number;
      notes: readonly string[];
    }
  | {
      status: "not-smaller";
      originalBytes: number;
      outputBytes: number;
      notes: readonly string[];
    };

export type ProtectionPermissions = {
  printing: boolean;
  copying: boolean;
  modifying: boolean;
};

export type ProtectOptions = {
  userPassword: string;
  ownerPassword?: string;
  permissions?: ProtectionPermissions;
};
