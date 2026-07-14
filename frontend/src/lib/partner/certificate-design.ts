// Upload + composite pipeline for admin-uploaded certificate designs (a PNG
// or PDF background with drag-positioned tokens), as opposed to the older
// fully-coded certificate in certificate-pdf.ts. A PDF background is
// rasterized to PNG once at upload time — jsPDF can only draw images/text,
// it can't import an existing PDF's content, so everything downstream only
// ever deals with a flat PNG background.
import * as pdfjsLib from "pdfjs-dist";
// Vite ?url import — bundles the worker file and gives us a stable URL.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import jsPDF from "jspdf";
import { uploadImageAndGetPath, getSignedUrl } from "@/lib/api/storage";
import type { CertificateDesign, CertificateTokenPosition } from "@/lib/learning/learning.functions";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const CERT_BUCKET = "learning-media";
const CERT_FOLDER = "certificates";

async function rasterizePdfFirstPage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  // Render at 2x for a crisp print-quality background.
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to rasterize PDF"))), "image/png"),
  );
  return { blob, width: canvas.width, height: canvas.height };
}

function loadImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image"));
    };
    img.src = url;
  });
}

// Uploads a certificate background (PNG/JPEG stored as-is, PDF rasterized to
// PNG first) and returns its storage path + natural pixel dimensions.
export async function uploadCertificateBackground(
  file: File,
): Promise<{ path: string; width: number; height: number }> {
  let uploadFile: File | Blob = file;
  let width: number;
  let height: number;

  if (file.type === "application/pdf") {
    const raster = await rasterizePdfFirstPage(file);
    uploadFile = raster.blob;
    width = raster.width;
    height = raster.height;
  } else {
    ({ width, height } = await loadImageDimensions(file));
  }

  const asFile = uploadFile instanceof File ? uploadFile : new File([uploadFile], "background.png", { type: "image/png" });
  const result = await uploadImageAndGetPath(CERT_BUCKET, CERT_FOLDER, asFile);
  if (!result) throw new Error("Upload failed");
  return { path: result.path, width, height };
}

// Uploads a signature image (PNG/JPEG only — no PDF support needed here).
export async function uploadSignatureImage(file: File): Promise<string> {
  const result = await uploadImageAndGetPath(CERT_BUCKET, `${CERT_FOLDER}/signatures`, file);
  if (!result) throw new Error("Upload failed");
  return result.path;
}

export async function getCertificateAssetUrl(path: string): Promise<string> {
  const url = await getSignedUrl(CERT_BUCKET, path);
  if (!url) throw new Error("Could not resolve certificate asset");
  return url;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export interface CertificateValues {
  partner_name: string;
  certificate_id: string;
  date: string;
}

function valueForToken(token: CertificateTokenPosition, values: CertificateValues): string | undefined {
  if (token.key === "partner_name") return values.partner_name;
  if (token.key === "certificate_id") return values.certificate_id;
  if (token.key === "date") return values.date;
  return undefined;
}

// Font choices offered in the token editor. `value` is what's stored on the
// token; `css` is the full font-family stack (custom webfonts fall back to a
// safe system font if they somehow fail to load). Tokens saved before this
// feature existed have no font_family — resolveCertFontStack falls back to
// the original hardcoded stack so old designs render unchanged.
export const CERT_FONT_OPTIONS: { value: string; label: string; css: string }[] = [
  { value: "inter", label: "Inter (Sans)", css: '"Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: "sora", label: "Sora (Bold Display)", css: '"Sora", "Helvetica Neue", Arial, sans-serif' },
  { value: "playfair", label: "Playfair Display (Elegant Serif)", css: '"Playfair Display", Georgia, serif' },
  { value: "georgia", label: "Georgia (Serif)", css: 'Georgia, "Times New Roman", serif' },
  { value: "times", label: "Times New Roman (Classic)", css: '"Times New Roman", Times, serif' },
  { value: "courier", label: "Courier New (Monospace)", css: '"Courier New", Courier, monospace' },
  { value: "dancing", label: "Dancing Script (Signature style)", css: '"Dancing Script", cursive' },
];

const DEFAULT_FONT_STACK = '"Helvetica Neue", Arial, sans-serif';

export function resolveCertFontStack(family?: string): string {
  return CERT_FONT_OPTIONS.find((f) => f.value === family)?.css ?? DEFAULT_FONT_STACK;
}

export function cssFontString(token: CertificateTokenPosition): string {
  const style = token.italic ? "italic " : "";
  const weight = token.bold ? "bold " : "";
  return `${style}${weight}${token.font_size ?? 24}px ${resolveCertFontStack(token.font_family)}`;
}

// Custom webfonts (Sora, Playfair Display, Dancing Script) may not have been
// requested anywhere else on the page yet, so document.fonts.ready alone
// isn't reliable — explicitly load every font/size combination used by this
// design's text tokens before drawing to canvas.
async function ensureFontsLoaded(tokens: CertificateTokenPosition[]): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const specs = tokens
    .filter((t) => t.type === "text")
    .map((t) => cssFontString(t));
  await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => undefined)));
}

// Composites an uploaded certificate design (background + tokens) with a
// specific partner's values, and downloads the result as a PDF.
export async function downloadComposedCertificate(
  design: CertificateDesign,
  values: CertificateValues,
  fileName: string,
): Promise<void> {
  if (!design.background_path || !design.background_width || !design.background_height) {
    throw new Error("This certificate has no uploaded design to render");
  }

  const bgUrl = await getCertificateAssetUrl(design.background_path);
  const bgImg = await loadImageFromUrl(bgUrl);

  const width = design.background_width;
  const height = design.background_height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bgImg, 0, 0, width, height);

  await ensureFontsLoaded(design.tokens ?? []);

  for (const token of design.tokens ?? []) {
    const x = (token.x_pct / 100) * width;
    const y = (token.y_pct / 100) * height;
    if (token.type === "text") {
      const text = valueForToken(token, values);
      if (!text) continue;
      ctx.font = cssFontString(token);
      ctx.fillStyle = token.color ?? "#111111";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
    } else if (token.type === "image" && token.image_path) {
      const sigUrl = await getCertificateAssetUrl(token.image_path);
      const sigImg = await loadImageFromUrl(sigUrl);
      const wPct = token.width_pct ?? 15;
      const w = (wPct / 100) * width;
      const h = w * (sigImg.naturalHeight / sigImg.naturalWidth);
      ctx.drawImage(sigImg, x - w / 2, y - h / 2, w, h);
    }
  }

  const orientation = width >= height ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "px", format: [width, height] });
  doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, height);
  doc.save(`${fileName}.pdf`);
}
