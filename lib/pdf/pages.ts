import { PdfToolkitError } from "./errors";
import { MAX_PAGE_COUNT } from "./limits";
import type { PageRange, RotationAngle } from "./types";

/**
 * Pure page arithmetic. No PDF library, no DOM: everything here is unit
 * tested directly.
 */

const RANGE_TOKEN = /^(\d+)\s*-\s*(\d+)$/;
const SINGLE_TOKEN = /^(\d+)$/;

function toPageNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new PdfToolkitError("invalid-range", `invalid page: ${value}`);
  }

  return parsed;
}

function assertInBounds(page: number, pageCount: number): void {
  if (page > pageCount) {
    throw new PdfToolkitError(
      "out-of-range",
      `page ${page} exceeds ${pageCount}`,
    );
  }
}

/** Parse "1-3, 5" into inclusive ranges. Order and duplicates are preserved. */
export function parsePageRanges(input: string, pageCount: number): PageRange[] {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new PdfToolkitError("empty-selection", "no ranges supplied");
  }

  const tokens = trimmed.split(",").map((token) => token.trim());

  if (tokens.some((token) => token.length === 0)) {
    throw new PdfToolkitError("invalid-range", "empty range token");
  }

  return tokens.map((token) => {
    const rangeMatch = RANGE_TOKEN.exec(token);

    if (rangeMatch) {
      const from = toPageNumber(rangeMatch[1]);
      const to = toPageNumber(rangeMatch[2]);

      if (from > to) {
        throw new PdfToolkitError("invalid-range", `reversed range: ${token}`);
      }

      assertInBounds(to, pageCount);
      return { from, to };
    }

    const singleMatch = SINGLE_TOKEN.exec(token);

    if (singleMatch) {
      const page = toPageNumber(singleMatch[1]);
      assertInBounds(page, pageCount);
      return { from: page, to: page };
    }

    throw new PdfToolkitError("invalid-range", `unparseable token: ${token}`);
  });
}

export function expandRanges(ranges: readonly PageRange[]): number[] {
  const pages: number[] = [];

  for (const range of ranges) {
    for (let page = range.from; page <= range.to; page += 1) {
      pages.push(page);
    }
  }

  return pages;
}

/** Parse a comma separated selection into a de-duplicated ascending list. */
export function parsePageSelection(
  input: string,
  pageCount: number,
): number[] {
  const pages = expandRanges(parsePageRanges(input, pageCount));
  return normalizeSelection(pages, pageCount);
}

/** Keep de-duplicated pages in ascending document order. */
export function normalizeSelection(
  pages: readonly number[],
  pageCount: number,
): number[] {
  if (pages.length === 0) {
    throw new PdfToolkitError("empty-selection", "selection is empty");
  }

  const unique = new Set<number>();

  for (const page of pages) {
    if (!Number.isInteger(page) || page < 1) {
      throw new PdfToolkitError("out-of-range", `invalid page: ${page}`);
    }

    assertInBounds(page, pageCount);
    unique.add(page);
  }

  return [...unique].sort((left, right) => left - right);
}

export function selectionToIndices(pages: readonly number[]): number[] {
  return pages.map((page) => page - 1);
}

/** Split a document into equal groups of `perFile` pages. */
export function chunkPageRanges(pageCount: number, perFile: number): PageRange[] {
  if (!Number.isInteger(perFile) || perFile < 1) {
    throw new PdfToolkitError("invalid-range", `invalid group size: ${perFile}`);
  }

  if (pageCount < 1) {
    throw new PdfToolkitError("empty-file", "document has no pages");
  }

  const ranges: PageRange[] = [];

  for (let from = 1; from <= pageCount; from += perFile) {
    ranges.push({ from, to: Math.min(from + perFile - 1, pageCount) });
  }

  return ranges;
}

/** Normalize any rotation to the nearest valid quarter turn. */
export function normalizeRotation(angle: number): RotationAngle {
  if (!Number.isFinite(angle)) {
    return 0;
  }

  const wrapped = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return wrapped as RotationAngle;
}

/** Rotation is additive: an already-rotated page keeps its orientation. */
export function addRotation(
  current: number,
  delta: RotationAngle,
): RotationAngle {
  return normalizeRotation(normalizeRotation(current) + delta);
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** A reorder target must be an exact permutation of 1..pageCount. */
export function assertPermutation(
  order: readonly number[],
  pageCount: number,
): void {
  if (order.length !== pageCount) {
    throw new PdfToolkitError(
      "invalid-range",
      `order has ${order.length} entries for ${pageCount} pages`,
    );
  }

  const seen = new Set<number>();

  for (const page of order) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw new PdfToolkitError("out-of-range", `invalid page in order: ${page}`);
    }

    if (seen.has(page)) {
      throw new PdfToolkitError("out-of-range", `duplicate page in order: ${page}`);
    }

    seen.add(page);
  }
}

export function assertPageLimit(pageCount: number): void {
  if (pageCount > MAX_PAGE_COUNT) {
    throw new PdfToolkitError(
      "too-many-pages",
      `${pageCount} exceeds ${MAX_PAGE_COUNT}`,
    );
  }
}

/** 1-based page numbers, used for labels and filenames. */
export function pageLabel(page: number): string {
  return `Page ${page}`;
}

/** Compact "1-3, 5" form for a sorted set of page numbers. */
export function formatPageRanges(pages: readonly number[]): string {
  if (pages.length === 0) {
    return "";
  }

  const sorted = [...new Set(pages)].sort((left, right) => left - right);
  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (const page of sorted.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }

    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }

  parts.push(start === previous ? `${start}` : `${start}-${previous}`);
  return parts.join(", ");
}
