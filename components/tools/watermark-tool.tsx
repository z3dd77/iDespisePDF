"use client";

import { useState, useRef, useEffect } from "react";
import { Scissors } from "lucide-react";

import { ErrorList, ErrorNotice } from "@/components/tools/error-notice";
import { FileDropZone } from "@/components/tools/file-drop-zone";
import { OptionGroup } from "@/components/tools/option-group";
import { ProgressPanel } from "@/components/tools/progress-panel";
import { ResultPanel } from "@/components/tools/result-panel";
import { SelectedFileCard } from "@/components/tools/selected-file";
import { ToolShell } from "@/components/tools/tool-shell";
import { useToolJob } from "@/hooks/use-tool-job";
import { usePdfPreview } from "@/hooks/use-pdf-preview";
import { readPdfFiles, readImageFiles, type IntakeFile } from "@/lib/files";
import { watermarkPdf } from "@/lib/pdf/watermark";
import type { ProcessingResult } from "@/lib/pdf/types";
import { getTool } from "@/lib/tools";

const tool = getTool("watermark");

type Placement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center";

type WatermarkMode = "text" | "image";

export function WatermarkTool() {
  const [file, setFile] = useState<IntakeFile | null>(null);
  const [imageFile, setImageFile] = useState<IntakeFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const [mode, setMode] = useState<WatermarkMode>("text");

  // Text watermark options
  const [text, setText] = useState("DRAFT");
  const [opacity, setOpacity] = useState(0.5);
  const [rotation, setRotation] = useState(0);
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#ff0000");
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  const [imageScale, setImageScale] = useState(1);

  const job = useToolJob<ProcessingResult>();
  const preview = usePdfPreview(file?.bytes ?? null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function addPdf(incoming: File[]) {
    job.reset();
    const result = await readPdfFiles(incoming);
    setErrors(result.errors);
    if (result.accepted[0]) setFile(result.accepted[0]);
  }

  async function addImage(incoming: File[]) {
    const result = await readImageFiles(incoming);
    setErrors((prev) => [...prev, ...result.errors]);
    if (result.accepted[0]) setImageFile(result.accepted[0]);
  }

  async function runWatermark() {
    if (!file?.bytes) return;
    const opts: any = {
      opacity,
      rotation,
      placement,
    };
    if (mode === "text") {
      opts.text = text;
      opts.fontSize = fontSize;
      opts.color = color;
    } else if (mode === "image" && imageFile?.bytes) {
      opts.imageBytes = imageFile.bytes;
      opts.imageScale = imageScale;
    }
    await job.run((r) => watermarkPdf(file.bytes, opts, file.name, r));
  }

  // Draw preview canvas whenever relevant data changes
  useEffect(() => {
    if (preview.status !== "ready" || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const baseImg = new Image();
    baseImg.onload = () => {
      canvasRef.current!.width = baseImg.width;
      canvasRef.current!.height = baseImg.height;
      ctx.clearRect(0, 0, baseImg.width, baseImg.height);
      ctx.drawImage(baseImg, 0, 0);

      if (mode === "text") {
        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px Helvetica`;
        const txtMetrics = ctx.measureText(text);
        const txtW = txtMetrics.width;
        const txtH = fontSize;
        // compute x for center placement
        let x: number;
        if (placement === "center") {
          x = (baseImg.width - txtW) / 2;
        } else {
          const horiz = placement.split("-")[1] ?? "";
          if (horiz === "left") x = 0;
          else if (horiz === "center") x = (baseImg.width - txtW) / 2;
          else if (horiz === "right") x = baseImg.width - txtW;
          else x = 0;
        }
        // compute y
        let y = 0;
        if (placement === "center") {
          y = (baseImg.height - txtH) / 2;
        } else if (placement.startsWith("top")) {
          y = txtH;
        } else {
          y = baseImg.height - txtH / 2;
        }
        if (rotation !== 0) {
          ctx.save();
          ctx.translate(baseImg.width / 2, baseImg.height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          // draw text centered at origin
          if (placement === "center") {
            ctx.fillText(text, -txtW / 2, txtH / 2);
          } else {
            ctx.fillText(text, x - baseImg.width / 2, y - baseImg.height / 2);
          }
          ctx.restore();
        } else {
          if (placement === "center") {
              ctx.save();
              ctx.translate(baseImg.width / 2, baseImg.height / 2);
              ctx.fillText(text, -txtW / 2, txtH / 2);
              ctx.restore();
            } else {
              ctx.fillText(text, x, y);
            }
        }
      } else if (mode === "image" && imageFile?.bytes) {
        const blob = new Blob([new Uint8Array(imageFile.bytes)], {
          type: imageFile.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        });
        const url = URL.createObjectURL(blob);
        const wmImg = new Image();
        wmImg.onload = () => {
          const iw = wmImg.width;
          const ih = wmImg.height;
          let ix = 0;
          let iy = 0;
          const scale = imageScale;
          const drawW = iw * scale;
          const drawH = ih * scale;
          switch (placement) {
            case "top-left":
              ix = 0; iy = 0; break;
            case "top-center":
              ix = (baseImg.width - drawW) / 2; iy = 0; break;
            case "top-right":
              ix = baseImg.width - drawW; iy = 0; break;
            case "bottom-left":
              ix = 0; iy = baseImg.height - drawH; break;
            case "bottom-center":
              ix = (baseImg.width - drawW) / 2; iy = baseImg.height - drawH; break;
            case "bottom-right":
              ix = baseImg.width - drawW; iy = baseImg.height - drawH; break;
            case "center":
              ix = (baseImg.width - drawW) / 2; iy = (baseImg.height - drawH) / 2; break;
          }
          ctx.globalAlpha = opacity;
          if (rotation !== 0) {
            ctx.save();
            ctx.translate(baseImg.width / 2, baseImg.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-baseImg.width / 2, -baseImg.height / 2);
          }
          ctx.drawImage(wmImg, ix, iy, drawW, drawH);
          if (rotation !== 0) ctx.restore();
          URL.revokeObjectURL(url);
        };
        wmImg.src = url;
      }
    };
    baseImg.src = preview.thumbnails[0];
  }, [preview, mode, text, opacity, rotation, fontSize, color, placement, imageFile?.bytes, imageScale]);

  return (
    <ToolShell tool={tool}>
      {!file ? (
        <FileDropZone
          accept="pdf"
          onFiles={addPdf}
          label="Choose a PDF to watermark"
          hint="One PDF at a time. Watermark will be applied locally."
        />
      ) : (
        <SelectedFileCard
          name={file.name}
          size={file.size}
          disabled={job.isWorking}
          onRemove={() => {
            job.reset();
            setFile(null);
            setImageFile(null);
            setErrors([]);
          }}
        />
      )}

      <ErrorList messages={errors} />

      {file && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:sticky md:top-4 md:w-96 flex-1">
            {/* Mode selector */}
          <OptionGroup
            legend="Watermark type"
            name="wm-type"
            value={mode}
            options={[
              { value: "text" as const, label: "Text" },
              { value: "image" as const, label: "Image" },
            ]}
            onChange={(v) => setMode(v as WatermarkMode)}
            disabled={job.isWorking}
          />

          {/* Text fields – disabled when image mode */}
          <div className="grid grid-cols-2 gap-4 mt-4" hidden={mode !== "text"}>
            <label className="block">
              <span className="text-sm font-medium text-ink">Watermark text</span>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={job.isWorking || mode === "image"}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Opacity (0‑1)</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                disabled={job.isWorking}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Rotation (°)</span>
              <input
                type="number"
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                disabled={job.isWorking}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Font size (pt)</span>
              <input
                type="number"
                min={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                disabled={job.isWorking || mode === "image"}
                className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block col-span-2">
              <span className="text-sm font-medium text-ink">Colour</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={job.isWorking || mode === "image"}
                className="mt-1 h-10 w-16 rounded-control border border-line/70 bg-sunken p-1"
              />
            </label>
          </div>
          {mode === "image" && (
             <div className="mt-2">
               <label className="block">
                 <span className="text-sm font-medium text-ink">Opacity (0‑1)</span>
                 <input
                   type="number"
                   min={0}
                   max={1}
                   step={0.1}
                   value={opacity}
                   onChange={(e) => setOpacity(Number(e.target.value))}
                   disabled={job.isWorking}
                   className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
                 />
               </label>
               <label className="block">
                 <span className="text-sm font-medium text-ink">Rotation (°)</span>
                 <input
                   type="number"
                   value={rotation}
                   onChange={(e) => setRotation(Number(e.target.value))}
                   disabled={job.isWorking}
                   className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
                 />
               </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Scale (1 = 100%)</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  max={5}
                  value={imageScale}
                  onChange={(e) => setImageScale(Number(e.target.value))}
                  disabled={job.isWorking}
                  className="mt-1 w-full rounded-control border border-line/70 bg-sunken px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          )}

          {/* Image uploader – visible only when image mode */}
          {mode === "image" && (
            <div className="mt-4">
              <FileDropZone
                accept="image"
                onFiles={addImage}
                label="Upload watermark image"
                hint="PNG or JPG"
                disabled={job.isWorking}
              />
              {imageFile && (
                <SelectedFileCard
                  name={imageFile.name}
                  size={imageFile.size}
                  disabled={job.isWorking}
                  onRemove={() => {
                    job.reset();
                    setImageFile(null);
                  }}
                />
              )}
            </div>
          )}

          <OptionGroup
            legend="Placement"
            name="placement"
            value={placement}
            options={[
              { value: "top-left" as const, label: "Top‑left" },
              { value: "top-center" as const, label: "Top‑center" },
              { value: "top-right" as const, label: "Top‑right" },
              { value: "bottom-left" as const, label: "Bottom‑left" },
              { value: "bottom-center" as const, label: "Bottom‑center" },
              { value: "bottom-right" as const, label: "Bottom‑right" },
              { value: "center" as const, label: "Center" },
            ]}
            onChange={(v) => setPlacement(v as Placement)}
            disabled={job.isWorking}
          />



          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              type="button"
              disabled={job.isWorking}
              onClick={runWatermark}
              className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-5 py-2.5 text-sm font-semibold text-white shadow-raised-sm transition hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scissors aria-hidden="true" className="size-4" />
              {job.isWorking ? "Watermarking…" : "Add Watermark"}
            </button>
          </div>
        </div> {/* end left column */}
        <div className="flex-1 flex justify-center">
          {preview.status === "ready" && preview.thumbnails[0] && (
            <div className="mt-4 flex justify-center">
              <div className="relative" style={{ width: "400px", maxWidth: "100%" }}>
                <canvas ref={canvasRef} className="block w-full h-auto" style={{ imageRendering: "pixelated" }} />
              </div>
            </div>
          )}
        </div>
      </div> {/* end outer flex */}
    )}

      {job.state.status === "working" && (
        <ProgressPanel label="Applying watermark" progress={job.state.progress} />
      )}

      {job.state.status === "error" && <ErrorNotice message={job.state.message} />}

      {job.state.status === "done" && (
        <ResultPanel
          title="Watermark added"
          summary={`${job.state.result.files[0].pageCount} pages in watermarked PDF.`}
          files={job.state.result.files}
          notes={job.state.result.notes}
          resetLabel="Choose another file"
          onReset={() => {
            job.reset();
            setFile(null);
            setImageFile(null);
          }}
        />
      )}
    </ToolShell>
  );
}
