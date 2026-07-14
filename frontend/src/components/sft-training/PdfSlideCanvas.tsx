// Renders one page of a PDF deck as a pixel-perfect canvas via pdf.js.
// The PDF was uploaded by the trainer in the Course Builder; we display the
// page exactly as authored (no re-layout), and the voiceover narrates the
// speaker notes parsed from the matching .pptx.

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// pdfjs-dist v4 ships ESM; import only what we need.
import * as pdfjsLib from "pdfjs-dist";
// Vite ?url import — bundles the worker file and gives us a stable URL.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// One-time worker config (idempotent).
if (typeof window !== "undefined") {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
}

interface Props {
  /** Signed URL or any fetchable URL to the deck PDF. */
  url: string;
  /** 1-indexed page number. */
  pageNumber: number;
  /** Called once with the document page count, so the parent can validate sync with notes. */
  onLoaded?: (numPages: number) => void;
  onError?: (msg: string) => void;
  /** Stable identifier for this deck (e.g. moduleId) — used as the cache key
   *  instead of `url`. Signed URLs carry a fresh signature/expiry on every
   *  fetch, so caching by `url` alone would miss (and re-download the whole
   *  PDF) every time the same deck is revisited. Falls back to `url` if not
   *  provided. */
  cacheKey?: string;
}

// Cache documents per deck within the component tree so flipping slides —
// or revisiting the same deck later — doesn't reload the PDF every time.
const docCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();
type CancellableTask = { promise: Promise<unknown>; cancel: () => void };

function loadDoc(url: string, cacheKey: string) {
  const cached = docCache.get(cacheKey);
  if (cached) return cached;
  const p = pdfjsLib.getDocument({
    url,
    disableAutoFetch: false,
    disableStream: false,
  }).promise;
  docCache.set(cacheKey, p);
  return p;
}

export function PdfSlideCanvas({ url, pageNumber, onLoaded, onError, cacheKey }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: CancellableTask | null = null;
    setBusy(true);
    setErr(null);
    (async () => {
      try {
        const doc = await loadDoc(url, cacheKey ?? url);
        if (cancelled) return;
        onLoaded?.(doc.numPages);
        const page = await doc.getPage(
          Math.min(Math.max(1, pageNumber), doc.numPages),
        );
        if (cancelled) return;
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        // Scale to fit the container width while preserving aspect ratio.
        const containerWidth = wrap.clientWidth || 960;
        const viewport0 = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport0.width;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: scale * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        const task = page.render({
          canvasContext: ctx,
          viewport,
        }) as unknown as CancellableTask;
        renderTask = task;
        await task.promise;
        if (cancelled) return;
        setBusy(false);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to render slide";
        setErr(msg);
        onError?.(msg);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [url, pageNumber, onError, onLoaded, cacheKey]);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full flex items-center justify-center bg-black/5"
    >
      <canvas ref={canvasRef} className="block max-h-full max-w-full" />
      {busy && !err && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {err && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-destructive">
          {err}
        </div>
      )}
    </div>
  );
}
