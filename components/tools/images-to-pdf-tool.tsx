"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { FileList } from "@/components/tools/file-list";
import { OptionGroup } from "@/components/tools/option-group";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { ToolShell } from "@/components/tools/tool-shell";
import { useToolJob } from "@/hooks/use-tool-job";
import { readImageFiles, type IntakeFile } from "@/lib/files";
import { formatBytes, formatCount } from "@/lib/format";
import { moveItem } from "@/lib/pdf/pages";
import { DEFAULT_IMAGES_OPTIONS, imagesToPdf } from "@/lib/pdf/images";
import type { ImageFit, ImageOrientation, PageSizeId } from "@/lib/pdf/presets";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("images-to-pdf");

type ImageItem = IntakeFile & { previewUrl: string };

const PAGE_SIZE_OPTIONS = [
  {
    value: "fit" as const,
    label: "Fit to image",
    description: "Each page matches its image, so nothing is cropped.",
  },
  {
    value: "a4" as const,
    label: "A4",
    description: "210 × 297 mm, portrait or landscape.",
  },
  {
    value: "letter" as const,
    label: "Letter",
    description: "8.5 × 11 in, portrait or landscape.",
  },
];

const FIT_OPTIONS = [
  {
    value: "contain" as const,
    label: "Contain",
    description: "Whole image visible, letterboxed if needed.",
  },
  {
    value: "cover" as const,
    label: "Cover",
    description: "Fills the page; edges may be cut by the page boundary.",
  },
  {
    value: "stretch" as const,
    label: "Stretch",
    description: "Fills the page and may distort proportions.",
  },
];

const ORIENTATION_OPTIONS = [
  {
    value: "auto" as const,
    label: "Auto",
    description: "Follow each image's proportions.",
  },
  { value: "portrait" as const, label: "Portrait", description: "Tall pages." },
  {
    value: "landscape" as const,
    label: "Landscape",
    description: "Wide pages.",
  },
];

const MARGIN_OPTIONS = [
  { value: "0", label: "None", description: "Edge to edge." },
  { value: "18", label: "0.25 in", description: "18 pt on every side." },
  { value: "36", label: "0.5 in", description: "36 pt on every side." },
];

export function ImagesToPdfTool() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeId>("fit");
  const [fit, setFit] = useState<ImageFit>("contain");
  const [orientation, setOrientation] = useState<ImageOrientation>("auto");
  const [margin, setMargin] = useState("18");

  const job = useToolJob<ProcessingResult>();

  const imagesRef = useRef(images);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, []);

  const totalBytes = useMemo(
    () => images.reduce((total, image) => total + image.size, 0),
    [images],
  );

  async function addFiles(incoming: File[]) {
    job.reset();
    const result = await readImageFiles(incoming);

    const items = result.accepted.map((image) => ({
      ...image,
      previewUrl: URL.createObjectURL(
        new Blob([new Uint8Array(image.bytes)], {
          type: image.name.toLowerCase().endsWith(".png")
            ? "image/png"
            : "image/jpeg",
        }),
      ),
    }));

    if (items.length > 0) {
      setImages((current) => [...current, ...items]);
    }

    setErrors(result.errors);
  }

  return (
    <ToolShell tool={tool}>
      <section aria-labelledby="image-intake" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="image-intake" className="text-sm font-semibold text-ink">
            Images, in page order
          </h2>
          <p className="text-xs text-ink-muted">
            {formatCount(images.length, "image")} · {formatBytes(totalBytes)}
          </p>
        </div>

        <FileDropZone
          accept="image"
          multiple
          onFiles={addFiles}
          label="Add PNG or JPEG images"
          hint="Drop images here or choose files. PNG and JPEG only; up to 60 images per run."
          disabled={job.isWorking}
        />

        <ErrorList messages={errors} />

        {images.length > 0 ? (
          <FileList
            items={images.map((image) => ({
              id: image.id,
              label: image.name,
              size: image.size,
              thumbnailUrl: image.previewUrl,
            }))}
            disabled={job.isWorking}
            onRemove={(id) => {
              job.reset();
              const target = images.find((image) => image.id === id);

              if (target) {
                URL.revokeObjectURL(target.previewUrl);
              }

              setImages((current) =>
                current.filter((image) => image.id !== id),
              );
            }}
            onReorder={(from, to) => {
              job.reset();
              setImages((current) => moveItem(current, from, to));
            }}
          />
        ) : null}
      </section>

      <OptionGroup
        legend="Page size"
        name="image-page-size"
        value={pageSize}
        options={PAGE_SIZE_OPTIONS}
        onChange={setPageSize}
        disabled={job.isWorking}
      />

      <OptionGroup
        legend="Image fit"
        name="image-fit"
        value={fit}
        options={FIT_OPTIONS}
        onChange={setFit}
        disabled={job.isWorking || pageSize === "fit"}
        hint={
          pageSize === "fit"
            ? "With fit-to-image pages there is nothing to crop, so fit is ignored."
            : undefined
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <OptionGroup
          legend="Orientation"
          name="image-orientation"
          value={orientation}
          options={ORIENTATION_OPTIONS}
          onChange={setOrientation}
          disabled={job.isWorking || pageSize === "fit"}
          columns={2}
        />

        <fieldset disabled={job.isWorking}>
          <legend className="text-sm font-semibold text-ink">Margin</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {MARGIN_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={
                  margin === option.value
                    ? "cursor-pointer rounded-control border border-accent/50 bg-accent-soft/60 px-3 py-3 text-center text-xs font-semibold text-accent-strong shadow-inset-sm"
                    : "cursor-pointer rounded-control border border-white/70 bg-surface px-3 py-3 text-center text-xs font-semibold text-ink shadow-raised-xs transition hover:shadow-raised-sm"
                }
              >
                <input
                  type="radio"
                  name="image-margin"
                  value={option.value}
                  checked={margin === option.value}
                  onChange={() => setMargin(option.value)}
                  className="sr-only"
                />
                {option.label}
                <span className="mt-1 block text-[0.65rem] font-normal text-ink-muted">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <button
        type="button"
        disabled={images.length === 0 || job.isWorking}
        onClick={async () => {
          await job.run((report) =>
            imagesToPdf(
              images.map((image) => ({ name: image.name, bytes: image.bytes })),
              {
                ...DEFAULT_IMAGES_OPTIONS,
                pageSize,
                fit,
                orientation,
                margin: Number.parseInt(margin, 10),
              },
              report,
            ),
          );
        }}
        className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ImagePlus aria-hidden="true" className="size-4" />
        {job.isWorking
          ? "Building PDF…"
          : `Create PDF from ${images.length || 0} ${images.length === 1 ? "image" : "images"}`}
      </button>

      {job.state.status === "working" ? (
        <ProgressPanel label="Embedding images" progress={job.state.progress} />
      ) : null}

      {job.state.status === "error" ? <ErrorNotice message={job.state.message} /> : null}

      {job.state.status === "done" ? (
        <ResultPanel
          title="PDF created"
          summary="Images were embedded at their original resolution. No recompression was applied."
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Start over"
          onReset={() => {
            job.reset();
            for (const image of images) {
              URL.revokeObjectURL(image.previewUrl);
            }
            setImages([]);
            setErrors([]);
          }}
        />
      ) : null}
    </ToolShell>
  );
}
