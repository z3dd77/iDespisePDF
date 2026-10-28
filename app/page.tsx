"use client";

import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  Gauge,
  ShieldCheck,
} from "lucide-react";

import { useState } from "react";
import { DropZonePreview } from "@/components/drop-zone-preview";

import { ToolCard } from "@/components/tool-card";
import { AVAILABLE_TOOL_COUNT, TOOL_COUNT, TOOLS } from "@/lib/tools";

const IMPLEMENTED = [
  "All nine tools: merge, split, compress, rotate, reorder, extract pages, images to PDF, PDF to images, and protect",
  "Shared intake, validation, progress, result, and download components",
  "Unit tests for page arithmetic, PDF transforms, encryption, and compression decisions",
  "Browser tests for PDF.js rendering and independent encryption verification",
  "Lint, type-check, test, and production build pipeline",
];

const DEFERRED = [
  "Lossless compression. Current compression re-renders pages as images and discloses the tradeoff before running",
  "Opening or removing the password from an already-protected PDF",
  "OCR, digital signatures, PDF/A conversion, and form editing",
  "ZIP bundling. Multi-file results download one file at a time",
  "HEIC, TIFF, WebP, and SVG image input",
];

const PRIVACY_POINTS = [
  {
    title: "No uploads",
    body: "There is no backend endpoint to receive a document. PDF libraries are bundled with the app and run inside this tab, so bytes never cross the network.",
  },
  {
    title: "No accounts",
    body: "Nothing to sign up for and nothing stored about you. There is no database and no authentication layer.",
  },
  {
    title: "No analytics",
    body: "No tracking scripts, no session recording, no third-party tags. The web build only requests its own assets; the optional desktop update check contacts GitHub Releases for version and changelog data.",
  },
];

const STATS = [
  { label: "Tools", value: TOOL_COUNT },
  { label: "Available", value: AVAILABLE_TOOL_COUNT },
  { label: "Uploads", value: 0 },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const TABS = ["All", "PDF", "Image", "Conversion"] as const;

  const filteredTools = TOOLS.filter((tool) => {
    const matchesTab =
      activeTab === "All"
        ? true
        : activeTab === "PDF"
        ? !["images-to-pdf", "pdf-to-images", "pdf-to-word", "pdf-to-excel", "word-to-pdf", "excel-to-pdf", "convert"].includes(tool.slug)
        : activeTab === "Image"
        ? ["images-to-pdf", "pdf-to-images"].includes(tool.slug)
        : activeTab === "Conversion"
        ? ["pdf-to-word", "pdf-to-excel", "word-to-pdf", "excel-to-pdf"].includes(tool.slug)
        : false;

    const lowerSearch = search.toLowerCase();
    const matchesSearch =
      tool.name.toLowerCase().includes(lowerSearch) ||
      tool.summary.toLowerCase().includes(lowerSearch);

    return matchesTab && matchesSearch;
  });

  return (
    <>
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-surface px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted shadow-raised-xs">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            Local-first PDF tools
          </p>

          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            PDF work that never leaves your device.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Merge, split, compress, rotate, reorder, extract, convert, and
            protect PDFs in the browser. No uploads, no accounts, no queue.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#tools"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/70 bg-surface px-6 py-3 text-sm font-semibold text-accent-strong shadow-raised transition hover:shadow-raised-lg"
            >
              Browse the tools
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
            <a
              href="#status"
              className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-ink-muted underline decoration-line decoration-2 underline-offset-4 transition hover:text-ink"
            >
              What works today
            </a>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-control border border-white/60 bg-surface px-4 py-3 shadow-raised-xs"
              >
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <DropZonePreview />
      </section>

      <section
        id="tools"
        aria-labelledby="tools-title"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="tools-title"
              className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
            >
              The tools
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Nine tools, each with its own page and its own stated limits.
              Everything runs in this tab: choose a file, process it, download
              the result. Compression and protection describe their tradeoffs
              before you run them.
            </p>
          </div>
          <p className="shrink-0 rounded-full bg-sunken px-4 py-2 text-xs font-semibold text-ink-muted shadow-inset-sm">
            {AVAILABLE_TOOL_COUNT} of {TOOL_COUNT} available
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 mt-6">
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  activeTab === tab
                    ? "bg-accent-strong text-white"
                    : "bg-surface text-ink-muted border border-white/70"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-white/70 bg-surface px-3 py-1 text-sm text-ink-muted focus:outline-none"
          />
        </div>

        <ul role="list" className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </ul>
      </section>

      <section
        id="status"
        aria-labelledby="status-title"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8"
      >
        <h2
          id="status-title"
          className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
        >
          Build status
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          What exists in the codebase right now, and what is deliberately
          waiting. The second column is not a to-do list with dates attached; it
          is what you should assume does not work.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-card border border-white/70 bg-surface p-6 shadow-raised sm:p-8">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <CircleCheck aria-hidden="true" className="size-4 text-ready-ink" />
              In place
            </h3>
            <ul role="list" className="mt-5 space-y-3">
              {IMPLEMENTED.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-relaxed text-ink"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ready-ink"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-card border border-white/70 bg-surface p-6 shadow-raised sm:p-8">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <CircleDashed
                aria-hidden="true"
                className="size-4 text-planned-ink"
              />
              Deliberately deferred
            </h3>
            <ul role="list" className="mt-5 space-y-3">
              {DEFERRED.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-relaxed text-ink"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-planned-ink"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="privacy"
        aria-labelledby="privacy-title"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="rounded-card border border-white/70 bg-surface p-6 shadow-raised sm:p-10">
          <h2
            id="privacy-title"
            className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
          >
            <ShieldCheck aria-hidden="true" className="size-6 text-accent" />
            Privacy is the architecture
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Processing documents in the browser is a design constraint, not a
            feature toggle. These commitments hold for every tool that ships.
          </p>

          <ul
            role="list"
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {PRIVACY_POINTS.map((point) => (
              <li
                key={point.title}
                className="rounded-well border border-white/60 bg-base px-5 py-4 shadow-inset-sm"
              >
                <h3 className="text-sm font-semibold text-ink">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {point.body}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-8 flex items-start gap-2 border-t border-line/60 pt-6 text-xs leading-relaxed text-ink-muted">
            <Gauge
              aria-hidden="true"
              className="mt-px size-4 shrink-0 text-accent"
            />
            Limits are enforced before processing starts: 100 MB per PDF, 300 MB
            total per run, 2,000 pages, and 120 pages for operations that render
            every page. Browser memory is finite, and a clear message is better
            than a crashed tab. Password protection encrypts with AES-256, but
            the permission flags inside a PDF are advisory &mdash; some
            third-party readers ignore them.
          </p>
        </div>
      </section>
    </>
  );
}
